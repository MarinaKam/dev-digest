import PQueue from 'p-queue';
import { withTimeout, withRetry } from './resilience.js';

/**
 * JobRunner — async work (clone, PR import, indexing, polling) on a
 * concurrency-limited p-queue, mirrored into the `jobs` table with
 * timeouts + retry/backoff.
 *
 * Handlers are registered by kind. enqueue() inserts a `jobs` row, schedules
 * the handler on the queue, and updates status/attempts/error as it runs.
 */

export type JobHandler = (payload: unknown, ctx: { jobId: string }) => Promise<void>;

export interface JobRunnerOptions {
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
}

/** Where the runner records a job's progress. Implemented over the `jobs` table. */
export interface JobStore {
  /** Record a new queued job; returns its id. */
  insertQueued(workspaceId: string, kind: string, payload: unknown): Promise<string>;
  markRunning(jobId: string): Promise<void>;
  setAttempts(jobId: string, attempts: number): Promise<void>;
  markDone(jobId: string): Promise<void>;
  markFailed(jobId: string, error: string): Promise<void>;
}

export interface EnqueuedJob {
  id: string;
  /** Resolves when the job finishes (or rejects if it ultimately fails). */
  done: Promise<void>;
}

export class JobRunner {
  private queue: PQueue;
  private handlers = new Map<string, JobHandler>();
  private timeoutMs: number;
  private retries: number;

  constructor(
    private store: JobStore,
    opts: JobRunnerOptions = {},
  ) {
    this.queue = new PQueue({ concurrency: opts.concurrency ?? 3 });
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.retries = opts.retries ?? 2;
  }

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  async enqueue(workspaceId: string, kind: string, payload: unknown): Promise<EnqueuedJob> {
    const handler = this.handlers.get(kind);
    if (!handler) throw new Error(`No job handler registered for kind '${kind}'`);

    const jobId = await this.store.insertQueued(workspaceId, kind, payload);

    const done = this.queue.add(async () => {
      await this.store.markRunning(jobId);
      try {
        await withRetry(
          () =>
            withTimeout(handler(payload, { jobId }), this.timeoutMs).then(() =>
              this.store.setAttempts(jobId, 1),
            ),
          {
            retries: this.retries,
            onRetry: (attempt) => this.store.setAttempts(jobId, attempt),
          },
        );
        await this.store.markDone(jobId);
      } catch (err) {
        await this.store.markFailed(jobId, (err as Error).message);
        throw err;
      }
    }) as Promise<void>;

    return { id: jobId, done };
  }

  /** Wait for the queue to drain (useful in tests). */
  async onIdle(): Promise<void> {
    await this.queue.onIdle();
  }
}
