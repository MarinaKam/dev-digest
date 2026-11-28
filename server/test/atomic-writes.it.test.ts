import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { AgentsRepository } from '../src/modules/agents/repository.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 42,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      confidence: 0.95,
      kind: 'finding',
    },
  ],
};

type FaultOp = 'insert' | 'update' | 'delete';

/**
 * A multi-statement write is one unit: when any statement of it fails, the
 * database holds none of its effects. Each test makes one statement of the unit
 * fail inside Postgres (a trigger that raises) and then reads the tables back.
 */
d('multi-statement writes are atomic', () => {
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

  /** Run `fn` while every `op` on `table` fails with a database error. */
  async function withFault<T>(table: string, op: FaultOp, fn: () => Promise<T>): Promise<T> {
    const name = `fault_${table}_${op}`;
    await pg.handle.sql.unsafe(
      `create function ${name}() returns trigger language plpgsql as $$ ` +
        `begin raise exception 'injected fault: ${op} on ${table}'; end $$; ` +
        `create trigger ${name} before ${op} on ${table} for each row execute function ${name}();`,
    );
    try {
      return await fn();
    } finally {
      await pg.handle.sql.unsafe(`drop trigger ${name} on ${table}; drop function ${name}();`);
    }
  }

  function makeApp() {
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured: REVIEW_FIXTURE }) },
      },
    });
  }

  async function insertAgent(repo: AgentsRepository) {
    return repo.insert({
      workspaceId,
      name: `Atomic Agent ${seq++}`,
      provider: 'openai',
      model: 'gpt-4.1',
      systemPrompt: 'Review the diff.',
    });
  }

  async function insertSkill(): Promise<string> {
    const [skill] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId,
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

  async function insertPull() {
    const name = `atomic-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    if (!repo) throw new Error('repo insert returned no row');
    const [pull] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo.id,
        number: 1,
        title: 'Add rate limiting',
        author: 'author',
        branch: 'feat/rl',
        base: 'main',
        headSha: 'a1b2c3d4',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'open',
      })
      .returning();
    if (!pull) throw new Error('pull insert returned no row');
    return pull;
  }

  async function reviewOnce(app: Awaited<ReturnType<typeof makeApp>>, prId: string) {
    const agent = await insertAgent(new AgentsRepository(pg.handle.db));
    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${prId}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    const [run] = await waitForPrRuns(pg.handle.db, prId, { expected: 1 });
    if (!run) throw new Error('no agent run was created');
    return run;
  }

  async function persistedFor(prId: string) {
    const reviews = await pg.handle.db.select().from(t.reviews).where(eq(t.reviews.prId, prId));
    const findings = await pg.handle.db
      .select({ id: t.findings.id })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.reviews.id, t.findings.reviewId))
      .where(eq(t.reviews.prId, prId));
    const [pull] = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.id, prId));
    return { reviews, findings, lastReviewedSha: pull?.lastReviewedSha ?? null };
  }

  // ---- agents --------------------------------------------------------------

  it('replacing the linked skills keeps the old links when the new set cannot be stored', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const agent = await insertAgent(repo);
    const kept = [await insertSkill(), await insertSkill()];
    await repo.setSkills(agent.id, kept);

    // The second id is not a skill, so the insert of the new set fails.
    await expect(repo.setSkills(agent.id, [kept[0] as string, randomUUID()])).rejects.toThrow();

    expect(await repo.skillIdsForAgent(agent.id)).toEqual(kept);
  });

  it('creating an agent stores no agent when its first version cannot be stored', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const before = (await repo.list(workspaceId)).length;

    await withFault('agent_versions', 'insert', async () => {
      await expect(insertAgent(repo)).rejects.toThrow();
    });

    expect(await repo.list(workspaceId)).toHaveLength(before);
  });

  it('a config edit leaves the agent unchanged when the new version cannot be stored', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const agent = await insertAgent(repo);

    await withFault('agent_versions', 'insert', async () => {
      await expect(repo.update(workspaceId, agent.id, { model: 'gpt-4o' })).rejects.toThrow();
    });

    const after = await repo.getById(workspaceId, agent.id);
    expect(after?.model).toBe('gpt-4.1');
    expect(after?.version).toBe(agent.version);
    expect(await repo.listVersions(agent.id)).toHaveLength(1);
  });

  // ---- review runs ---------------------------------------------------------

  it('a run that completes stores the review, its findings, the reviewed commit and the status', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    const run = await reviewOnce(app, pull.id);

    expect(run.status).toBe('done');
    const stored = await persistedFor(pull.id);
    expect(stored.reviews).toHaveLength(1);
    expect(stored.findings).toHaveLength(1);
    expect(stored.lastReviewedSha).toBe('a1b2c3d4');
    await app.close();
  });

  it('a run whose findings cannot be stored fails and leaves no review behind', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    const run = await withFault('findings', 'insert', () => reviewOnce(app, pull.id));

    expect(run.status).toBe('failed');
    expect(await persistedFor(pull.id)).toEqual({
      reviews: [],
      findings: [],
      lastReviewedSha: null,
    });
    await app.close();
  });

  it('a run that cannot record the reviewed commit fails and leaves no review or findings', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    const run = await withFault('pull_requests', 'update', () => reviewOnce(app, pull.id));

    expect(run.status).toBe('failed');
    expect(await persistedFor(pull.id)).toEqual({
      reviews: [],
      findings: [],
      lastReviewedSha: null,
    });
    await app.close();
  });

  it('a run whose trace cannot be stored stays done, because its review is already stored', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    const run = await withFault('run_traces', 'insert', () => reviewOnce(app, pull.id));

    expect(run.status).toBe('done');
    const stored = await persistedFor(pull.id);
    expect(stored.reviews).toHaveLength(1);
    expect(stored.findings).toHaveLength(1);
    await app.close();
  });

  // ---- repo index ----------------------------------------------------------

  it('replacing the file ranks of a repo keeps the old ranks when the new ones cannot be stored', async () => {
    const pull = await insertPull();
    const repo = new RepoIntelRepository(pg.handle.db);
    const rank = (filePath: string) => ({ filePath, pagerank: 1, hotness: 0, rank: 1, percentile: 50 });
    await repo.replaceFileRank(pull.repoId, [rank('src/kept.ts')]);

    // The same file twice breaks the primary key, so the insert fails.
    await expect(
      repo.replaceFileRank(pull.repoId, [rank('src/new.ts'), rank('src/new.ts')]),
    ).rejects.toThrow();

    const stored = await pg.handle.db
      .select({ filePath: t.fileRank.filePath })
      .from(t.fileRank)
      .where(eq(t.fileRank.repoId, pull.repoId));
    expect(stored).toEqual([{ filePath: 'src/kept.ts' }]);
  });

  // ---- settings ------------------------------------------------------------

  it('a settings update stores no key when one of its keys cannot be stored', async () => {
    const app = await makeApp();
    await pg.handle.sql.unsafe(
      `create function fault_settings_key() returns trigger language plpgsql as $$ ` +
        `begin if new.key = 'zz_rejected' then raise exception 'injected fault'; end if; ` +
        `return new; end $$; ` +
        `create trigger fault_settings_key before insert on settings ` +
        `for each row execute function fault_settings_key();`,
    );
    let res: Awaited<ReturnType<typeof app.inject>>;
    try {
      res = await app.inject({
        method: 'PUT',
        url: '/settings',
        payload: { aa_stored_first: 1, zz_rejected: 2 },
      });
    } finally {
      await pg.handle.sql.unsafe(
        'drop trigger fault_settings_key on settings; drop function fault_settings_key();',
      );
    }

    expect(res.statusCode).toBe(500);
    const settings = (await app.inject({ method: 'GET', url: '/settings' })).json();
    expect(settings).not.toHaveProperty('aa_stored_first');
    await app.close();
  });

  /** Run `fn` while `body` runs inside Postgres before each `op` on `table`. */
  async function withHook<T>(
    table: string,
    op: FaultOp,
    body: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const name = `hook_${table}_${op}`;
    await pg.handle.sql.unsafe(
      `create function ${name}() returns trigger language plpgsql as $$ ` +
        `begin ${body} return new; end $$; ` +
        `create trigger ${name} before ${op} on ${table} for each row execute function ${name}();`,
    );
    try {
      return await fn();
    } finally {
      await pg.handle.sql.unsafe(`drop trigger ${name} on ${table}; drop function ${name}();`);
    }
  }

  it('a run cancelled while its outcome is being stored stays cancelled and keeps no review', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    // The cancel lands after the review row is written and before the status.
    const run = await withHook(
      'findings',
      'insert',
      `update agent_runs set status = 'cancelled' where status = 'running';`,
      () => reviewOnce(app, pull.id),
    );

    expect(run.status).toBe('cancelled');
    expect(await persistedFor(pull.id)).toEqual({
      reviews: [],
      findings: [],
      lastReviewedSha: null,
    });
    await app.close();
  });

  it('a run that was already failed is not turned into done, and keeps no review', async () => {
    const app = await makeApp();
    const pull = await insertPull();

    // Sibling of the cancel case: the boot reaper marked the run failed.
    await withHook(
      'findings',
      'insert',
      `update agent_runs set status = 'failed' where status = 'running';`,
      () => reviewOnce(app, pull.id),
    );

    expect((await persistedFor(pull.id)).reviews).toEqual([]);
    const [run] = await pg.handle.db
      .select()
      .from(t.agentRuns)
      .where(eq(t.agentRuns.prId, pull.id));
    expect(run?.status).not.toBe('done');
    await app.close();
  });

  it('starting a review for several agents creates no run when one run cannot be created', async () => {
    const app = await makeApp();
    const pull = await insertPull();
    const repo = new AgentsRepository(pg.handle.db);
    await insertAgent(repo);
    await insertAgent(repo);

    // The second run row of this pull request is rejected.
    const res = await withHook(
      'agent_runs',
      'insert',
      `if (select count(*) from agent_runs where pr_id = new.pr_id) >= 1 then ` +
        `raise exception 'injected fault'; end if;`,
      () => app.inject({ method: 'POST', url: `/pulls/${pull.id}/review`, payload: { all: true } }),
    );

    expect(res.statusCode).toBe(500);
    const runs = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, pull.id));
    expect(runs).toEqual([]);
    await app.close();
  });

  it('concurrent config edits of one agent each get their own version and snapshot', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const agent = await insertAgent(repo);
    const models = ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'];

    await Promise.all(models.map((model) => repo.update(workspaceId, agent.id, { model })));

    const after = await repo.getById(workspaceId, agent.id);
    const versions = await repo.listVersions(agent.id);
    expect(after?.version).toBe(1 + models.length);
    expect(versions.map((v) => v.version)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    // The newest snapshot is the config the agent row holds.
    const [newest] = versions;
    if (!newest) throw new Error('the agent has no version');
    expect((newest.configJson as { model: string }).model).toBe(after?.model);
  });

  it('deleting a run keeps its review when the run itself cannot be deleted', async () => {
    const app = await makeApp();
    const pull = await insertPull();
    const run = await reviewOnce(app, pull.id);

    const res = await withFault('agent_runs', 'delete', () =>
      app.inject({ method: 'DELETE', url: `/runs/${run.id}` }),
    );

    expect(res.statusCode).toBe(500);
    const stored = await persistedFor(pull.id);
    expect(stored.reviews).toHaveLength(1);
    expect(stored.findings).toHaveLength(1);
    await app.close();
  });
});
