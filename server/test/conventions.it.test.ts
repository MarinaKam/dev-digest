import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import {
  MockEmbedder,
  MockGitClient,
  MockLLMProvider,
  MockSecretsProvider,
} from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { SimpleGitClient } from '../src/adapters/git/simple-git.js';
import type { ConventionCandidate, ConventionList, Skill } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const FILES: Record<string, string> = {
  'src/routes/users.ts': [
    "import { z } from 'zod';",
    '',
    'export default async function usersRoutes(app) {',
    "  app.post('/users', { schema: { body: CreateUser } }, async (req) => {",
    '    const { workspaceId } = await getContext(app.container, req);',
    '    return service.create(workspaceId, req.body);',
    '  });',
    '}',
  ].join('\n'),
  'src/services/user.service.ts': [
    'export class UserService {',
    '  async get(id: string) {',
    "    if (!id) throw new NotFoundError('User not found');",
    '  }',
    '}',
  ].join('\n'),
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
};

const ROUTE_RULE = 'Read the workspace from getContext in every route';
const ERROR_RULE = 'Throw NotFoundError for a missing record';
const STRICT_RULE = 'Keep TypeScript strict mode on';

/** What the mock model answers: 3 grounded rules and 3 that the code must drop. */
const ANSWER = {
  conventions: [
    {
      rule: ROUTE_RULE,
      evidence_path: 'src/routes/users.ts',
      line_start: 5,
      line_end: 5,
      evidence_snippet: 'const { workspaceId } = await getContext(app.container, req);',
      confidence: 0.9,
    },
    {
      rule: ERROR_RULE,
      evidence_path: 'src/services/user.service.ts',
      line_start: 3,
      line_end: 3,
      evidence_snippet: "if (!id) throw new NotFoundError('User not found');",
      confidence: 0.8,
    },
    {
      rule: STRICT_RULE,
      evidence_path: 'tsconfig.json',
      line_start: 1,
      line_end: 1,
      evidence_snippet: '{ "compilerOptions": { "strict": true } }',
      confidence: 0.7,
    },
    {
      rule: 'Invented snippet',
      evidence_path: 'src/routes/users.ts',
      line_start: 2,
      line_end: 2,
      evidence_snippet: 'const ws = resolveWorkspace(req);',
      confidence: 0.9,
    },
    {
      rule: 'File never sent',
      evidence_path: 'src/secret/keys.ts',
      line_start: 1,
      line_end: 1,
      evidence_snippet: 'export const KEY = 1;',
      confidence: 0.9,
    },
    {
      rule: 'Escaping path',
      evidence_path: '../../etc/passwd',
      line_start: 1,
      line_end: 1,
      evidence_snippet: 'root:x:0:0',
      confidence: 0.9,
    },
  ],
};

/** Conventions Extractor routes (spec 004) against a real Postgres, with a mock model. */
d('conventions extractor', () => {
  let pg: PgFixture;
  let clone: string;
  let repoId: string;
  let llm: MockLLMProvider;
  let app: Awaited<ReturnType<typeof buildApp>>;

  const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
  const secrets = new MockSecretsProvider({ OPENROUTER_API_KEY: 'test-key' });

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [repo] = await pg.handle.db.select().from(t.repos);
    if (!repo) throw new Error('no seeded repo');
    repoId = repo.id;
    clone = await mkdtemp(join(tmpdir(), 'conv-it-'));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(join(clone, path, '..'), { recursive: true });
      await writeFile(join(clone, path), text);
    }
    llm = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: ANSWER } });
    app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ files: FILES }),
        secrets,
        llm: { openrouter: llm },
      },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
    if (clone) await rm(clone, { recursive: true, force: true });
  });

  const list = async (): Promise<ConventionList> => {
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    return res.json() as ConventionList;
  };
  const extract = (body: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract`, payload: body });
  const patch = (id: string, body: Record<string, unknown>) =>
    app.inject({ method: 'PATCH', url: `/repos/${repoId}/conventions/${id}`, payload: body });
  const byRule = (l: ConventionList, rule: string): ConventionCandidate => {
    const c = l.candidates.find((x) => x.rule === rule);
    if (!c) throw new Error(`no candidate "${rule}"`);
    return c;
  };
  const scans = async () => pg.handle.db.select().from(t.conventionScans);

  it('a repo that was never scanned has no candidates and no last scan', async () => {
    expect(await list()).toEqual({ candidates: [], last_scan: null, running: null });
  });

  it('a repo without a clone gets 409 and the model is not called', async () => {
    const res = await extract();
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/still being cloned/);
    expect(llm.calls).toHaveLength(0);
  });

  it('one run calls the model once and stores only candidates grounded in sent files', async () => {
    await pg.handle.db.update(t.repos).set({ clonePath: clone }).where(eq(t.repos.id, repoId));
    const res = await extract({ sampling: 'top' });
    expect(res.statusCode).toBe(200);
    expect(llm.calls.filter((c) => c.method === 'completeStructured')).toHaveLength(1);

    const body = res.json() as ConventionList;
    expect(body.running).toBeNull();
    expect(body.candidates.map((c) => c.rule).sort()).toEqual([ERROR_RULE, ROUTE_RULE, STRICT_RULE].sort());
    expect(byRule(body, ROUTE_RULE)).toMatchObject({
      evidence_path: 'src/routes/users.ts',
      evidence_snippet: '    const { workspaceId } = await getContext(app.container, req);',
      evidence_line_start: 5,
      evidence_line_end: 5,
      // MockGitClient's HEAD: the GitHub link pins to the commit that was read.
      evidence_sha: 'a1b2c3d4',
      status: 'pending',
      accepted: false,
    });
    expect(body.last_scan).toMatchObject({
      sampling: 'top',
      proposed: 6,
      kept: 3,
      added: 3,
      model: 'openrouter/deepseek/deepseek-v4-flash',
      cost_usd: 0.001,
    });
    // The two source files from the clone walk and tsconfig.json from the config list.
    expect(body.last_scan?.files_sampled).toBe(3);

    const req = llm.calls[0]?.req as { messages: Array<{ content: string }> };
    const prompt = req.messages.map((m) => m.content).join('\n');
    expect(prompt).toContain('<untrusted source="file:src/routes/users.ts">');
    expect(prompt).not.toContain('src/secret/keys.ts');
  });

  it('edits a rule, accepts and rejects; a rejected candidate stays, marked, at the end', async () => {
    const before = await list();
    const route = byRule(before, ROUTE_RULE);
    const error = byRule(before, ERROR_RULE);
    const strict = byRule(before, STRICT_RULE);

    const edited = await patch(route.id, { rule: `${ROUTE_RULE} handler`, status: 'accepted' });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ rule: `${ROUTE_RULE} handler`, status: 'accepted', accepted: true });
    expect((await patch(error.id, { status: 'accepted' })).statusCode).toBe(200);
    expect((await patch(strict.id, { status: 'rejected' })).statusCode).toBe(200);

    const after = await list();
    expect(after.candidates.map((c) => `${c.rule}:${c.status}`)).toEqual([
      `${ROUTE_RULE} handler:accepted`,
      `${ERROR_RULE}:accepted`,
      `${STRICT_RULE}:rejected`,
    ]);
    expect(after.candidates.map((c) => c.accepted)).toEqual([true, true, false]);
  });

  it('refuses an empty patch, an empty rule and an unknown status', async () => {
    const [first] = (await list()).candidates;
    if (!first) throw new Error('no candidate');
    expect((await patch(first.id, {})).statusCode).toBe(422);
    expect((await patch(first.id, { rule: '   ' })).statusCode).toBe(422);
    expect((await patch(first.id, { status: 'maybe' })).statusCode).toBe(422);
  });

  it('a re-scan adds no duplicate of an accepted rule and does not bring back a rejected one', async () => {
    const res = await extract({ sampling: 'top' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as ConventionList;
    // The route rule was edited after it was accepted; its original wording is not proposed again.
    expect(body.candidates.map((c) => `${c.rule}:${c.status}`)).toEqual([
      `${ROUTE_RULE} handler:accepted`,
      `${ERROR_RULE}:accepted`,
      `${STRICT_RULE}:rejected`,
    ]);
    expect(body.last_scan).toMatchObject({ kept: 3, added: 0 });
    const rows = await pg.handle.db.select().from(t.conventions).where(eq(t.conventions.repoId, repoId));
    expect(rows.filter((r) => r.rule === STRICT_RULE)).toHaveLength(1);
    expect(rows.filter((r) => r.rule === ERROR_RULE)).toHaveLength(1);
    expect(await scans()).toHaveLength(2);
  });

  it('a skill is made only from accepted conventions and is saved as convention / extracted', async () => {
    const current = await list();
    const accepted = current.candidates.filter((c) => c.accepted);
    const [rejected] = await pg.handle.db.select().from(t.conventions).where(eq(t.conventions.status, 'rejected'));
    const [pending] = await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId: rejected?.workspaceId ?? '', repoId, rule: 'A pending rule', status: 'pending' })
      .returning();
    if (!pending || !rejected) throw new Error('fixture state');
    const url = `/repos/${repoId}/conventions/skill`;
    const payload = (ids: string[], name = 'payments-api-conventions') => ({
      convention_ids: ids,
      name,
      description: '2 house conventions extracted from payments-api',
      body: '# payments-api-conventions\n\n## Read the workspace from getContext',
    });

    for (const bad of [rejected.id, pending.id]) {
      const res = await app.inject({ method: 'POST', url, payload: payload([accepted[0]?.id ?? '', bad]) });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.details).toEqual({ convention_ids: [bad] });
    }

    const ok = await app.inject({ method: 'POST', url, payload: payload(accepted.map((c) => c.id)) });
    expect(ok.statusCode).toBe(200);
    const skill = ok.json() as Skill;
    expect(skill).toMatchObject({
      name: 'payments-api-conventions',
      type: 'convention',
      source: 'extracted',
      enabled: true,
      version: 1,
      evidence_files: ['src/routes/users.ts', 'src/services/user.service.ts'],
    });
    const [v1] = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(v1?.note).toBe('Extracted from acme/payments-api');

    const again = await app.inject({ method: 'POST', url, payload: payload(accepted.map((c) => c.id)) });
    expect(again.statusCode).toBe(409);
  });

  it('another repo id or another repo convention is a 404', async () => {
    const stranger = '00000000-0000-4000-8000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/repos/${stranger}/conventions` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/repos/${stranger}/conventions/extract`, payload: {} })).statusCode).toBe(404);
    expect((await patch(stranger, { status: 'accepted' })).statusCode).toBe(404);
  });

  it('a failed model call returns 502 and writes nothing', async () => {
    const broken = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: { conventions: 'nope' } } });
    const app2 = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ files: FILES }),
        secrets,
        llm: { openrouter: broken },
      },
    });
    try {
      const rowsBefore = await pg.handle.db.select().from(t.conventions);
      const scansBefore = await scans();
      const res = await app2.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract`, payload: {} });
      expect(res.statusCode).toBe(502);
      expect(res.json().error.message).toMatch(/model call failed \(openrouter\/deepseek\/deepseek-v4-flash\)/);
      expect(await pg.handle.db.select().from(t.conventions)).toHaveLength(rowsBefore.length);
      expect(await scans()).toHaveLength(scansBefore.length);
    } finally {
      await app2.close();
    }
  });

  it('a run in flight is visible to every reader, and a second run waits with 409', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: ANSWER } });
    const slow = {
      ...inner,
      id: inner.id,
      listModels: inner.listModels.bind(inner),
      complete: inner.complete.bind(inner),
      embed: inner.embed.bind(inner),
      completeStructured: async <T,>(req: Parameters<typeof inner.completeStructured<T>>[0]) => {
        await gate;
        return inner.completeStructured<T>(req);
      },
    };
    const app3 = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder(), git: new MockGitClient({ files: FILES }), secrets, llm: { openrouter: slow } },
    });
    try {
      const url = `/repos/${repoId}/conventions`;
      const first = app3.inject({ method: 'POST', url: `${url}/extract`, payload: {} });
      let running: ConventionList['running'] = null;
      for (let i = 0; i < 50 && !running?.model; i += 1) {
        running = ((await app3.inject({ method: 'GET', url })).json() as ConventionList).running;
        if (!running?.model) await new Promise((r) => setTimeout(r, 20));
      }
      expect(running).toMatchObject({
        sampling: 'spread',
        files_sampled: 3,
        model: 'openrouter/deepseek/deepseek-v4-flash',
      });
      const second = await app3.inject({ method: 'POST', url: `${url}/extract`, payload: {} });
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toMatchObject({ code: 'extraction_running' });

      release();
      const done = await first;
      expect(done.statusCode).toBe(200);
      expect((done.json() as ConventionList).running).toBeNull();
      expect(((await app3.inject({ method: 'GET', url })).json() as ConventionList).running).toBeNull();
    } finally {
      release();
      await app3.close();
    }
  });

  it('never sends a file outside the clone to the model, whatever the repository symlinks', async () => {
    const SECRET = 'OPENROUTER_API_KEY=sk-must-not-leave-this-machine';
    const cloneDir = await mkdtemp(join(tmpdir(), 'conv-symlink-'));
    try {
      // The real git adapter reads <cloneDir>/<owner>/<name>; the repository
      // committed package.json and a source file as links to a local secret.
      const repoDir = join(cloneDir, 'acme', 'payments-api');
      for (const [path, text] of Object.entries(FILES)) {
        await mkdir(join(repoDir, path, '..'), { recursive: true });
        await writeFile(join(repoDir, path), text);
      }
      await writeFile(join(cloneDir, 'secret.env'), SECRET);
      await symlink('../../secret.env', join(repoDir, 'package.json'));
      await symlink(join(cloneDir, 'secret.env'), join(repoDir, 'src', 'leak.ts'));
      await pg.handle.db.update(t.repos).set({ clonePath: repoDir }).where(eq(t.repos.id, repoId));

      const spy = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: { conventions: [] } } });
      const app5 = await buildApp({
        config: config(),
        db: pg.handle.db,
        overrides: { embedder: new MockEmbedder(), git: new SimpleGitClient(cloneDir), secrets, llm: { openrouter: spy } },
      });
      try {
        const res = await app5.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract`, payload: {} });
        expect(res.statusCode).toBe(200);
        const req = spy.calls[0]?.req as { messages: Array<{ content: string }> };
        const prompt = req.messages.map((m) => m.content).join('\n');
        expect(prompt).toContain('file:src/routes/users.ts');
        expect(prompt).not.toContain(SECRET);
        expect(prompt).not.toContain('file:package.json');
        const rows = await pg.handle.db.select().from(t.conventions);
        expect(rows.some((r) => (r.evidenceSnippet ?? '').includes(SECRET))).toBe(false);
      } finally {
        await app5.close();
      }
    } finally {
      await pg.handle.db.update(t.repos).set({ clonePath: clone }).where(eq(t.repos.id, repoId));
      await rm(cloneDir, { recursive: true, force: true });
    }
  });
});
