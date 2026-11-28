import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';

/**
 * `getConventionSamples` (spec 004): ranked files when the repo is indexed,
 * spread across folders on request, and a walk of the clone before the first
 * index. No Postgres: the repository is patched; the clone is a temp folder.
 */

function service(ranked: string[], clonePath: string | null): RepoIntelService {
  const container = { config: { repoIntelEnabled: true }, db: {} as never } as never;
  const svc = new RepoIntelService(container);
  (svc as unknown as { repo: Record<string, unknown> }).repo = {
    getRankedPaths: async () => ranked.map((path, i) => ({ path, rank: 1 - i / 100 })),
    getRepoBasics: async () =>
      clonePath ? { id: 'r1', owner: 'o', name: 'n', defaultBranch: 'main', clonePath } : null,
  };
  return svc;
}

describe('getConventionSamples', () => {
  let clone: string;

  beforeAll(async () => {
    clone = await mkdtemp(join(tmpdir(), 'conv-samples-'));
    const files: Record<string, string> = {
      'src/a/one.ts': 'export const one = 1;',
      'src/a/two.ts': 'export const two = 2;',
      'src/b/three.ts': 'export const three = 3;',
      'src/b/three.test.ts': 'test',
      'eslint.config.js': 'export default [];',
    };
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(clone, path, '..'), { recursive: true });
      await writeFile(join(clone, path), text);
    }
  });

  afterAll(async () => {
    await rm(clone, { recursive: true, force: true });
  });

  it('returns the top ranked files, minus tests and configs', async () => {
    const svc = service(['src/a/one.ts', 'src/a/one.test.ts', 'src/a/two.ts', 'src/b/x.ts'], clone);
    await expect(svc.getConventionSamples('r1', 2)).resolves.toEqual(['src/a/one.ts', 'src/a/two.ts']);
  });

  it('with spread, takes the best file of each folder first', async () => {
    const svc = service(['src/a/one.ts', 'src/a/two.ts', 'src/b/x.ts'], clone);
    await expect(svc.getConventionSamples('r1', 2, { spread: true })).resolves.toEqual([
      'src/a/one.ts',
      'src/b/x.ts',
    ]);
  });

  it('before the first index, walks the clone and spreads across folders', async () => {
    const svc = service([], clone);
    await expect(svc.getConventionSamples('r1', 2)).resolves.toEqual(['src/a/one.ts', 'src/b/three.ts']);
  });

  it('without a clone, returns [] and does not throw', async () => {
    await expect(service([], null).getConventionSamples('r1', 5)).resolves.toEqual([]);
    await expect(service([], '/nonexistent/clone/path').getConventionSamples('r1', 5)).resolves.toEqual([]);
  });
});
