import {
  CONVENTION_RULE_MAX,
  FEATURE_MODELS,
  type ConventionCandidate,
  type ConventionScan,
  type FeatureModelChoice,
  type Provider,
} from '@devdigest/shared';
import { CHEAP_MODELS, MAX_FILE_CHARS, MAX_FILE_LINES } from './constants.js';
import type {
  ConventionRecord,
  ConventionScanRecord,
  GroundedConvention,
  RawConvention,
  SampledFile,
  SnippetMatch,
} from './types.js';

/** Map a stored convention to the public DTO. */
export function toConventionDto(row: ConventionRecord): ConventionCandidate {
  return {
    id: row.id,
    repo_id: row.repoId,
    rule: row.rule,
    evidence_path: row.evidencePath,
    evidence_snippet: row.evidenceSnippet,
    evidence_line_start: row.evidenceLineStart,
    evidence_line_end: row.evidenceLineEnd,
    evidence_sha: row.evidenceSha,
    confidence: row.confidence,
    accepted: row.status === 'accepted',
    status: row.status,
  };
}

/** Map a stored run to the public DTO. */
export function toScanDto(row: ConventionScanRecord): ConventionScan {
  return {
    at: row.createdAt.toISOString(),
    sampling: row.sampling,
    files_sampled: row.filesSampled,
    proposed: row.proposed,
    kept: row.kept,
    added: row.added,
    model: row.model,
    cost_usd: row.costUsd,
  };
}

/** The registry default for the `conventions` feature (shared `FEATURE_MODELS`). */
export function conventionsRegistryDefault(): FeatureModelChoice {
  const def = FEATURE_MODELS.find((f) => f.id === 'conventions');
  if (!def) throw new Error('FEATURE_MODELS has no conventions entry');
  return { provider: def.defaultProvider, model: def.defaultModel };
}

/** A rule's identity for de-duplication: lowercase, single spaces, no final dot. */
export function normaliseRule(rule: string): string {
  return rule.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
}

/**
 * A repo-relative path the model may see and cite: no absolute path, no `..`,
 * no backslash, and no character that could end the prompt's `source="…"`
 * label or start a tag (quotes, angle brackets, backticks, control chars). A
 * repository names its files, so a name is untrusted text like the content.
 */
export function isSafeRelativePath(path: string): boolean {
  if (!path || [...path].some(isUnsafePathChar)) return false;
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return false;
  return path.split('/').every((part) => part !== '..' && part !== '');
}

/** A control character, a quote, an angle bracket, a backtick or a backslash. */
function isUnsafePathChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code < 0x20 || code === 0x7f || `"'<>\`\\`.includes(ch);
}

/** The head of a file as sent to the model: at most MAX_FILE_LINES lines and MAX_FILE_CHARS characters. */
export function truncateForPrompt(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').slice(0, MAX_FILE_LINES);
  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > MAX_FILE_CHARS) break;
    kept.push(line);
    size += line.length + 1;
  }
  return kept.join('\n');
}

/** Prefix every line with its 1-based number, so the model can cite a range. */
export function numberLines(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `${i + 1}| ${line}`)
    .join('\n');
}

/** A line compared without any whitespace: indentation and spacing do not count. */
function squash(line: string): string {
  return line.replace(/\s+/g, '');
}

/** An elision line the model may put between two quoted parts. */
function isElision(line: string): boolean {
  return /^(\.\.\.|…|\/\/\s*\.\.\.|\/\*\s*\.\.\.\s*\*\/)$/.test(line.trim());
}

/** The snippet as runs of non-blank lines, split where the model wrote `...`. */
function snippetSegments(snippet: string): string[][] {
  const segments: string[][] = [[]];
  for (const raw of snippet.replace(/\r\n?/g, '\n').split('\n')) {
    if (isElision(raw)) {
      segments.push([]);
      continue;
    }
    const line = squash(stripLineNumber(raw));
    if (line) segments[segments.length - 1]?.push(line);
  }
  return segments.filter((s) => s.length > 0);
}

/** Drop a `12| ` prefix the model may have copied from the numbered prompt. */
function stripLineNumber(line: string): string {
  return line.replace(/^\s*\d+\|\s?/, '');
}

/** Indexes (0-based, into the file's lines) where `segment` matches non-blank lines in a row. */
function segmentMatches(fileLines: string[], segment: string[], from: number): Array<{ first: number; last: number }> {
  const nonBlank: number[] = [];
  for (let i = from; i < fileLines.length; i += 1) {
    if (squash(fileLines[i] ?? '')) nonBlank.push(i);
  }
  const hits: Array<{ first: number; last: number }> = [];
  for (let k = 0; k + segment.length <= nonBlank.length; k += 1) {
    const ok = segment.every((line, j) => squash(fileLines[nonBlank[k + j] ?? -1] ?? '') === line);
    if (ok) hits.push({ first: nonBlank[k] ?? 0, last: nonBlank[k + segment.length - 1] ?? 0 });
  }
  return hits;
}

/**
 * Find `snippet` in `fileText` ignoring whitespace and blank lines. Parts split
 * by `...` must appear in order. Of several places, the one closest to
 * `hintStart` (the line the model cited) wins. Returns the file's own lines.
 */
export function locateSnippet(fileText: string, snippet: string, hintStart: number): SnippetMatch | null {
  const segments = snippetSegments(snippet);
  if (segments.length === 0) return null;
  const fileLines = fileText.replace(/\r\n?/g, '\n').split('\n');
  const [first, ...rest] = segments;
  if (!first) return null;
  const starts = segmentMatches(fileLines, first, 0).sort(
    (a, b) => Math.abs(a.first + 1 - hintStart) - Math.abs(b.first + 1 - hintStart),
  );
  for (const start of starts) {
    let last = start.last;
    const allFound = rest.every((segment) => {
      const next = segmentMatches(fileLines, segment, last + 1)[0];
      if (!next) return false;
      last = next.last;
      return true;
    });
    if (allFound) {
      return { start: start.first + 1, end: last + 1, text: fileLines.slice(start.first, last + 1).join('\n') };
    }
  }
  return null;
}

/**
 * The evidence check (spec 004, step 4). Keeps a rule only when its path is one
 * of the files sent and its snippet is found in that file; stores the file's
 * real lines. Repeated rules collapse to the first. Pure: no model, no I/O.
 */
export function groundConventions(
  raw: readonly RawConvention[],
  files: readonly SampledFile[],
): { kept: GroundedConvention[]; dropped: number } {
  const byPath = new Map(files.map((f) => [f.path, f.text]));
  const seen = new Set<string>();
  const kept: GroundedConvention[] = [];
  for (const candidate of raw) {
    const rule = candidate.rule.replace(/\s+/g, ' ').trim().slice(0, CONVENTION_RULE_MAX);
    const path = candidate.evidence_path.trim().replace(/^\.\//, '');
    const key = normaliseRule(rule);
    if (!key || seen.has(key) || !isSafeRelativePath(path)) continue;
    const text = byPath.get(path);
    if (text === undefined) continue;
    const match = locateSnippet(text, candidate.evidence_snippet, candidate.line_start);
    if (!match) continue;
    seen.add(key);
    kept.push({
      rule,
      evidencePath: path,
      evidenceSnippet: match.text,
      evidenceLineStart: match.start,
      evidenceLineEnd: match.end,
      confidence: clamp01(candidate.confidence),
    });
  }
  return { kept, dropped: raw.length - kept.length };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The model for a run: the workspace's choice, else the registry default when
 * its provider has a key, else the first cheap model whose provider has one.
 * `null` only when no provider has a key.
 */
export function pickExtractionModel(
  override: FeatureModelChoice | undefined,
  registryDefault: FeatureModelChoice,
  hasKey: ReadonlySet<Provider>,
): FeatureModelChoice | null {
  if (override) return override;
  if (hasKey.has(registryDefault.provider)) return registryDefault;
  return CHEAP_MODELS.find((m) => hasKey.has(m.provider)) ?? null;
}
