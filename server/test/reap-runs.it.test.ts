import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { reapStaleRunningRuns } from '../src/modules/reviews/repository/run.repo.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * A run still `running` when the API starts was cut off by a restart. It is
 * marked failed, and it must say why: the timeline shows a failed run's error,
 * and without one the run shows "error" with nothing to read.
 */
d('reaping runs cut off by a restart', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('marks the run failed with an error that names the restart', async () => {
    const db = pg.handle.db;
    const [ws] = await db.select().from(t.workspaces);
    if (!ws) throw new Error('no workspace');
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId: ws.id, owner: 'acme', name: 'reap', fullName: 'acme/reap' })
      .returning();
    if (!repo) throw new Error('no repo');
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId: ws.id,
        repoId: repo.id,
        number: 1,
        title: 'Change',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'sha1',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    if (!pr) throw new Error('no pr');
    const [run] = await db
      .insert(t.agentRuns)
      .values({ workspaceId: ws.id, prId: pr.id, status: 'running', source: 'local' })
      .returning();
    if (!run) throw new Error('no run');

    expect(await reapStaleRunningRuns(db)).toBe(1);

    const [after] = await db.select().from(t.agentRuns).where(eq(t.agentRuns.id, run.id));
    expect(after?.status).toBe('failed');
    expect(after?.error).toMatch(/restarted/i);
  });
});
