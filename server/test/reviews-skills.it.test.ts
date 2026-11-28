import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { readRunTrace, waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
 const a = 1;
+const b = 2;`;

const EMPTY_REVIEW: Review = { verdict: 'approve', summary: 'Fine.', score: 100, findings: [] };

interface Message {
  role: string;
  content: string;
}

/**
 * What reaches the model from an agent's skills: only enabled linked skills, in
 * link order, recorded in the trace with their version and token count.
 */
d('review runs with skills', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let llm: MockLLMProvider;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    if (!ws) throw new Error('no workspace');
    workspaceId = ws.id;
    llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder(), git: new MockGitClient({ diff: DIFF }), llm: { openai: llm } },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  async function newAgent(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: `Skills Agent ${++seq}`,
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'Review the diff.',
        repo_intel: false,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { id: string }).id;
  }

  async function newSkill(name: string, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name, description: `Apply ${name}.`, type: 'rubric', body: `${name} body v1`, ...extra },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { id: string }).id;
  }

  async function newPr(): Promise<string> {
    const n = ++seq;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `skills-${n}`, fullName: `acme/skills-${n}` })
      .returning();
    if (!repo) throw new Error('no repo');
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo.id,
        number: n,
        title: 'Change',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: `sha${n}`,
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    if (!pr) throw new Error('no pr');
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr.id,
      path: 'src/a.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;',
    });
    return pr.id;
  }

  /** Run the agent on a fresh PR; return the prompt it sent and the stored trace. */
  async function run(agentId: string) {
    const prId = await newPr();
    const before = llm.calls.length;
    const res = await app.inject({ method: 'POST', url: `/pulls/${prId}/review`, payload: { agentId } });
    expect(res.statusCode).toBe(200);
    const runId = (res.json() as { runs: { run_id: string }[] }).runs[0]?.run_id;
    await waitForPrRuns(pg.handle.db, prId, { expected: 1 });
    const call = llm.calls.slice(before).find((c) => c.method === 'completeStructured');
    if (!call) throw new Error('the model was not called');
    const messages = (call.req as { messages: Message[] }).messages;
    const trace = (await readTrace(runId)) as {
      prompt_assembly: {
        skills: string | null;
        skills_tokens?: number | null;
        skills_used?: { name: string; version: number }[] | null;
      };
      log: { msg: string }[];
    };
    return { runId, system: messages[0]?.content ?? '', user: messages[1]?.content ?? '', trace };
  }

  const readTrace = async (runId: string | undefined) =>
    (await readRunTrace(app, runId ?? '')) as {
      prompt_assembly: { skills_used?: { name: string; version: number }[] | null };
    };

  const link = async (agentId: string, skillIds: string[]) => {
    const res = await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: skillIds } });
    expect(res.statusCode).toBe(200);
  };

  it('sends only enabled linked skills, in link order', async () => {
    const agent = await newAgent();
    const a = await newSkill('order-a');
    const b = await newSkill('order-b');
    await newSkill('order-unlinked');
    await link(agent, [b, a]);
    const { user, trace } = await run(agent);
    expect(user.indexOf('<skill name="order-b"')).toBeGreaterThan(-1);
    expect(user.indexOf('<skill name="order-b"')).toBeLessThan(user.indexOf('<skill name="order-a"'));
    expect(user).not.toContain('order-unlinked');
    expect(trace.prompt_assembly.skills_used).toEqual([
      { name: 'order-b', version: 1 },
      { name: 'order-a', version: 1 },
    ]);
  });

  it('skips a disabled linked skill', async () => {
    const agent = await newAgent();
    const on = await newSkill('kept-on');
    const off = await newSkill('switched-off', { enabled: false });
    await link(agent, [off, on]);
    const { user, trace } = await run(agent);
    expect(user).not.toContain('switched-off');
    expect(trace.prompt_assembly.skills_used).toEqual([{ name: 'kept-on', version: 1 }]);
    expect(trace.log.some((l) => l.msg.includes('switched-off'))).toBe(false);
  });

  it('trace keeps the version sent', async () => {
    const agent = await newAgent();
    const s = await newSkill('version-kept');
    await link(agent, [s]);
    for (const body of ['v2 body', 'v3 body']) {
      await app.inject({ method: 'PUT', url: `/skills/${s}`, payload: { body } });
    }
    const { runId, user } = await run(agent);
    expect(user).toContain('<skill name="version-kept" version="3">');
    await app.inject({ method: 'PUT', url: `/skills/${s}`, payload: { body: 'v4 body' } });
    const after = await readTrace(runId);
    expect(after.prompt_assembly.skills_used).toEqual([{ name: 'version-kept', version: 3 }]);
  });

  it('records skills_tokens and a run-log line', async () => {
    const agent = await newAgent();
    const s = await newSkill('token-skill');
    await link(agent, [s]);
    const { trace } = await run(agent);
    expect(trace.prompt_assembly.skills_tokens).toBeGreaterThan(0);
    const skillsAt = trace.log.findIndex((l) => /^skills: 1 attached \(token-skill@v1\), \d+ tokens$/.test(l.msg));
    expect(skillsAt).toBeGreaterThan(-1);
    // Logged before the model call, so the live log shows it while the run is in progress.
    const reviewingAt = trace.log.findIndex((l) => l.msg.startsWith('Reviewing'));
    expect(reviewingAt).toBeGreaterThan(-1);
    expect(skillsAt).toBeLessThan(reviewingAt);
    expect(trace.log[skillsAt]?.msg).toContain(`${trace.prompt_assembly.skills_tokens} tokens`);
  });

  it("an agent without skills sends today's prompt", async () => {
    const agent = await newAgent();
    const { system, trace } = await run(agent);
    expect(system).not.toContain('<skill>');
    expect(trace.prompt_assembly.skills).toBeNull();
    expect(trace.prompt_assembly.skills_tokens ?? null).toBeNull();
    expect(trace.log.some((l) => l.msg.startsWith('skills:'))).toBe(false);
  });
});
