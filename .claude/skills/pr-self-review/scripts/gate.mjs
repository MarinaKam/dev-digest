#!/usr/bin/env node
// Gate of the pr-self-review skill. Reads git state, records a review verdict and
// answers whether a push or a pull request may go out.
//
//   node gate.mjs scope [--target worktree|head]   what to review, as JSON
//   node gate.mjs record <review.json>             store the verdict for that exact change
//   node gate.mjs check                            exit 0 when the gate is open, 1 when closed
//   node gate.mjs hook                             PreToolUse hook: reads the tool call on stdin
//
// The verdict is stored inside the git directory, so it is never committed.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  classifyFile,
  computeVerdict,
  evaluateGate,
  fingerprintOf,
  guardedAction,
  isDocsOnly,
  mirrorCounterpart,
  overrideReason,
  validateReview,
} from './lib.mjs';

const CONFIG_PATH = '.claude/pr-self-review.config.json';
const STATE_FOLDER = 'pr-self-review';
const BASE_CANDIDATES = ['origin/main', 'main', 'origin/master', 'master'];
const DELETED = 'deleted';
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

function headBlobs(root) {
  const blobs = new Map();
  for (const entry of git(root, ['ls-tree', '-r', '-z', 'HEAD']).split('\0').filter(Boolean)) {
    const [meta, path] = entry.split('\t');
    blobs.set(path, meta.split(' ')[2]);
  }
  return blobs;
}

function worktreeHashes(root, paths) {
  const files = paths.filter((path) => {
    const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
    return stat?.isFile();
  });
  if (files.length === 0) return new Map();
  const hashes = git(root, ['hash-object', '--stdin-paths'], `${files.join('\n')}\n`).trim().split('\n');
  return new Map(files.map((path, index) => [path, hashes[index]]));
}

/** The change as committed: path -> blob hash, and path -> status. */
function committedState(root, mergeBase) {
  const blobs = headBlobs(root);
  const pairs = changedPaths(root, [mergeBase, 'HEAD']);
  return {
    content: new Map(pairs.map(([path, status]) => [path, status === 'D' ? DELETED : blobs.get(path)])),
    status: new Map(pairs),
  };
}

/** The change as it is on disk: committed, staged, unstaged and untracked files. */
function worktreeState(root, mergeBase) {
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const pairs = [...changedPaths(root, [mergeBase]), ...untracked.map((path) => [path, '?'])];
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
  const blobs = target === 'head' ? headBlobs(root) : null;
  return (path) => (blobs ? blobs.get(path) : worktreeHashes(root, [path]).get(path)) ?? DELETED;
}

function describeFiles(state, config) {
  const files = [...state.status.entries()]
    .map(([path, status]) => ({ path, status, ...classifyFile(path, config) }))
    .sort((left, right) => (left.path < right.path ? -1 : 1));
  const buckets = {};
  for (const file of files) buckets[file.bucket] = [...(buckets[file.bucket] ?? []), file.path];
  return { files, buckets };
}

function readScope(root, target) {
  const config = loadConfig(root);
  const base = baseRef(root, config);
  const mergeBase = git(root, ['merge-base', 'HEAD', base]).trim();
  const committed = committedState(root, mergeBase);
  const worktree = worktreeState(root, mergeBase);
  const state = target === 'head' ? committed : worktree;
  const committedFingerprint = fingerprintOf(committed.content);
  return {
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
    ...describeFiles(state, config),
  };
}

function stateFile(root, name) {
  const folder = resolve(root, git(root, ['rev-parse', '--git-path', STATE_FOLDER]).trim());
  mkdirSync(folder, { recursive: true });
  return join(folder, name);
}

function readRecord(root) {
  const file = stateFile(root, 'verdict.json');
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
  process.stdout.write(`${JSON.stringify(readScope(root, target), null, 2)}\n`);
  return 0;
}

function runRecord(root, args) {
  if (!args[0]) throw new Error('Usage: gate.mjs record <review.json>');
  const review = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
  const errors = validateReview(review);
  if (errors.length) throw new Error(`The review file is incomplete:\n- ${errors.join('\n- ')}`);
  const scope = readScope(root, targetOf(review.target));
  if (scope.fingerprint !== review.fingerprint) {
    throw new Error('The files changed during the review. Run "scope" again and review the new state.');
  }
  const mirrorCheck = { name: 'mirrored copies', status: scope.mirrorDrift.length ? 'fail' : 'pass' };
  const checks = [...review.checks, ...(scope.mirrorDrift.length || loadConfig(root).mirrors ? [mirrorCheck] : [])];
  const result = computeVerdict({ checks, findings: review.findings });
  const record = {
    version: 1,
    ...result,
    target: scope.target,
    branch: scope.branch,
    head: scope.head,
    base: scope.base,
    fingerprint: { [scope.target === 'head' ? 'committed' : 'worktree']: scope.fingerprint },
    checks,
    criticals: review.findings.filter((finding) => finding.severity === 'critical' && !finding.suppressed),
    skills: review.skills ?? [],
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(stateFile(root, 'verdict.json'), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${summaryLine(result)}\n`);
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
    'Only the user may override the gate. Do not add an override yourself; tell the user it is blocked.',
  ].join('\n');
}

function runHook(stdin) {
  let call;
  try {
    call = JSON.parse(stdin);
  } catch {
    return 0;
  }
  const command = call?.tool_input?.command ?? '';
  const action = guardedAction(command);
  if (!action) return 0;
  const root = tryGit(call.cwd || process.cwd(), ['rev-parse', '--show-toplevel']);
  if (!root) return 0;
  try {
    const reason = overrideReason(command, process.env);
    if (reason) {
      const entry = { at: new Date().toISOString(), action, head: tryGit(root, ['rev-parse', 'HEAD']), reason };
      appendFileSync(stateFile(root, 'overrides.log'), `${JSON.stringify(entry)}\n`);
      return 0;
    }
    const state = gateState(root);
    if (state.allow) return 0;
    process.stderr.write(`${denyMessage(action, state.reason)}\n`);
  } catch (error) {
    process.stderr.write(`${denyMessage(action, `The gate could not read the change: ${error.message}`)}\n`);
  }
  return EXIT_DENY_HOOK;
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
