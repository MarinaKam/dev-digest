// Pure logic of the pr-self-review gate. No file system, no git, no process access:
// everything here is tested in lib.test.mjs. The I/O lives in gate.mjs.
import { createHash } from 'node:crypto';

export const OVERRIDE_VARIABLE = 'PR_SELF_REVIEW_OVERRIDE';
export const SEVERITIES = ['critical', 'warning', 'note'];
export const CHECK_STATUSES = ['pass', 'fail', 'not_run'];

const DOC_FILE = /\.md$/i;
const INSTRUCTION_FILE = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/;
const TEST_FILE = /(\.|\/)(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|e2e)\//;
const FRONTEND_FILE = /\.(tsx|jsx|css|scss)$/i;

// A single-quoted text does not cross a line end here. In a shell it can, but an apostrophe in
// a comment or in a here-document would then hide every command up to the next apostrophe.
const ESCAPED_OR_QUOTED = /\\.|'[^'\n]*'|"(?:\\.|[^"\\])*"/gs;
const SEGMENT_BREAK = /[;&|()`\n]+/g;
const GIT_VALUE_FLAGS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const GH_VALUE_FLAGS = new Set(['-R', '--repo', '--hostname']);
const OVERRIDE_ASSIGNMENT = new RegExp(`(?:^|\\s)${OVERRIDE_VARIABLE}=(?:"([^"]*)"|'([^']*)'|(\\S*))`);
const NO_VERIFY = /(?:^|\s)--no-verify(?=$|\s)/;

/** The command with quoted and escaped text blanked out, every other character in place. */
function maskQuoted(command) {
  return command.replace(ESCAPED_OR_QUOTED, (text) =>
    text[0] === '\\' ? '_'.repeat(text.length) : `"${'_'.repeat(text.length - 2)}"`,
  );
}

/** The words of one command, each without a redirection glued to it (`push>/dev/null`). */
function wordsOf(masked) {
  return [...masked.matchAll(/\S+/g)].map((match) => ({ text: match[0].split(/[<>]/)[0], index: match.index }));
}

/** The index of the first word that is not a flag or the value of a flag. */
function afterFlags(words, from, valueFlags) {
  let index = from;
  while (index < words.length && words[index].text.startsWith('-')) {
    index += valueFlags.has(words[index].text) ? 2 : 1;
  }
  return index;
}

function guardedAt(words, index) {
  const name = words[index].text.slice(words[index].text.lastIndexOf('/') + 1);
  if (name === 'git') {
    return words[afterFlags(words, index + 1, GIT_VALUE_FLAGS)]?.text === 'push' ? 'git push' : null;
  }
  if (name !== 'gh') return null;
  const group = afterFlags(words, index + 1, GH_VALUE_FLAGS);
  if (words[group]?.text !== 'pr') return null;
  const verb = words[afterFlags(words, group + 1, GH_VALUE_FLAGS)]?.text;
  return verb === 'create' || verb === 'merge' ? `gh pr ${verb}` : null;
}

/** The first guarded action among the words of one command, with the place it starts at. */
function guardedIn(masked) {
  const words = wordsOf(masked);
  for (let index = 0; index < words.length; index += 1) {
    const action = guardedAt(words, index);
    if (action) return { action, index: words[index].index };
  }
  return null;
}

/**
 * Every part of a shell line that runs a guarded action: the action, the text in front of
 * it (where an environment override goes) and the command itself (where a flag is looked
 * for). A line is cut at `;`, `&`, `|`, parentheses, backticks and line ends.
 */
function guardedSegments(command) {
  const masked = maskQuoted(command);
  const found = [];
  let start = 0;
  for (const cut of [...masked.matchAll(SEGMENT_BREAK), { index: masked.length, 0: '' }]) {
    const part = masked.slice(start, cut.index);
    const original = command.slice(start, cut.index);
    const guarded = guardedIn(part);
    if (guarded) {
      found.push({
        action: guarded.action,
        prefix: original.slice(0, guarded.index),
        maskedPrefix: part.slice(0, guarded.index),
        maskedCommand: part.slice(guarded.index),
      });
    }
    start = cut.index + cut[0].length;
  }
  return found;
}

/**
 * The guarded action a shell line runs: "git push", "gh pr create", "gh pr merge", or null.
 * A walk over the words of each command with quoted text blanked, so a commit message that
 * mentions a push does not count. It is not a shell parser and does not try to be one.
 */
export function guardedAction(command) {
  return guardedSegments(command ?? '')[0]?.action ?? null;
}

function segmentOverride(segment, fromEnvironment) {
  const located = OVERRIDE_ASSIGNMENT.exec(segment.maskedPrefix);
  const match = located ? OVERRIDE_ASSIGNMENT.exec(segment.prefix.slice(located.index)) : null;
  const given = match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
  const reason = (given || fromEnvironment).trim();
  if (reason) return reason;
  return NO_VERIFY.test(segment.maskedCommand) ? '--no-verify' : null;
}

/**
 * The reason a guarded command was let through on purpose, or null. Two escape hatches:
 * `PR_SELF_REVIEW_OVERRIDE=<reason>` in front of the guarded command or in the environment,
 * and `--no-verify` among the arguments of the guarded command. An override on another
 * command of the same line, or inside quoted text, does not count, and every guarded
 * command of the line needs its own. Both are logged by the caller.
 */
export function overrideReason(command, env) {
  const segments = guardedSegments(command ?? '');
  const reasons = segments.map((segment) => segmentOverride(segment, env?.[OVERRIDE_VARIABLE] ?? ''));
  if (reasons.length === 0 || reasons.some((reason) => reason === null)) return null;
  return reasons[0];
}

/** Minimal glob: `**` crosses folders, `*` stays inside one path segment. */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const source = escaped
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${source}$`);
}

function matchesAny(path, globs) {
  return (globs ?? []).some((glob) => globToRegExp(glob).test(path));
}

/** Which reviewer a changed file goes to. The project map wins over the extension. */
export function classifyFile(path, config) {
  if (matchesAny(path, config?.skip)) return { bucket: 'skip', test: false };
  if (DOC_FILE.test(path)) return { bucket: 'docs', test: false };
  const test = TEST_FILE.test(path);
  const mapped = Object.entries(config?.buckets ?? {}).find(([, globs]) => matchesAny(path, globs));
  if (mapped) return { bucket: mapped[0], test };
  return { bucket: FRONTEND_FILE.test(path) ? 'frontend' : 'unassigned', test };
}

export function isDocsOnly(paths) {
  return paths.length > 0 && paths.every((path) => DOC_FILE.test(path));
}

/** The path of the mirrored copy of a file, or null when the file is not mirrored. */
export function mirrorCounterpart(path, mirrors) {
  for (const [left, right] of mirrors ?? []) {
    if (path.startsWith(`${left}/`)) return `${right}${path.slice(left.length)}`;
    if (path.startsWith(`${right}/`)) return `${left}${path.slice(right.length)}`;
  }
  return null;
}

/** One hash for a set of changed files: path -> content hash (or a deletion marker). */
export function fingerprintOf(contentByPath) {
  const lines = [...contentByPath.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([path, content]) => `${path}\u0000${content}`);
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/** A finding is suppressed only by a reason in words. */
export function isSuppressed(finding) {
  return typeof finding?.suppressed === 'string' && finding.suppressed.trim() !== '';
}

function findingErrors(finding, index) {
  const where = `findings[${index}]`;
  if (!SEVERITIES.includes(finding?.severity)) {
    return [`${where}: severity must be one of ${SEVERITIES.join(', ')}`];
  }
  const errors = [];
  if (finding.suppressed !== undefined && !isSuppressed(finding)) {
    errors.push(`${where}: "suppressed" must be the reason, as text`);
  }
  if (finding.severity !== 'critical') return errors;
  if (!finding.file || !Number.isInteger(finding.line)) {
    errors.push(`${where}: a critical finding needs a file and a line number`);
  }
  if (!finding.rule || !finding.skill || !String(finding.evidence ?? '').trim()) {
    errors.push(`${where}: a critical finding needs a rule, its owner skill and the quoted evidence`);
  }
  return errors;
}

function checkErrors(check, index) {
  const where = `checks[${index}]`;
  if (!check?.name || !CHECK_STATUSES.includes(check.status)) {
    return [`${where}: needs a name and a status of ${CHECK_STATUSES.join(', ')}`];
  }
  if (check.status === 'not_run' && !String(check.detail ?? '').trim()) {
    return [`${where}: a check that did not run needs the reason in "detail"`];
  }
  return [];
}

/** Returns a list of problems with a review file; an empty list means it can be recorded. */
export function validateReview(review) {
  const errors = [];
  if (!review?.fingerprint) errors.push('fingerprint: copy it from the "scope" output');
  if (!Array.isArray(review?.checks) || !Array.isArray(review?.findings)) {
    return [...errors, 'checks and findings must both be arrays'];
  }
  return [
    ...errors,
    ...review.checks.flatMap(checkErrors),
    ...review.findings.flatMap(findingErrors),
  ];
}

export const NO_CHECK_PASSED = 'no check passed';

/**
 * One critical finding or one failed check blocks. So does a review in which no check
 * passed: skipping every check must not produce a pass. A suppressed finding is counted apart.
 */
export function computeVerdict({ checks, findings }) {
  const counts = { critical: 0, warning: 0, note: 0, suppressed: 0 };
  for (const finding of findings) {
    counts[isSuppressed(finding) ? 'suppressed' : finding.severity] += 1;
  }
  const failed = checks.filter((check) => check.status === 'fail').map((check) => check.name);
  const anyPassed = checks.some((check) => check.status === 'pass');
  const failedChecks = anyPassed || failed.length > 0 ? failed : [NO_CHECK_PASSED];
  const blocked = counts.critical > 0 || failedChecks.length > 0;
  return { verdict: blocked ? 'blocked' : 'pass', counts, failedChecks };
}

function folderOf(path) {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut + 1);
}

function fullPlan(reason, paths) {
  return { mode: 'full', reason, changed: paths, removed: [], widenedBy: [], files: paths };
}

/**
 * Which files of the change need a reviewer. After a recorded review only the files whose
 * content is different need one; the findings of the others are carried by `carriedFindings`.
 * Everything is reviewed again when there is nothing to compare with, when the branch has a
 * new base (the same file then has a different diff), or when the review config changed. A changed instruction file sends every changed file of its folder back to review:
 * the rules for those files are not the ones they were reviewed against.
 */
export function reviewPlan({ previous, mergeBase, content, configPath }) {
  const paths = [...content.keys()].sort();
  if (!previous?.files) return fullPlan('no earlier review is recorded', paths);
  if (previous.mergeBase !== mergeBase) return fullPlan('the branch has a new base since the last review', paths);
  const reviewed = new Map(Object.entries(previous.files));
  const changed = paths.filter((path) => reviewed.get(path) !== content.get(path));
  const removed = [...reviewed.keys()].filter((path) => !content.has(path)).sort();
  const touched = [...changed, ...removed];
  if (touched.includes(configPath)) return fullPlan('the review config changed since the last review', paths);
  const widenedBy = touched.filter((path) => INSTRUCTION_FILE.test(path));
  const folders = widenedBy.map(folderOf);
  const files = paths.filter((path) => changed.includes(path) || folders.some((folder) => path.startsWith(folder)));
  return { mode: 'incremental', reason: null, changed, removed, widenedBy, files };
}

/** The findings of the last review that still stand: their file is in the change and was not reviewed again. */
export function carriedFindings(previousFindings, plan, currentPaths) {
  if (plan.mode !== 'incremental') return [];
  const reviewedAgain = new Set(plan.files);
  return (previousFindings ?? []).filter((finding) => currentPaths.has(finding.file) && !reviewedAgain.has(finding.file));
}

/** Decides whether a guarded action may run for the committed state described by `scope`. */
export function evaluateGate(scope, record) {
  if (scope.empty) return { allow: true, reason: 'no changes against the base branch' };
  if (scope.docsOnly) return { allow: true, reason: 'documentation-only change' };
  if (!record) return { allow: false, reason: 'No self-review is recorded for this branch.' };
  const reviewed = [record.fingerprint?.committed, record.fingerprint?.worktree];
  if (!reviewed.includes(scope.committed)) {
    return { allow: false, reason: 'The committed changes have changed since the last self-review.' };
  }
  if (record.verdict !== 'pass') {
    const failed = record.failedChecks?.length ? `, failed checks: ${record.failedChecks.join(', ')}` : '';
    return {
      allow: false,
      reason: `The last self-review is BLOCKED: ${record.counts?.critical ?? 0} critical${failed}.`,
    };
  }
  return { allow: true, reason: 'self-review passed for this exact change' };
}
