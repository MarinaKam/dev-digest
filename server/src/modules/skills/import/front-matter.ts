/**
 * Reads `name` and `description` from a skill's YAML-style front matter without
 * a YAML library. It understands plain, quoted and block (`>` / `|`) values and
 * refuses to guess anything else: such a key is reported, never filled in.
 */

export interface FrontMatterIssue {
  key: string;
  line: number;
  reason: string;
}

export interface FrontMatter {
  fields: { name?: string; description?: string };
  body: string;
  ignoredKeys: string[];
  unreadable: FrontMatterIssue[];
}

type FieldKey = 'name' | 'description';

const READ_KEYS: readonly FieldKey[] = ['name', 'description'];
const DELIMITER = '---';
const KEY_LINE = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/;
const BLOCK_HEADER = /^([>|])([+-]?)$/;

type ValueResult = { value: string; next: number } | { error: string; next: number };

/** Parse the front matter at the top of `md`, if any. Lines are 1-based in issues. */
export function parseFrontMatter(md: string): FrontMatter {
  const lines = md.split(/\r?\n/);
  if (lines[0]?.trim() !== DELIMITER) return { fields: {}, body: md, ignoredKeys: [], unreadable: [] };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === DELIMITER);
  if (end === -1) {
    return {
      fields: {},
      body: md,
      ignoredKeys: [],
      unreadable: [{ key: DELIMITER, line: 1, reason: 'front matter is never closed' }],
    };
  }
  const header = lines.slice(1, end);
  const result: FrontMatter = {
    fields: {},
    body: lines.slice(end + 1).join('\n'),
    ignoredKeys: [],
    unreadable: [],
  };
  let i = 0;
  while (i < header.length) {
    const raw = header[i] ?? '';
    const lineNo = i + 2;
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) {
      i++;
      continue;
    }
    const match = KEY_LINE.exec(raw);
    if (!match) {
      result.unreadable.push({ key: raw.trim(), line: lineNo, reason: 'not a top-level key' });
      i = skipIndented(header, i + 1);
      continue;
    }
    const key = match[1] ?? '';
    const rest = (match[2] ?? '').trim();
    const parsed = readValue(rest, header, i + 1);
    if (!isFieldKey(key)) {
      result.ignoredKeys.push(key);
    } else if ('error' in parsed) {
      result.unreadable.push({ key, line: lineNo, reason: parsed.error });
    } else {
      result.fields = { ...result.fields, [key]: parsed.value };
    }
    i = parsed.next;
  }
  return result;
}

function isFieldKey(key: string): key is FieldKey {
  return (READ_KEYS as readonly string[]).includes(key);
}

/** Read the value that starts after `key:`; `next` is the header index after it. */
function readValue(rest: string, header: string[], next: number): ValueResult {
  if (rest === '') {
    const after = skipIndented(header, next);
    return after > next
      ? { error: 'nested values are not supported', next: after }
      : { value: '', next };
  }
  const block = BLOCK_HEADER.exec(rest);
  if (block) return readBlock(block[1] as '>' | '|', block[2] ?? '', header, next);
  if (rest.startsWith('"')) return withNext(readDoubleQuoted(rest), next);
  if (rest.startsWith("'")) return withNext(readSingleQuoted(rest), next);
  if (/^[[{&*!|>@`]/.test(rest)) return { error: `"${rest[0]}" values are not supported`, next };
  return { value: stripComment(rest), next };
}

function withNext(r: { value: string } | { error: string }, next: number): ValueResult {
  return { ...r, next };
}

function readDoubleQuoted(rest: string): { value: string } | { error: string } {
  let out = '';
  for (let i = 1; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === '"') return trailingOk(rest.slice(i + 1)) ? { value: out } : { error: 'text after the closing quote' };
    if (ch === '\\') {
      const esc = rest[i + 1];
      const mapped = esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === '"' || esc === '\\' ? esc : undefined;
      if (mapped === undefined) return { error: `unsupported escape \\${esc ?? ''}` };
      out += mapped;
      i++;
      continue;
    }
    out += ch;
  }
  return { error: 'the quote is never closed' };
}

function readSingleQuoted(rest: string): { value: string } | { error: string } {
  let out = '';
  for (let i = 1; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === "'") {
      if (rest[i + 1] === "'") {
        out += "'";
        i++;
        continue;
      }
      return trailingOk(rest.slice(i + 1)) ? { value: out } : { error: 'text after the closing quote' };
    }
    out += ch;
  }
  return { error: 'the quote is never closed' };
}

function trailingOk(tail: string): boolean {
  const t = tail.trim();
  return t === '' || t.startsWith('#');
}

function stripComment(value: string): string {
  const at = value.search(/\s#/);
  return (at === -1 ? value : value.slice(0, at)).trim();
}

/** Index of the first line at or after `from` that is not indented (blank lines count as indented). */
function skipIndented(header: string[], from: number): number {
  let i = from;
  while (i < header.length && (/^\s/.test(header[i] ?? '') || (header[i] ?? '') === '')) i++;
  return i;
}

/** A `>` or `|` block: the indented lines after the key, with chomping. */
function readBlock(style: '>' | '|', chomp: string, header: string[], from: number): ValueResult {
  const indentedEnd = skipIndented(header, from);
  const first = header.slice(from, indentedEnd).find((l) => l.trim() !== '');
  if (first === undefined) return { error: 'the block has no indented line', next: indentedEnd };
  const indent = (/^\s*/.exec(first)?.[0] ?? '').length;
  // The block ends at the first non-blank line indented less than its first line.
  let end = from;
  while (end < indentedEnd) {
    const l = header[end] ?? '';
    if (l.trim() !== '' && (/^\s*/.exec(l)?.[0] ?? '').length < indent) break;
    end++;
  }
  const lines = header.slice(from, end);
  const content = lines.map((l) => (l.trim() === '' ? '' : l.slice(indent)));
  const lastText = content.reduce((acc, l, idx) => (l !== '' ? idx : acc), -1);
  const text = content.slice(0, lastText + 1);
  const trailingBlank = content.length - (lastText + 1);
  const joined = style === '|' ? text.join('\n') : fold(text);
  const value =
    chomp === '-' ? joined : chomp === '+' ? `${joined}\n${'\n'.repeat(trailingBlank)}` : `${joined}\n`;
  return { value, next: end };
}

/** Folded style: lines join with a space; each blank line becomes a line break. */
function fold(lines: string[]): string {
  let out = '';
  let pendingBreaks = 0;
  for (const line of lines) {
    if (line === '') {
      pendingBreaks++;
      continue;
    }
    if (out === '') out = line;
    else out += pendingBreaks > 0 ? '\n'.repeat(pendingBreaks) + line : ` ${line}`;
    pendingBreaks = 0;
  }
  return out;
}
