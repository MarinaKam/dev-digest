import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import { MAX_UPLOAD_BYTES } from '../src/modules/skills/constants.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Skills module: CRUD, name conflicts, versions on body change only, delete
 * cascade, workspace scope, `used_by`, and the import preview (writes nothing,
 * accepts a 1 MiB file as base64).
 */
d('skills routes', () => {
  let pg: PgFixture;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  let n = 0;
  const body = (over: Record<string, unknown> = {}) => ({
    name: `skill-${++n}`,
    description: 'Flag every new branch that no test reaches.',
    type: 'rubric',
    body: 'Check each branch.',
    ...over,
  });
  const create = async (over: Record<string, unknown> = {}) => {
    const res = await app.inject({ method: 'POST', url: '/skills', payload: body(over) });
    expect(res.statusCode).toBe(200);
    return res.json() as { id: string; name: string; version: number };
  };
  const agentIds = async () => {
    const res = await app.inject({ method: 'GET', url: '/agents' });
    return (res.json() as { id: string; name: string }[]).slice(0, 2);
  };

  it('creates a skill at v1 with one version row', async () => {
    const skill = await create();
    expect(skill.version).toBe(1);
    const versions = await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` });
    expect((versions.json() as { version: number }[]).map((v) => v.version)).toEqual([1]);
    const got = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
    expect(got.json()).toMatchObject({ name: skill.name, source: 'manual', enabled: true, used_by: [] });
  });

  it('409 on a duplicate name, on create and on rename', async () => {
    const a = await create();
    const dup = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: a.name }) });
    expect(dup.statusCode).toBe(409);
    const b = await create();
    const rename = await app.inject({ method: 'PUT', url: `/skills/${b.id}`, payload: { name: a.name } });
    expect(rename.statusCode).toBe(409);
    const same = await app.inject({ method: 'PUT', url: `/skills/${b.id}`, payload: { name: b.name } });
    expect(same.statusCode).toBe(200);
  });

  it('422 on an invalid name', async () => {
    const res = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'Bad Name' }) });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('bumps the version only when the body changes', async () => {
    const s = await create();
    const meta = await app.inject({
      method: 'PUT',
      url: `/skills/${s.id}`,
      payload: { description: 'Another directive.', enabled: false },
    });
    expect(meta.json()).toMatchObject({ version: 1, enabled: false });
    await app.inject({ method: 'PUT', url: `/skills/${s.id}`, payload: { body: 'v2 body' } });
    const third = await app.inject({ method: 'PUT', url: `/skills/${s.id}`, payload: { body: 'v3 body' } });
    expect(third.json()).toMatchObject({ version: 3, body: 'v3 body' });
    const same = await app.inject({ method: 'PUT', url: `/skills/${s.id}`, payload: { body: 'v3 body' } });
    expect(same.json()).toMatchObject({ version: 3 });
    const versions = await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` });
    const list = versions.json() as { version: number; body: string }[];
    expect(list.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(list[0]?.body).toBe('v3 body');
  });

  it('stores a version note, and notes version 1 "Created"', async () => {
    const s = await create();
    await app.inject({
      method: 'PUT',
      url: `/skills/${s.id}`,
      payload: { body: 'tighter body', version_note: 'Tightened scope rule' },
    });
    const list = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` })).json() as {
      version: number;
      note: string | null;
    }[];
    expect(list.map((v) => [v.version, v.note])).toEqual([
      [2, 'Tightened scope rule'],
      [1, 'Created'],
    ]);
  });

  it('keeps the note given on create', async () => {
    const s = await create({ source: 'imported_file', version_note: 'Imported from x.zip' });
    const list = (await app.inject({ method: 'GET', url: `/skills/${s.id}/versions` })).json() as {
      note: string | null;
    }[];
    expect(list[0]?.note).toBe('Imported from x.zip');
  });

  it('two concurrent creates with one name: one 200, one 409', async () => {
    const payload = body({ name: `race-${Date.now()}` });
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/skills', payload }),
      app.inject({ method: 'POST', url: '/skills', payload }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });

  it('GET /skills lists used_by with agent names', async () => {
    const s = await create();
    const [agent] = await agentIds();
    if (!agent) throw new Error('seed has no agents');
    await app.inject({ method: 'POST', url: `/agents/${agent.id}/skills`, payload: { skill_id: s.id } });
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as {
      id: string;
      used_by: { id: string; name: string }[];
    }[];
    expect(list.find((x) => x.id === s.id)?.used_by).toEqual([{ id: agent.id, name: agent.name }]);
  });

  it('delete cascades links and the agents stay', async () => {
    const s = await create();
    const agents = await agentIds();
    for (const a of agents) {
      await app.inject({ method: 'POST', url: `/agents/${a.id}/skills`, payload: { skill_id: s.id } });
    }
    const del = await app.inject({ method: 'DELETE', url: `/skills/${s.id}` });
    expect(del.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/skills/${s.id}` })).statusCode).toBe(404);
    for (const a of agents) {
      const links = (await app.inject({ method: 'GET', url: `/agents/${a.id}/skills` })).json() as {
        skill_id: string;
      }[];
      expect(links.some((l) => l.skill_id === s.id)).toBe(false);
      expect((await app.inject({ method: 'GET', url: `/agents/${a.id}` })).statusCode).toBe(200);
    }
  });

  it("404 for another workspace's skill", async () => {
    const db = pg.handle.db;
    const [ws] = await db.insert(t.workspaces).values({ name: `other-${Date.now()}` }).returning();
    if (!ws) throw new Error('no workspace');
    const [foreign] = await db
      .insert(t.skills)
      .values({ workspaceId: ws.id, name: 'foreign', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();
    if (!foreign) throw new Error('no skill');
    for (const [method, payload] of [
      ['GET', undefined],
      ['PUT', { enabled: false }],
      ['DELETE', undefined],
    ] as const) {
      const res = await app.inject({ method, url: `/skills/${foreign.id}`, payload });
      expect(res.statusCode).toBe(404);
    }
    expect((await app.inject({ method: 'GET', url: `/skills/${foreign.id}/versions` })).statusCode).toBe(404);
    const [still] = await db.select().from(t.skills).where(eq(t.skills.id, foreign.id));
    expect(still?.enabled).toBe(true);
  });

  const preview = (filename: string, bytes: Buffer) =>
    app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename, content_base64: bytes.toString('base64') },
    });

  it('import preview writes nothing', async () => {
    const before = await pg.handle.db.select().from(t.skills);
    const res = await preview('rule.md', Buffer.from('---\nname: imported-rule\ndescription: Do it.\n---\nBody'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      draft: { name: 'imported-rule', description: 'Do it.', body: 'Body', source: 'imported_file' },
    });
    const after = await pg.handle.db.select().from(t.skills);
    expect(after).toHaveLength(before.length);
  });

  it('a 1 MiB file sent as base64 gets a preview, not 413', async () => {
    const res = await preview('big.md', Buffer.alloc(MAX_UPLOAD_BYTES, 'a'));
    expect(res.statusCode).toBe(200);
    expect((res.json() as { warnings: string[] }).warnings).toHaveLength(1);
  });

  it('one byte over 1 MiB is 413 payload_too_large', async () => {
    const res = await preview('big.md', Buffer.alloc(MAX_UPLOAD_BYTES + 1, 'a'));
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ error: { code: 'payload_too_large' } });
  });

  it('saving an imported draft keeps source imported_file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: body({ source: 'imported_file' }),
    });
    expect(res.json()).toMatchObject({ source: 'imported_file' });
  });
});
