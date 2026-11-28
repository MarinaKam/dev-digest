#!/usr/bin/env node
// Gate of the pr-self-review skill. Reads git state, records a review verdict and
// answers whether a push or a pull request may go out.
//
//   node gate.mjs scope [--target worktree|head]   what to review, as JSON
//   node gate.mjs record <review.json>             store the verdict for that exact change
//   node gate.mjs check                            exit 0 when the gate is open, 1 when closed
//   node gate.mjs hook                             PreToolUse hook: reads the tool call on stdin
//
// The verdict is stored in .claude/.pr-self-review.json. Keep that file out of version
// control (the project ignores it); the script never counts it as part of the change.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  carriedFindings,
  classifyFile,
  computeVerdict,
  evaluateGate,
  fingerprintOf,
  guardedAction,
  isDocsOnly,
  isSuppressed,
  mirrorCounterpart,
  overrideReason,
  reviewPlan,
  validateReview,
} from './lib.mjs';

const CONFIG_PATH = '.claude/pr-self-review.config.json';
const VERDICT_FILE = '.claude/.pr-self-review.json';
const OVERRIDE_LOG = '.claude/.pr-self-review.log';
const STATE_FILES = new Set([VERDICT_FILE, OVERRIDE_LOG]);
const BASE_CANDIDATES = ['origin/main', 'main', 'origin/master', 'master'];
const DELETED = 'deleted';
const COMMIT_ID = /^[0-9a-f]{40,64}$/;
const EXIT_DENY_HOOK = 2;

function git(root, args, input) {
  return execFileSync('git', args, {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function tryGit(root, args) {
  try {
    return git(root, args).trim();
  } catch {
    return null;
  }
}

function loadConfig(root) {
  const file = join(root, CONFIG_PATH);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${CONFIG_PATH} is not valid JSON: ${error.message}`);
  }
}

function baseRef(root, config) {
  const candidates = [
    config.base,
    tryGit(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']),
    ...BASE_CANDIDATES,
  ].filter(Boolean);
  const found = candidates.find((ref) => tryGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]));
  if (!found) throw new Error(`No base branch found. Set "base" in ${CONFIG_PATH}.`);
  return found;
}

/** Parses `git diff --name-status -z` into [path, status] pairs. */
function changedPaths(root, args) {
  const fields = git(root, ['diff', '--name-status', '-z', '--no-renames', ...args]).split('\0');
  const pairs = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    pairs.push([fields[index + 1], fields[index][0]]);
  }
  return pairs;
}

function commitBlobs(root, commit) {
  const blobs = new Map();
  for (const entry of git(root, ['ls-tree', '-r', '-z', commit]).split('\0').filter(Boolean)) {
    const [meta, path] = entry.split('\t');
    blobs.set(path, meta.split(' ')[2]);
  }
  return blobs;
}

/** Hashes files as git stores them: a regular file by its content, a symbolic link by its target. */
function worktreeHashes(root, paths) {
  const stats = paths.map((path) => [path, lstatSync(join(root, path), { throwIfNoEntry: false })]);
  const files = stats.filter(([, stat]) => stat?.isFile()).map(([path]) => path);
  const links = stats.filter(([, stat]) => stat?.isSymbolicLink()).map(([path]) => path);
  const hashes = files.length
    ? git(root, ['hash-object', '--stdin-paths'], `${files.join('\n')}\n`).trim().split('\n')
    : [];
  const linkHashes = links.map((path) => git(root, ['hash-object', '--stdin'], readlinkSync(join(root, path))).trim());
  return new Map([
    ...files.map((path, index) => [path, hashes[index]]),
    ...links.map((path, index) => [path, linkHashes[index]]),
  ]);
}

/** The change as committed: path -> blob hash, and path -> status. */
function committedState(root, mergeBase, commit = 'HEAD') {
  const blobs = commitBlobs(root, commit);
  const pairs = changedPaths(root, [mergeBase, commit]).filter(([path]) => !STATE_FILES.has(path));
  return {
    content: new Map(pairs.map(([path, status]) => [path, status === 'D' ? DELETED : blobs.get(path)])),
    status: new Map(pairs),
  };
}

/** The change as it is on disk: committed, staged, unstaged and untracked files. */
function worktreeState(root, mergeBase) {
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const pairs = [...changedPaths(root, [mergeBase]), ...untracked.map((path) => [path, '?'])].filter(
    ([path]) => !STATE_FILES.has(path),
  );
  const hashes = worktreeHashes(root, pairs.map(([path]) => path));
  return {
    content: new Map(pairs.map(([path]) => [path, hashes.get(path) ?? DELETED])),
    status: new Map(pairs),
  };
}

function mirrorDrift(state, otherContent, mirrors) {
  const drift = new Map();
  for (const path of state.content.keys()) {
    const counterpart = mirrorCounterpart(path, mirrors);
    if (!counterpart) continue;
    const own = state.content.get(path);
    const copy = state.content.get(counterpart) ?? otherContent(counterpart);
    if (own !== copy) drift.set([path, counterpart].sort().join('\0'), [path, counterpart].sort());
  }
  return [...drift.values()];
}

function unchangedContent(root, target) {
  const blobs = target === 'head' ? commitBlobs(root, 'HEAD') : null;
  return (path) => (blobs ? blobs.get(path) : worktreeHashes(root, [path]).get(path)) ?? DELETED;
}

function describeFiles(state, config, plan) {
  const inReview = new Set(plan.files);
  const files = [...state.status.entries()]
    .map(([path, status]) => ({ path, status, ...classifyFile(path, config), review: inReview.has(path) }))
    .sort((left, right) => (left.path < right.path ? -1 : 1));
  const buckets = Object.create(null);
  const reviewBuckets = Object.create(null);
  for (const file of files) {
    buckets[file.bucket] = [...(buckets[file.bucket] ?? []), file.path];
    if (file.review) reviewBuckets[file.bucket] = [...(reviewBuckets[file.bucket] ?? []), file.path];
  }
  return { files, buckets, reviewBuckets };
}

/**
 * What the last recorded review covered: the content hash of every file, the base it was
 * compared with, and its findings. A verdict written before files were recorded is rebuilt
 * from its commit, and only when that commit still gives the recorded fingerprint.
 */
function previousReview(root, record, base) {
  if (!record) return null;
  if (record.version >= 2) return record.files ? record : null;
  if (!COMMIT_ID.test(record.head ?? '')) return null;
  try {
    const mergeBase = git(root, ['merge-base', record.head, base]).trim();
    const { content } = committedState(root, mergeBase, record.head);
    if (!Object.values(record.fingerprint ?? {}).includes(fingerprintOf(content))) return null;
    return { files: Object.fromEntries(content), mergeBase, findings: record.criticals ?? [] };
  } catch {
    return null;
  }
}

/** The scope printed to the agent, with the pieces `record` needs to store the review. */
function inspect(root, target) {
  const config = loadConfig(root);
  const base = baseRef(root, config);
  const mergeBase = git(root, ['merge-base', 'HEAD', base]).trim();
  const committed = committedState(root, mergeBase);
  const worktree = worktreeState(root, mergeBase);
  const state = target === 'head' ? committed : worktree;
  const committedFingerprint = fingerprintOf(committed.content);
  const previous = previousReview(root, readRecord(root), base);
  const plan = reviewPlan({ previous, mergeBase, content: state.content, configPath: CONFIG_PATH });
  const carried = carriedFindings(previous?.findings, plan, new Set(state.content.keys()));
  const { files, buckets, reviewBuckets } = describeFiles(state, config, plan);
  const scope = {
    target,
    base,
    mergeBase,
    head: git(root, ['rev-parse', 'HEAD']).trim(),
    branch: tryGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    fingerprint: fingerprintOf(state.content),
    committed: committedFingerprint,
    uncommitted: fingerprintOf(worktree.content) !== committedFingerprint,
    empty: state.content.size === 0,
    docsOnly: isDocsOnly([...state.content.keys()]),
    mirrorDrift: mirrorDrift(state, unchangedContent(root, target), config.mirrors),
    hasConfig: existsSync(join(root, CONFIG_PATH)),
    review: { ...plan, buckets: reviewBuckets, carriedFindings: carried.length },
    files,
    buckets,
  };
  return { scope, content: state.content, carried, previous };
}

function readScope(root, target) {
  return inspect(root, target).scope;
}

function stateFile(root, name) {
  const file = join(root, name);
  mkdirSync(dirname(file), { recursive: true });
  return file;
}

function readRecord(root) {
  const file = join(root, VERDICT_FILE);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function targetOf(value) {
  if (value === undefined) return 'worktree';
  if (value !== 'worktree' && value !== 'head') throw new Error('--target must be "worktree" or "head".');
  return value;
}

function summaryLine(result) {
  const { counts, failedChecks, verdict } = result;
  const failed = failedChecks.length ? `, failed checks: ${failedChecks.join(', ')}` : '';
  const tail = `${counts.critical} critical, ${counts.warning} warning, ${counts.note} note, ${counts.suppressed} suppressed${failed}`;
  return `PR SELF-REVIEW: ${verdict === 'pass' ? 'PASS' : 'BLOCKED'} (${tail})`;
}

function runScope(root, args) {
  const flag = args.indexOf('--target');
  const target = targetOf(flag === -1 ? undefined : args[flag + 1]);
  process.stdout.write(`${JSON.stringify(inspect(root, target).scope, null, 2)}\n`);
  return 0;
}

function runRecord(root, args) {
  if (!args[0]) throw new Error('Usage: gate.mjs record <review.json>');
  const review = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
  const errors = validateReview(review);
  if (errors.length) throw new Error(`The review file is incomplete:\n- ${errors.join('\n- ')}`);
  const { scope, content, carried, previous } = inspect(root, targetOf(review.target));
  if (scope.fingerprint !== review.fingerprint) {
    throw new Error('The files changed during the review. Run "scope" again and review the new state.');
  }
  const stray = review.findings.filter((finding) => finding.severity === 'critical' && !content.has(finding.file));
  if (stray.length) {
    const paths = stray.map((finding) => finding.file).join(', ');
    throw new Error(`A critical finding names a file that is not in the change: ${paths}. Write the path as "scope" prints it.`);
  }
  const mirrorCheck = { name: 'mirrored copies', status: scope.mirrorDrift.length ? 'fail' : 'pass' };
  const checks = [...review.checks, ...(scope.mirrorDrift.length || loadConfig(root).mirrors ? [mirrorCheck] : [])];
  const findings = [...carried, ...review.findings];
  const result = computeVerdict({ checks, findings });
  // Reviewers do not run after a failed check, so such a record must not mark files as reviewed.
  const reviewed =
    result.failedChecks.length > 0
      ? { files: previous?.files, mergeBase: previous?.mergeBase, findings: previous?.findings }
      : { files: Object.fromEntries(content), mergeBase: scope.mergeBase, findings };
  const record = {
    version: 2,
    ...result,
    target: scope.target,
    branch: scope.branch,
    head: scope.head,
    base: scope.base,
    mergeBase: reviewed.mergeBase,
    fingerprint: { [scope.target === 'head' ? 'committed' : 'worktree']: scope.fingerprint },
    checks,
    criticals: findings.filter((finding) => finding.severity === 'critical' && !isSuppressed(finding)),
    findings: reviewed.findings,
    review: { mode: scope.review.mode, reviewed: scope.review.files.length, carried: carried.length },
    files: reviewed.files,
    skills: review.skills ?? [],
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(stateFile(root, VERDICT_FILE), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${summaryLine(result)}\n`);
  if (scope.review.mode === 'incremental') {
    const { reviewed, carried: kept } = record.review;
    process.stdout.write(`Reviewed ${reviewed} of ${content.size} changed files; ${kept} findings carried from the last review.\n`);
  }
  return 0;
}

function gateState(root) {
  return evaluateGate(readScope(root, 'head'), readRecord(root));
}

function runCheck(root) {
  const state = gateState(root);
  process.stdout.write(`${state.allow ? 'OPEN' : 'CLOSED'}: ${state.reason}\n`);
  return state.allow ? 0 : 1;
}

function denyMessage(action, reason) {
  return [
    `pr-self-review gate: \`${action}\` is blocked. ${reason}`,
    'Run the pr-self-review skill, fix every critical finding, record the verdict, then retry.',
    'Only the user decides to override the gate. Tell the user it is blocked; do not add an override yourself.',
  ].join('\n');
}

function logOverride(root, action, reason) {
  const entry = { at: new Date().toISOString(), action, head: tryGit(root, ['rev-parse', 'HEAD']), reason };
  appendFileSync(stateFile(root, OVERRIDE_LOG), `${JSON.stringify(entry)}\n`);
}

function deny(action, reason) {
  process.stderr.write(`${denyMessage(action, reason)}\n`);
  return EXIT_DENY_HOOK;
}

/**
 * The PreToolUse hook. Lets every command through except a push, a pull request creation
 * and a pull request merge, which need a passing verdict for the committed change.
 */
function runHook(stdin) {
  let call;
  try {
    call = JSON.parse(stdin);
  } catch {
    return 0;
  }
  const action = guardedAction(call?.tool_input?.command);
  if (!action) return 0;
  const root = tryGit(call.cwd || process.cwd(), ['rev-parse', '--show-toplevel']);
  if (!root) return 0;
  try {
    const reason = overrideReason(call.tool_input.command, process.env);
    if (reason) {
      logOverride(root, action, reason);
      return 0;
    }
    const state = gateState(root);
    return state.allow ? 0 : deny(action, state.reason);
  } catch (error) {
    return deny(action, `The gate could not read the change: ${error.message}`);
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'hook') return runHook(readFileSync(0, 'utf8'));
  const root = tryGit(process.cwd(), ['rev-parse', '--show-toplevel']);
  if (!root) throw new Error('Not inside a git repository.');
  if (command === 'scope') return runScope(root, args);
  if (command === 'record') return runRecord(root, args);
  if (command === 'check') return runCheck(root);
  throw new Error('Usage: gate.mjs scope|record|check|hook');
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`pr-self-review: ${error.message}\n`);
  process.exitCode = 1;
}
