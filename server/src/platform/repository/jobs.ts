import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { JobStore } from '../jobs.js';

/** The `jobs` table: one row per enqueued job, mirroring its progress. */
export class JobsRepository implements JobStore {
  constructor(private db: DbExecutor) {}

  async insertQueued(workspaceId: string, kind: string, payload: unknown): Promise<string> {
    const [row] = await this.db
      .insert(t.jobs)
      .values({ workspaceId, kind, payload: payload as object, status: 'queued' })
      .returning({ id: t.jobs.id });
    if (!row) throw new Error('Job insert returned no row');
    return row.id;
  }

  async markRunning(jobId: string): Promise<void> {
    await this.db
      .update(t.jobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(t.jobs.id, jobId));
  }

  async setAttempts(jobId: string, attempts: number): Promise<void> {
    await this.db.update(t.jobs).set({ attempts }).where(eq(t.jobs.id, jobId));
  }

  async markDone(jobId: string): Promise<void> {
    await this.db
      .update(t.jobs)
      .set({ status: 'done', finishedAt: new Date() })
      .where(eq(t.jobs.id, jobId));
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(t.jobs)
      .set({ status: 'failed', finishedAt: new Date(), error })
      .where(eq(t.jobs.id, jobId));
  }
}
