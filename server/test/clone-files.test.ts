import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCloneFile } from '../src/platform/clone-files.js';
import { SimpleGitClient } from '../src/adapters/git/simple-git.js';

/**
 * A repository decides the names and the symlinks in its clone. Whatever it
 * commits, only regular files inside the clone may be read (the mutation
 * matrix of the symlink finding of spec 004).
 */
describe('readCloneFile: only regular files inside the clone', () => {
  let base: string;
  let clone: string;
  const SECRET = 'OPENROUTER_API_KEY=sk-should-never-leave';

  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'clone-files-'));
    clone = join(base, 'clones', 'acme', 'api');
    await mkdir(join(clone, 'src', 'real'), { recursive: true });
    await writeFile(join(base, '.env'), SECRET);
    await mkdir(join(base, 'outside'), { recursive: true });
    await writeFile(join(base, 'outside', 'secret.ts'), SECRET);
    await writeFile(join(clone, 'src', 'real', 'a.ts'), 'export const a = 1;');
    // What a malicious repository can commit:
    await symlink('../../../.env', join(clone, 'package.json')); // relative link out
    await symlink(join(base, '.env'), join(clone, 'tsconfig.json')); // absolute link out
    await symlink(join(base, 'outside'), join(clone, 'src', 'linked')); // folder link out
    await symlink('real/a.ts', join(clone, 'src', 'alias.ts')); // link that stays inside
    await symlink('missing.ts', join(clone, 'dangling.ts')); // link to nothing
  });
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it('reads a regular file, and a link whose target stays inside the clone', async () => {
    await expect(readCloneFile(clone, 'src/real/a.ts')).resolves.toBe('export const a = 1;');
    await expect(readCloneFile(clone, 'src/alias.ts')).resolves.toBe('export const a = 1;');
  });

  it.each([
    ['a relative symlink out of the clone', 'package.json'],
    ['an absolute symlink out of the clone', 'tsconfig.json'],
    ['a file under a symlinked folder', 'src/linked/secret.ts'],
    ['a path that climbs out with ..', '../../../.env'],
    ['a path that climbs out mid-way', 'src/../../../../.env'],
    ['an absolute path', '/etc/hosts'],
    ['a folder', 'src'],
    ['a dangling link', 'dangling.ts'],
    ['a missing file', 'nope.ts'],
  ])('refuses %s', async (_label, path) => {
    await expect(readCloneFile(clone, path)).rejects.toThrow();
  });

  it('the git adapter reads through the same check (the extractor reads config files by fixed name)', async () => {
    const git = new SimpleGitClient(join(base, 'clones'));
    const ref = { owner: 'acme', name: 'api' };
    await expect(git.readFile(ref, 'src/real/a.ts')).resolves.toBe('export const a = 1;');
    await expect(git.readFile(ref, 'package.json')).rejects.toThrow();
    await expect(git.readFile(ref, 'src/linked/secret.ts')).rejects.toThrow();
  });
});
