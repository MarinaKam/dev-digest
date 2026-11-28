/**
 * Reads the core of a skill archive in memory. Nothing is written to disk and
 * nothing is run: one pass lists every entry by name, and a second pass
 * decompresses only the chosen markdown core, counting the bytes it actually
 * produces, so a header that lies about its size cannot get past the limit.
 * Both passes read the same local headers, in the same order.
 */
import { strFromU8, Unzip, UnzipInflate, type UnzipFile } from 'fflate';
import { PayloadTooLargeError, ValidationError } from '../../../platform/errors.js';
import { MAX_CORE_BYTES, MAX_ZIP_ENTRIES, SKILL_CORE_FILE } from '../constants.js';

export interface SkippedFile {
  path: string;
  reason: 'not_markdown' | 'extra_markdown';
}

export interface SkillArchive {
  corePath: string;
  core: string;
  skipped: SkippedFile[];
}

interface EntryInfo {
  index: number;
  name: string;
}

/** Pick and decompress the skill core of a `.zip`; throw 422 / 413 on a bad archive. */
export function readSkillArchive(bytes: Uint8Array): SkillArchive {
  const entries = listEntries(bytes);
  const files = entries.filter((e) => !e.name.endsWith('/'));
  const core = pickCore(files);
  const inflated = inflateEntry(bytes, core);
  const skipped = files
    .filter((f) => f.index !== core.index)
    .map((f): SkippedFile => ({ path: f.name, reason: isMarkdown(f.name) ? 'extra_markdown' : 'not_markdown' }));
  return { corePath: core.name, core: strFromU8(inflated), skipped };
}

/** Run one streaming pass; `onEntry` sees each entry in order and may start it. */
function streamEntries(bytes: Uint8Array, onEntry: (file: UnzipFile, index: number) => void): void {
  let index = 0;
  const unzip = new Unzip((file) => {
    onEntry(file, index);
    index++;
  });
  unzip.register(UnzipInflate);
  try {
    unzip.push(bytes, true);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof PayloadTooLargeError) throw err;
    throw new ValidationError('The file is not a readable zip archive', { cause: (err as Error).message });
  }
}

/** Every entry's name, without decompressing any; stops at the entry limit. */
function listEntries(bytes: Uint8Array): EntryInfo[] {
  const entries: EntryInfo[] = [];
  const seen = new Set<string>();
  streamEntries(bytes, (file, index) => {
    if (index >= MAX_ZIP_ENTRIES) {
      throw new ValidationError(`The archive has more than ${MAX_ZIP_ENTRIES} entries`);
    }
    assertSafePath(file.name);
    if (seen.has(file.name)) throw new ValidationError(`The archive lists ${file.name} twice`);
    seen.add(file.name);
    entries.push({ index, name: file.name });
  });
  if (entries.length === 0) throw new ValidationError('The file is not a readable zip archive');
  return entries;
}

/** Decompress only the entry at `target.index`, aborting past `MAX_CORE_BYTES`. */
function inflateEntry(bytes: Uint8Array, target: EntryInfo): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  let failure: Error | undefined;
  streamEntries(bytes, (file, index) => {
    if (index !== target.index) return;
    if (file.name !== target.name) throw new ValidationError('The archive changed between reads');
    if ((file.originalSize ?? 0) > MAX_CORE_BYTES) throw tooLarge(target.name);
    file.ondata = (err, chunk, final) => {
      if (failure) return;
      if (err) {
        failure = new ValidationError(`Could not decompress ${target.name}`, { cause: err.message });
        return;
      }
      total += chunk.length;
      if (total > MAX_CORE_BYTES) {
        failure = tooLarge(target.name);
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) done = true;
    };
    file.start();
  });
  if (failure) throw failure;
  if (!done) throw new ValidationError(`Could not decompress ${target.name}`);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function tooLarge(name: string): PayloadTooLargeError {
  return new PayloadTooLargeError(`${name} is larger than ${MAX_CORE_BYTES} bytes`);
}

function assertSafePath(name: string): void {
  const parts = name.split(/[\\/]/);
  if (name.startsWith('/') || name.startsWith('\\') || /^[A-Za-z]:/.test(name) || parts.includes('..')) {
    throw new ValidationError(`The archive contains an unsafe path: ${name}`);
  }
}

function isMarkdown(name: string): boolean {
  return name.toLowerCase().endsWith('.md');
}

/** `SKILL.md` at the root or in the one top-level folder; else the only `.md`. */
function pickCore(files: EntryInfo[]): EntryInfo {
  const atRoot = files.find((f) => f.name === SKILL_CORE_FILE);
  if (atRoot) return atRoot;
  const topFolders = new Set(files.map((f) => (f.name.includes('/') ? f.name.split('/')[0] : '')));
  if (topFolders.size === 1) {
    const [folder] = [...topFolders];
    const nested = files.find((f) => f.name === `${folder}/${SKILL_CORE_FILE}`);
    if (nested) return nested;
  }
  const markdown = files.filter((f) => isMarkdown(f.name));
  if (markdown.length === 1 && markdown[0]) return markdown[0];
  throw new ValidationError(
    `The archive has no ${SKILL_CORE_FILE} and ${markdown.length} markdown files; expected exactly one`,
  );
}
