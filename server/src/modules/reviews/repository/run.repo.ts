import { and, desc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { RunSummary, RunTrace } from '@devdigest/shared';

// ---- in-flight / history --------------------------------------------------

/** In-flight runs for a PR (status='running') — the server-side source of
 *  truth for "which agents are running now". Joined with the agent name. */
export async function activeRunsForPull(
  db: DbExecutor,
  workspaceId: string,
  prId: string,
): Promise<{ run_id: string; agent_id: string | null; agent_name: string | null; ran_at: string | null }[]> {
  const rows = await db
    .select({
      id: t.agentRuns.id,
      agentId: t.agentRuns.agentId,
      ranAt: t.agentRuns.ranAt,
      agentName: t.agents.name,
    })
    .from(t.agentRuns)
    .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
    .where(
      and(
        eq(t.agentRuns.workspaceId, workspaceId),
        eq(t.agentRuns.prId, prId),
        eq(t.agentRuns.status, 'running'),
      ),
    );
  return rows.map((r) => ({
    run_id: r.id,
    agent_id: r.agentId,
    agent_name: r.agentName ?? null,
    ran_at: r.ranAt ? r.ranAt.toISOString() : null,
  }));
}

/** All runs for a PR (any status), newest first — the PR run history. */
export async function listRunsForPull(
  db: DbExecutor,
  workspaceId: string,
  prId: string,
): Promise<RunSummary[]> {
  const rows = await db
    .select({ run: t.agentRuns, agentName: t.agents.name })
    .from(t.agentRuns)
    .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
    .where(and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.prId, prId)))
    .orderBy(desc(t.agentRuns.ranAt));
  return rows.map(({ run, agentName }) => ({
    run_id: run.id,
    agent_id: run.agentId,
    agent_name: agentName ?? null,
    provider: run.provider,
    model: run.model,
    status: run.status,
    error: run.error,
    duration_ms: run.durationMs,
    tokens_in: run.tokensIn,
    tokens_out: run.tokensOut,
    cost_usd: run.costUsd,
    findings_count: run.findingsCount,
    grounding: run.grounding,
    ran_at: run.ranAt ? run.ranAt.toISOString() : null,
    score: run.score,
    blockers: run.blockers,
  }));
}

/**
 * Delete one agent run (+ its trace via FK cascade) AND the review it produced.
 * Workspace-scoped. `reviews.run_id` has no FK to `agent_runs`, so the review
 * (and its findings, which DO cascade from `reviews`) must be removed explicitly
 * here — otherwise deleting a run from the timeline leaves its findings orphaned
 * in the Review Runs list below. Both deletes are one transaction: a run that
 * cannot be deleted keeps its review.
 */
export async function deleteAgentRun(
  db: DbExecutor,
  workspaceId: string,
  runId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .delete(t.reviews)
      .where(and(eq(t.reviews.runId, runId), eq(t.reviews.workspaceId, workspaceId)));
    const rows = await tx
      .delete(t.agentRuns)
      .where(and(eq(t.agentRuns.id, runId), eq(t.agentRuns.workspaceId, workspaceId)))
      .returning({ id: t.agentRuns.id });
    return rows.length > 0;
  });
}

/** Whether the run exists in this workspace. */
export async function runExists(
  db: DbExecutor,
  workspaceId: string,
  runId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: t.agentRuns.id })
    .from(t.agentRuns)
    .where(and(eq(t.agentRuns.id, runId), eq(t.agentRuns.workspaceId, workspaceId)));
  return row !== undefined;
}

/** Mark a still-running run as cancelled (no-op if it already finished). */
export async function cancelRunIfRunning(
  db: DbExecutor,
  workspaceId: string,
  runId: string,
): Promise<boolean> {
  const rows = await db
    .update(t.agentRuns)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(t.agentRuns.id, runId),
        eq(t.agentRuns.workspaceId, workspaceId),
        eq(t.agentRuns.status, 'running'),
      ),
    )
    .returning({ id: t.agentRuns.id });
  return rows.length > 0;
}

/** Error of a run that the API cut off by restarting; the timeline shows it. */
export const RESTARTED_RUN_ERROR =
  'The API restarted while this run was in progress, so it stopped. Run the review again.';

/** On boot: any run still 'running' is orphaned (its process died / restarted),
 *  so mark it failed and say why. Prevents permanently stuck "running" runs in
 *  the UI, and a failed run with nothing to read. */
export async function reapStaleRunningRuns(db: DbExecutor): Promise<number> {
  const rows = await db
    .update(t.agentRuns)
    .set({ status: 'failed', error: RESTARTED_RUN_ERROR })
    .where(eq(t.agentRuns.status, 'running'))
    .returning({ id: t.agentRuns.id });
  return rows.length;
}

// ---- observability: agent_runs + run_traces -------------------------------

export interface NewAgentRun {
  workspaceId: string;
  agentId: string | null;
  prId: string;
  provider: string | null;
  model: string | null;
}

/**
 * Create one agent_runs row per entry, in `running` state, as one transaction:
 * either every run of a review request exists or none does. Returns the ids
 * (= the runIds) in the order of `runs`.
 */
export async function createAgentRuns(db: DbExecutor, runs: NewAgentRun[]): Promise<string[]> {
  return db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const run of runs) {
      const [row] = await tx
        .insert(t.agentRuns)
        .values({ ...run, status: 'running', source: 'local' })
        .returning({ id: t.agentRuns.id });
      if (!row) throw new Error('Agent run insert returned no row');
      ids.push(row.id);
    }
    return ids;
  });
}

export interface RunCompletion {
  status: 'done' | 'failed' | 'cancelled';
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  /** Run cost in USD; null/omitted = no cost data. 0 is a real (free) cost. */
  costUsd?: number | null;
  findingsCount: number;
  grounding: string;
  /** Review score (0-100); null on failed/cancelled runs. */
  score?: number | null;
  /** Findings that tripped the agent's gate; 0 on failed/cancelled runs. */
  blockers?: number | null;
  /** Failure reason (status='failed') / cancellation note. Null clears it. */
  error?: string | null;
}

/**
 * Record how a run ended. `done` is written only over a run that is still
 * `running`: a run that was cancelled, reaped or deleted in the meantime is not
 * turned into a completed one. Returns whether a row was updated.
 */
export async function completeAgentRun(
  db: DbExecutor,
  runId: string,
  values: RunCompletion,
): Promise<boolean> {
  const stillRunning = values.status === 'done' ? eq(t.agentRuns.status, 'running') : undefined;
  const rows = await db
    .update(t.agentRuns)
    .set({
      status: values.status,
      durationMs: values.durationMs,
      tokensIn: values.tokensIn,
      tokensOut: values.tokensOut,
      costUsd: values.costUsd ?? null,
      findingsCount: values.findingsCount,
      grounding: values.grounding,
      score: values.score ?? null,
      blockers: values.blockers ?? null,
      error: values.error ?? null,
    })
    .where(and(eq(t.agentRuns.id, runId), stillRunning))
    .returning({ id: t.agentRuns.id });
  return rows.length > 0;
}

/** Persist the WHOLE run log as ONE document. PK = runId → agent_runs. */
export async function saveRunTrace(db: DbExecutor, runId: string, trace: RunTrace): Promise<void> {
  await db
    .insert(t.runTraces)
    .values({ runId, trace })
    .onConflictDoUpdate({ target: t.runTraces.runId, set: { trace } });
}

/** The trace of a run of this workspace; undefined for a run of another one. */
export async function getRunTrace(
  db: DbExecutor,
  workspaceId: string,
  runId: string,
): Promise<RunTrace | undefined> {
  const [row] = await db
    .select({ trace: t.runTraces.trace })
    .from(t.runTraces)
    .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.runTraces.runId))
    .where(and(eq(t.runTraces.runId, runId), eq(t.agentRuns.workspaceId, workspaceId)));
  return row ? (row.trace as RunTrace) : undefined;
}
