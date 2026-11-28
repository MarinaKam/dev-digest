import { describe, it, expect } from 'vitest';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { readSkillArchive } from '../src/modules/skills/import/archive.js';
import { buildImportPreview } from '../src/modules/skills/import/preview.js';
import { MAX_CORE_BYTES, MAX_ZIP_ENTRIES } from '../src/modules/skills/constants.js';

const zip = (files: Record<string, string>): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(files).map(([p, c]) => [p, strToU8(c)])) as Zippable);

const status = (fn: () => unknown): number | undefined => {
  try {
    fn();
    return undefined;
  } catch (err) {
    return (err as { statusCode?: number }).statusCode;
  }
};

describe('readSkillArchive', () => {
  it('takes SKILL.md at the root and skips everything else', () => {
    const r = readSkillArchive(
      zip({ 'SKILL.md': '# core', 'run.sh': 'rm -rf /', 'bin/tool': 'x', 'notes.md': 'n' }),
    );
    expect(r.corePath).toBe('SKILL.md');
    expect(r.core).toBe('# core');
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { path: 'run.sh', reason: 'not_markdown' },
        { path: 'bin/tool', reason: 'not_markdown' },
        { path: 'notes.md', reason: 'extra_markdown' },
      ]),
    );
    expect(r.skipped).toHaveLength(3);
  });

  it('finds the core in the single top-level folder', () => {
    const r = readSkillArchive(zip({ 'my-skill/SKILL.md': 'core', 'my-skill/scripts/a.py': 'x' }));
    expect(r.corePath).toBe('my-skill/SKILL.md');
  });

  it('does not take a SKILL.md two folders deep', () => {
    expect(status(() => readSkillArchive(zip({ 'a/b/SKILL.md': 'x', 'a/c.md': 'y', 'd.md': 'z' })))).toBe(422);
  });

  it('uses the only markdown file when there is no SKILL.md', () => {
    const r = readSkillArchive(zip({ 'rule.md': 'only', 'x.sh': 'y' }));
    expect(r.corePath).toBe('rule.md');
  });

  it('is 422 when several .md and no SKILL.md', () => {
    expect(status(() => readSkillArchive(zip({ 'README.md': 'a', 'rule.md': 'b' })))).toBe(422);
  });

  it.each(['../evil.md', '/abs.md', 'a/../../b.md'])('is 422 for the entry path %s', (path) => {
    expect(status(() => readSkillArchive(zip({ 'SKILL.md': 'x', [path]: 'y' })))).toBe(422);
  });

  it('is 422 above the entry limit', () => {
    const files: Record<string, string> = { 'SKILL.md': 'x' };
    for (let i = 0; i < MAX_ZIP_ENTRIES; i++) files[`f${i}.txt`] = 'y';
    expect(status(() => readSkillArchive(zip(files)))).toBe(422);
  });

  it('is 413 when the core is over the size limit', () => {
    expect(status(() => readSkillArchive(zip({ 'SKILL.md': 'x'.repeat(MAX_CORE_BYTES + 1) })))).toBe(413);
  });

  it('is 422 when two entries share a name', () => {
    // A small SKILL.md first, then a second entry renamed to the same name.
    const dup = zipSync({ 'SKILL.md': strToU8('small'), 'SKILL.mx': strToU8('x'.repeat(10)) });
    renameEntry(dup, 'SKILL.mx', 'SKILL.md');
    expect(status(() => readSkillArchive(dup))).toBe(422);
  });

  it('is 413 when the core is bigger than its header claims', () => {
    const lying = zipSync({ 'SKILL.md': strToU8('x'.repeat(MAX_CORE_BYTES * 3)) });
    setDeclaredSize(lying, 'SKILL.md', 10);
    expect(status(() => readSkillArchive(lying))).toBe(413);
  });

  it('stops a highly compressible core early with 413', () => {
    // 64 MiB of zeros deflates to ~64 KB; it must not be inflated in one piece.
    const bomb = zipSync({ 'SKILL.md': new Uint8Array(64 * 1024 * 1024) }, { level: 9 });
    setDeclaredSize(bomb, 'SKILL.md', 10);
    let calls = 0;
    const seen: number[] = [];
    expect(status(() => readSkillArchive(bomb, {
      onChunk: (n: number) => {
        calls++;
        seen.push(n);
      },
    }))).toBe(413);
    // Every inflated chunk stays far below the whole payload, and work stops right after the limit.
    expect(Math.max(...seen)).toBeLessThan(32 * 1024 * 1024);
    expect(seen.slice(0, -1).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_CORE_BYTES);
    expect(calls).toBeGreaterThan(0);
  });

  it('is 422 for bytes that are not a zip', () => {
    expect(status(() => readSkillArchive(strToU8('not a zip')))).toBe(422);
  });

  it('never inflates a non-markdown entry', () => {
    // A corrupt payload under a script name: inflating it would throw.
    const bytes = zip({ 'SKILL.md': 'core', 'payload.bin': 'z'.repeat(5000) });
    const corrupt = corruptEntryData(bytes, 'payload.bin');
    expect(readSkillArchive(corrupt).core).toBe('core');
  });
});

describe('buildImportPreview', () => {
  const md = (s: string) => strToU8(s);

  it('builds a draft from a markdown file', () => {
    const p = buildImportPreview(
      'Edge Case.md',
      md('---\ndescription: Flag it.\nversion: 3\n---\nBody'),
    );
    expect(p.draft).toEqual({
      name: 'edge-case',
      description: 'Flag it.',
      type: 'custom',
      body: 'Body',
      source: 'imported_file',
    });
    expect(p.core_path).toBe('Edge Case.md');
    expect(p.ignored_keys).toEqual(['version']);
    expect(p.warnings).toEqual([]);
  });

  it('prefers the name from front matter', () => {
    expect(buildImportPreview('x.md', md('---\nname: my-rule\n---\nB')).draft.name).toBe('my-rule');
  });

  it('warns when the body is over 20,000 characters', () => {
    const p = buildImportPreview('x.md', md('b'.repeat(20_001)));
    expect(p.warnings).toHaveLength(1);
    expect(p.warnings[0]).toMatch(/20,000/);
  });

  it('builds a draft from a zip and lists the skipped files', () => {
    const p = buildImportPreview('s.zip', zip({ 'SKILL.md': '---\nname: z\n---\nB', 'run.sh': 'x' }));
    expect(p.draft.name).toBe('z');
    expect(p.skipped_files).toEqual([{ path: 'run.sh', reason: 'not_markdown' }]);
  });

  it('is 422 for another extension', () => {
    expect(status(() => buildImportPreview('x.exe', md('x')))).toBe(422);
  });
});

/** Offsets of the local (`PK\x03\x04`) and central (`PK\x01\x02`) headers of an entry. */
function headersOf(bytes: Uint8Array, name: string): { local: number[]; central: number[] } {
  const target = strToU8(name);
  const local: number[] = [];
  const central: number[] = [];
  const nameAt = (start: number, len: number) => {
    const e = bytes.subarray(start, start + len);
    return e.length === target.length && e.every((b, k) => b === target[k]);
  };
  const u16 = (at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
  for (let i = 0; i < bytes.length - 46; i++) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b) continue;
    if (bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04 && nameAt(i + 30, u16(i + 26))) local.push(i);
    if (bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02 && nameAt(i + 46, u16(i + 28))) central.push(i);
  }
  return { local, central };
}

/** Rename an entry in place (same length), in both headers. */
function renameEntry(bytes: Uint8Array, from: string, to: string): void {
  const { local, central } = headersOf(bytes, from);
  const next = strToU8(to);
  for (const at of local) bytes.set(next, at + 30);
  for (const at of central) bytes.set(next, at + 46);
}

/** Make both headers claim `size` uncompressed bytes. */
function setDeclaredSize(bytes: Uint8Array, name: string, size: number): void {
  const { local, central } = headersOf(bytes, name);
  const le = [size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff];
  for (const at of local) bytes.set(le, at + 22);
  for (const at of central) bytes.set(le, at + 24);
}

/** Overwrite the stored data of one entry with garbage, keeping the zip readable. */
function corruptEntryData(bytes: Uint8Array, name: string): Uint8Array {
  const out = bytes.slice();
  const nameBytes = strToU8(name);
  for (let i = 0; i < out.length - 30; i++) {
    // Local file header signature 0x04034b50.
    if (out[i] !== 0x50 || out[i + 1] !== 0x4b || out[i + 2] !== 0x03 || out[i + 3] !== 0x04) continue;
    const nameLen = (out[i + 26] ?? 0) | ((out[i + 27] ?? 0) << 8);
    const extraLen = (out[i + 28] ?? 0) | ((out[i + 29] ?? 0) << 8);
    const entry = out.subarray(i + 30, i + 30 + nameLen);
    if (entry.length !== nameBytes.length || !entry.every((b, k) => b === nameBytes[k])) continue;
    const dataStart = i + 30 + nameLen + extraLen;
    for (let k = 0; k < 16; k++) out[dataStart + k] = 0xff;
    return out;
  }
  throw new Error(`entry ${name} not found`);
}
