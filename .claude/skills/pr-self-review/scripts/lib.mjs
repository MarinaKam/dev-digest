// Pure logic of the pr-self-review gate. No file system, no git, no process access:
// everything here is tested in lib.test.mjs. The I/O lives in gate.mjs.
import { createHash } from 'node:crypto';

export const OVERRIDE_VARIABLE = 'PR_SELF_REVIEW_OVERRIDE';
export const SEVERITIES = ['critical', 'warning', 'note'];
export const CHECK_STATUSES = ['pass', 'fail', 'not_run'];

const DOC_FILE = /\.mdx?$/i;
const TEST_FILE = /(\.|\/)(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|e2e)\//;
const FRONTEND_FILE = /\.(tsx|jsx|css|scss)$/i;

const OVERRIDE_IN_COMMAND = new RegExp(`(?:^|\\s)${OVERRIDE_VARIABLE}=(?:"([^"]*)"|'([^']*)'|(\\S*))`);
const NO_VERIFY = /(?:^|\s)--no-verify(?=$|\s)/;

/**
 * The reason a guarded command was let through on purpose, or null. Two escape hatches:
 * `PR_SELF_REVIEW_OVERRIDE=<reason>` in front of the command or in the environment, and
 * `--no-verify` on the command. Both are logged by the caller.
 */
export function overrideReason(command, env) {
  const match = OVERRIDE_IN_COMMAND.exec(command ?? '');
  const given = match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
  const reason = (given || env?.[OVERRIDE_VARIABLE] || '').trim();
  if (reason) return reason;
  return NO_VERIFY.test(command ?? '') ? '--no-verify' : null;
}

const QUOTED_TEXT = /'[^']*'|"(?:\\.|[^"\\])*"/g;
const COMMAND_START = "(?:^|[\\s;&|(])";
const COMMAND_END = "(?=$|[\\s;&|)])";
const GIT_PUSH = new RegExp(`${COMMAND_START}git\\s+(?:-\\S+\\s+(?:[^-\\s]\\S*\\s+)?)*push${COMMAND_END}`);
const GH_PULL_REQUEST = new RegExp(`${COMMAND_START}gh\\s+pr\\s+(create|merge)${COMMAND_END}`);

/**
 * The guarded action a shell line runs: "git push", "gh pr create", "gh pr merge", or null.
 * A plain text match on the command with quoted text removed, so a commit message that
 * mentions a push does not count. It is not a shell parser and does not try to be one.
 */
export function guardedAction(command) {
  const text = (command ?? '').replace(QUOTED_TEXT, '""');
  if (GIT_PUSH.test(text)) return 'git push';
  const pullRequest = GH_PULL_REQUEST.exec(text);
  return pullRequest ? `gh pr ${pullRequest[1]}` : null;
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

function findingErrors(finding, index) {
  const where = `findings[${index}]`;
  if (!SEVERITIES.includes(finding?.severity)) {
    return [`${where}: severity must be one of ${SEVERITIES.join(', ')}`];
  }
  if (finding.severity !== 'critical') return [];
  const errors = [];
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
    const suppressed = String(finding.suppressed ?? '').trim() !== '';
    counts[suppressed ? 'suppressed' : finding.severity] += 1;
  }
  const failed = checks.filter((check) => check.status === 'fail').map((check) => check.name);
  const anyPassed = checks.some((check) => check.status === 'pass');
  const failedChecks = anyPassed || failed.length > 0 ? failed : [NO_CHECK_PASSED];
  const blocked = counts.critical > 0 || failedChecks.length > 0;
  return { verdict: blocked ? 'blocked' : 'pass', counts, failedChecks };
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
