import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';

/**
 * Read one file of a repository clone as text.
 *
 * Invariant: the server reads only a regular file whose real path (after every
 * symlink is resolved) is inside the real path of the clone. A repository is
 * written by whoever pushed to it, so a path may be a symlink (`package.json`
 * -> `../../.env`), sit under a symlinked folder, or climb out with `..`; any
 * of them would send a file of this machine to the model provider. Such a
 * path throws, like a missing file, so every caller's "unreadable" branch
 * handles it.
 */
export async function readCloneFile(clonePath: string, relPath: string): Promise<string> {
  if (isAbsolute(relPath) || relPath.includes('\0')) {
    throw new Error(`Refused to read ${relPath}: not a path inside the clone`);
  }
  const root = await realpath(clonePath);
  const target = await realpath(join(root, relPath));
  if (!target.startsWith(root + sep)) {
    throw new Error(`Refused to read ${relPath}: it resolves outside the clone`);
  }
  const info = await stat(target);
  if (!info.isFile()) {
    throw new Error(`Refused to read ${relPath}: not a regular file`);
  }
  return readFile(target, 'utf8');
}
