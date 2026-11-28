import type { FastifyInstance } from 'fastify';
import * as t from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { PgFixture } from './pg.js';

/**
 * `runReview` is fire-and-forget: the POST returns runIds immediately and each
 * agent's review is persisted in the background (the client subscribes to SSE).
 * Tests that assert on persisted reviews/findings/traces must first wait for the
 * background runs to finish. This polls `agent_runs` until every row for the PR
 * reaches a terminal status (done / failed / cancelled).
 */
const TERMINAL = new Set(['done', 'failed', 'cancelled']);

export async function waitForPrRuns(
  db: PgFixture['handle']['db'],
  prId: string,
  opts: { expected?: number; timeoutMs?: number } = {},
): Promise<Array<typeof t.agentRuns.$inferSelect>> {
  const { expected, timeoutMs = 10_000 } = opts;
  const start = Date.now();
  for (;;) {
    const runs = await db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, prId));
    const terminal = runs.filter((r) => TERMINAL.has(r.status ?? ''));
    // With an explicit `expected`, wait until that many runs finish (ignores any
    // extra rows, e.g. a trifecta scan). Otherwise wait for all rows to settle.
    const done =
      expected != null
        ? terminal.length >= expected
        : runs.length > 0 && terminal.length === runs.length;
    if (done) return runs;
    if (Date.now() - start > timeoutMs) return runs;
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * A run's status is committed before its trace document is saved
 * (`run-executor.ts`: `completeAgentRun`, then `saveRunTrace`), so a trace read
 * right after `waitForPrRuns` can still be a 404 on a slow machine. This polls
 * `GET /runs/:id/trace` until the trace exists and returns its body.
 */
export async function readRunTrace(app: FastifyInstance, runId: string, timeoutMs = 10_000) {
  const start = Date.now();
  for (;;) {
    const res = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    if (res.statusCode === 200) return res.json();
    if (Date.now() - start > timeoutMs) {
      throw new Error(`trace of run ${runId} not saved within ${timeoutMs} ms (last status ${res.statusCode})`);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}
