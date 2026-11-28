import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const TEST_QUALITY = [
  'uncovered-branch-detector',
  'edge-case-coverage',
  'mock-overuse-gate',
  'flaky-test-patterns',
];
const API_CONTRACT = ['route-signature-breaking-change', 'response-shape-compat'];

/** The seed adds the two skill-driven reviewers and links their skills, idempotently. */
d('seed: Test Quality and API Contract reviewers', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function linkedNames(agentName: string): Promise<string[]> {
    const rows = await pg.handle.db
      .select({ name: t.skills.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agents.name, agentName))
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => r.name);
  }

  it('seeding twice leaves 5 agents, 6 skills, 6 links and 6 versions', async () => {
    const db = pg.handle.db;
    expect(await db.select().from(t.agents)).toHaveLength(5);
    expect(await db.select().from(t.skills)).toHaveLength(6);
    expect(await db.select().from(t.agentSkills)).toHaveLength(6);
    expect(await db.select().from(t.skillVersions)).toHaveLength(6);
  });

  it('links the Test Quality skills in order', async () => {
    expect(await linkedNames('Test Quality Reviewer')).toEqual(TEST_QUALITY);
  });

  it('links the API Contract skills in order', async () => {
    expect(await linkedNames('API Contract Reviewer')).toEqual(API_CONTRACT);
  });

  it('every seeded skill is enabled, manual, v1, with a description within 1024 characters', async () => {
    const skills = await pg.handle.db.select().from(t.skills);
    for (const s of skills) {
      expect(s).toMatchObject({ enabled: true, source: 'manual', version: 1 });
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.description.length).toBeLessThanOrEqual(1024);
      expect(s.body.length).toBeLessThanOrEqual(20_000);
    }
  });
});

/** A seed that fails while linking an agent's skills leaves no half-made agent behind. */
d('seed: an agent and its skills are created together', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('a failure on the links rolls the agent back, and the next seed completes it', async () => {
    const sql = pg.handle.sql;
    await sql.unsafe(
      "create function fault_links() returns trigger language plpgsql as $$ begin raise exception 'injected fault'; end $$; " +
        'create trigger fault_links before insert on agent_skills for each row execute function fault_links();',
    );
    await expect(seed(pg.handle.db)).rejects.toThrow();
    await sql.unsafe('drop trigger fault_links on agent_skills; drop function fault_links();');
    const half = await pg.handle.db.select().from(t.agents).where(eq(t.agents.name, 'Test Quality Reviewer'));
    expect(half).toHaveLength(0);

    await seed(pg.handle.db);
    const [agent] = await pg.handle.db.select().from(t.agents).where(eq(t.agents.name, 'Test Quality Reviewer'));
    if (!agent) throw new Error('agent not seeded');
    const links = await pg.handle.db.select().from(t.agentSkills).where(eq(t.agentSkills.agentId, agent.id));
    expect(links).toHaveLength(4);
  });
});

/** A reseed (dev.sh seeds on every start) keeps what the user changed. Own database: it mutates. */
d('seed: a reseed keeps the user changes', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function linkedNames(agentName: string): Promise<string[]> {
    const rows = await pg.handle.db
      .select({ name: t.skills.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agents.name, agentName))
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => r.name);
  }

  it('a reseed keeps the user unlinking and deleting seeded skills', async () => {
    const db = pg.handle.db;
    const [agent] = await db.select().from(t.agents).where(eq(t.agents.name, 'Test Quality Reviewer'));
    if (!agent) throw new Error('agent not seeded');
    await db.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agent.id));
    await db.delete(t.skills).where(eq(t.skills.name, 'flaky-test-patterns'));
    await seed(db);
    expect(await linkedNames('Test Quality Reviewer')).toEqual([]);
    expect(await db.select().from(t.skills).where(eq(t.skills.name, 'flaky-test-patterns'))).toHaveLength(0);
    expect(await linkedNames('API Contract Reviewer')).toEqual(API_CONTRACT);
  });
});
