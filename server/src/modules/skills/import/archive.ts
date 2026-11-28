/**
 * Reads the core of a skill archive in memory. Nothing is written to disk and
 * nothing is run: every entry is listed by name first, and only the chosen
 * markdown core is ever decompressed.
 */
import { strFromU8, unzipSync } from 'fflate';
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
  name: string;
  originalSize: number;
}

/** Pick and decompress the skill core of a `.zip`; throw 422 / 413 on a bad archive. */
export function readSkillArchive(bytes: Uint8Array): SkillArchive {
  const entries = listEntries(bytes);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new ValidationError(`The archive has more than ${MAX_ZIP_ENTRIES} entries`);
  }
  for (const e of entries) assertSafePath(e.name);
  const files = entries.filter((e) => !e.name.endsWith('/'));
  const core = pickCore(files);
  if (core.originalSize > MAX_CORE_BYTES) {
    throw new PayloadTooLargeError(`${core.name} is larger than ${MAX_CORE_BYTES} bytes`);
  }
  const inflated = unzipOnly(bytes, core.name);
  if (inflated.length > MAX_CORE_BYTES) {
    throw new PayloadTooLargeError(`${core.name} is larger than ${MAX_CORE_BYTES} bytes`);
  }
  const skipped = files
    .filter((f) => f.name !== core.name)
    .map((f): SkippedFile => ({ path: f.name, reason: isMarkdown(f.name) ? 'extra_markdown' : 'not_markdown' }));
  return { corePath: core.name, core: strFromU8(inflated), skipped };
}

/** Every entry's name and declared size, without decompressing any of them. */
function listEntries(bytes: Uint8Array): EntryInfo[] {
  const entries: EntryInfo[] = [];
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({ name: file.name, originalSize: file.originalSize });
        return false;
      },
    });
  } catch (err) {
    throw new ValidationError('The file is not a readable zip archive', { cause: (err as Error).message });
  }
  return entries;
}

function unzipOnly(bytes: Uint8Array, name: string): Uint8Array {
  try {
    const out = unzipSync(bytes, { filter: (file) => file.name === name });
    const data = out[name];
    if (!data) throw new Error('entry missing after decompression');
    return data;
  } catch (err) {
    throw new ValidationError(`Could not decompress ${name}`, { cause: (err as Error).message });
  }
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
