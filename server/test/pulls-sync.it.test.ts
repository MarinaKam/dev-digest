import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PrMeta } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const GITHUB_PULL: PrMeta = {
  number: 31,
  title: 'Add rate limiting',
  author: 'author',
  branch: 'feat/rl',
  base: 'main',
  head_sha: 'a1b2c3d4',
  additions: 12,
  deletions: 3,
  files_count: 2,
  status: 'open',
  opened_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-02T00:00:00Z',
};

/**
 * `pull_requests`, `pr_files` and `pr_commits` have one writer. Whichever route
 * imports a pull request, the stored row is the same; a detail refresh replaces
 * files and commits together or not at all; and a run, a repo or a skill is
 * reachable only from its own workspace.
 */
d('pull request import and workspace scoping', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    if (!ws) throw new Error('seed did not create a workspace');
    workspaceId = ws.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(github = new MockGitHubClient({ pulls: [GITHUB_PULL] })) {
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { github },
    });
  }

  async function insertRepo(ws = workspaceId) {
    const name = `sync-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: ws, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    if (!repo) throw new Error('repo insert returned no row');
    return repo;
  }

  async function insertPull(repoId: string, ws = workspaceId) {
    const [pull] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: ws,
        repoId,
        number: 7,
        title: 'Stored title',
        author: 'author',
        branch: 'feat/x',
        base: 'main',
        headSha: 'deadbeef',
        status: 'open',
      })
      .returning();
    if (!pull) throw new Error('pull insert returned no row');
    return pull;
  }

  async function storedPull(repoId: string) {
    const [row] = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.repoId, repoId));
    if (!row) throw new Error('no pull request was stored');
    const { id: _id, repoId: _repoId, ...rest } = row;
    return rest;
  }

  // ---- one writer for pull_requests ---------------------------------------

  it('a pull request first seen through a poll stores when it was opened', async () => {
    const app = await makeApp();
    const repo = await insertRepo();

    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ synced: 1, reviewTriggered: false });
    expect((await storedPull(repo.id)).openedAt?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    await app.close();
  });

  it('the poll route and the list route store the same pull request row', async () => {
    // No diff-stat backfill: the fixture already carries real stats.
    const app = await makeApp();
    const polled = await insertRepo();
    const listed = await insertRepo();

    await app.inject({ method: 'POST', url: `/repos/${polled.id}/poll` });
    await app.inject({ method: 'GET', url: `/repos/${listed.id}/pulls` });

    expect(await storedPull(polled.id)).toEqual(await storedPull(listed.id));
    await app.close();
  });

  it('a poll records when the repo was polled', async () => {
    const app = await makeApp();
    const repo = await insertRepo();

    await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });

    const [after] = await pg.handle.db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(after?.lastPolledAt).toBeInstanceOf(Date);
    await app.close();
  });

  // ---- detail refresh is one unit -----------------------------------------

  it('a detail refresh that cannot store the commits keeps the stored files and commits', async () => {
    const app = await makeApp();
    const repo = await insertRepo();
    const pull = await insertPull(repo.id);
    await pg.handle.db.insert(t.prFiles).values({ prId: pull.id, path: 'old.ts' });
    await pg.handle.db
      .insert(t.prCommits)
      .values({ prId: pull.id, sha: 'oldsha', message: 'old', author: 'author' });

    await pg.handle.sql.unsafe(
      `create function fault_pr_commits() returns trigger language plpgsql as $$ ` +
        `begin raise exception 'injected fault'; end $$; ` +
        `create trigger fault_pr_commits before insert on pr_commits ` +
        `for each row execute function fault_pr_commits();`,
    );
    let res: Awaited<ReturnType<typeof app.inject>>;
    try {
      res = await app.inject({ method: 'GET', url: `/pulls/${pull.id}` });
    } finally {
      await pg.handle.sql.unsafe(
        'drop trigger fault_pr_commits on pr_commits; drop function fault_pr_commits();',
      );
    }

    // The route falls back to what is stored, and what is stored is unchanged.
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Stored title');
    expect(body.files.map((f: { path: string }) => f.path)).toEqual(['old.ts']);
    expect(body.commits.map((c: { sha: string }) => c.sha)).toEqual(['oldsha']);
    await app.close();
  });

  it('a detail refresh replaces the files, the commits and the body together', async () => {
    const app = await makeApp();
    const repo = await insertRepo();
    const pull = await insertPull(repo.id);
    await pg.handle.db.insert(t.prFiles).values({ prId: pull.id, path: 'old.ts' });

    const res = await app.inject({ method: 'GET', url: `/pulls/${pull.id}` });

    expect(res.statusCode).toBe(200);
    const files = await pg.handle.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pull.id));
    const commits = await pg.handle.db
      .select()
      .from(t.prCommits)
      .where(eq(t.prCommits.prId, pull.id));
    const [after] = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.id, pull.id));
    expect(files.map((f) => f.path)).toEqual(['src/config.ts']);
    expect(commits.map((c) => c.sha)).toEqual(['a1b2c3d4']);
    expect(after?.body).toBe('Add rate limiting. Closes #471.');
    expect(after?.filesCount).toBe(9);
    await app.close();
  });

  // ---- a run belongs to one workspace -------------------------------------

  async function insertRun(ws: string) {
    const repo = await insertRepo(ws);
    const pull = await insertPull(repo.id, ws);
    const [run] = await pg.handle.db
      .insert(t.agentRuns)
      .values({ workspaceId: ws, prId: pull.id, status: 'running', source: 'local' })
      .returning();
    if (!run) throw new Error('run insert returned no row');
    await pg.handle.db.insert(t.runTraces).values({ runId: run.id, trace: { log: [] } });
    return run;
  }

  async function otherWorkspace(): Promise<string> {
    const [ws] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: `other-${seq++}` })
      .returning();
    if (!ws) throw new Error('workspace insert returned no row');
    return ws.id;
  }

  async function statusOf(runId: string) {
    const [row] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    return row?.status;
  }

  it('a run of another workspace cannot be cancelled', async () => {
    const app = await makeApp();
    const run = await insertRun(await otherWorkspace());

    const res = await app.inject({ method: 'POST', url: `/runs/${run.id}/cancel` });

    expect(res.statusCode).toBe(404);
    expect(await statusOf(run.id)).toBe('running');
    await app.close();
  });

  it('the trace of a run of another workspace is not served', async () => {
    const app = await makeApp();
    const run = await insertRun(await otherWorkspace());

    const res = await app.inject({ method: 'GET', url: `/runs/${run.id}/trace` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('the event stream of a run of another workspace is not served', async () => {
    const app = await makeApp();
    const run = await insertRun(await otherWorkspace());

    const res = await app.inject({ method: 'GET', url: `/runs/${run.id}/events` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  // ---- a repo and a skill belong to one workspace --------------------------

  it('the index state of a repo of another workspace is not served', async () => {
    const app = await makeApp();
    const repo = await insertRepo(await otherWorkspace());

    const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/index-state` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('a repo of another workspace cannot be resynced', async () => {
    const app = await makeApp();
    const repo = await insertRepo(await otherWorkspace());

    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/resync` });

    expect(res.statusCode).toBe(404);
    const jobs = await pg.handle.db.select().from(t.jobs);
    expect(jobs.filter((j) => JSON.stringify(j.payload).includes(repo.id))).toEqual([]);
    await app.close();
  });

  it('the index state of a repo of the own workspace is served', async () => {
    const app = await makeApp();
    const repo = await insertRepo();

    const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/index-state` });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  async function insertSkill(ws: string): Promise<string> {
    const [skill] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: ws,
        name: `skill-${seq++}`,
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning({ id: t.skills.id });
    if (!skill) throw new Error('skill insert returned no row');
    return skill.id;
  }

  async function createAgent(app: Awaited<ReturnType<typeof makeApp>>): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: `Scoped ${seq++}`,
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'Review the diff.',
      },
    });
    return res.json().id as string;
  }

  it('a skill of another workspace cannot be linked to an agent, one by one or as a set', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const own = await insertSkill(workspaceId);
    const foreign = await insertSkill(await otherWorkspace());

    const single = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: foreign },
    });
    const asSet = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [own, foreign] },
    });

    expect(single.statusCode).toBe(404);
    expect(asSet.statusCode).toBe(404);
    const links = (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(links).toEqual([]);
    await app.close();
  });

  it('skills of the own workspace are linked to an agent', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const own = await insertSkill(workspaceId);

    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [own] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ agent_id: agentId, skill_id: own, order: 0 }]);
    await app.close();
  });

  it('a run of the own workspace is cancelled and its trace is served', async () => {
    const app = await makeApp();
    const run = await insertRun(workspaceId);

    const trace = await app.inject({ method: 'GET', url: `/runs/${run.id}/trace` });
    const cancel = await app.inject({ method: 'POST', url: `/runs/${run.id}/cancel` });

    expect(trace.statusCode).toBe(200);
    expect(cancel.statusCode).toBe(200);
    expect(await statusOf(run.id)).toBe('cancelled');
    await app.close();
  });
});
