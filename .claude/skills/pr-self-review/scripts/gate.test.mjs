// Run: node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
// Every test works in its own throwaway git repository under the system temp folder.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'gate.mjs');
const { PR_SELF_REVIEW_OVERRIDE: _override, CLAUDE_PROJECT_DIR: _project, ...inherited } = process.env;
const ENV = {
  ...inherited,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
const CONFIG = {
  buckets: { frontend: ['web/**'], backend: ['api/**'] },
  skip: ['**/*.lock'],
  mirrors: [['api/shared', 'web/shared']],
};

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, env: ENV, encoding: 'utf8' });
}

function write(repo, path, content) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

function commit(repo, message) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
}

/** A repository with a base commit on `main` and a feature branch with one backend change. */
function makeRepo(t) {
  const repo = mkdtempSync(join(tmpdir(), 'pr-self-review-test-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, '.claude/pr-self-review.config.json', JSON.stringify(CONFIG));
  write(repo, 'api/src/a.ts', 'export const a = 1;\n');
  commit(repo, 'base');
  git(repo, 'checkout', '-q', '-b', 'feat/x');
  write(repo, 'api/src/a.ts', 'export const a = 2;\n');
  commit(repo, 'change');
  return repo;
}

function gate(repo, args, input, env = ENV) {
  return spawnSync(process.execPath, [GATE, ...args], { cwd: repo, env, input, encoding: 'utf8' });
}

function scope(repo, target = 'head') {
  const result = gate(repo, ['scope', '--target', target]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

/** Runs the hook as the harness would: the tool call arrives as JSON on stdin. */
function hook(repo, command, extraEnv = {}) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: repo });
  return gate(repo, ['hook'], input, { ...ENV, CLAUDE_PROJECT_DIR: repo, ...extraEnv });
}

function record(repo, review) {
  const file = join(repo, '.git', 'review-input.json');
  writeFileSync(file, JSON.stringify(review));
  return gate(repo, ['record', file]);
}

function passingReview(repo, target = 'head', findings = []) {
  return { target, fingerprint: scope(repo, target).fingerprint, checks: [{ name: 'typecheck', status: 'pass' }], findings };
}

const CRITICAL = {
  severity: 'critical',
  file: 'api/src/a.ts',
  line: 1,
  rule: 'SQL built from request input',
  skill: 'security',
  evidence: 'sql.raw(sortBy)',
};

test('scope lists the changed files with their buckets and separates the two targets', (t) => {
  const repo = makeRepo(t);
  write(repo, 'web/src/New.tsx', 'export const New = () => null;\n');
  const head = scope(repo, 'head');
  assert.deepEqual(head.files.map((file) => file.path), ['api/src/a.ts']);
  assert.equal(head.files[0].bucket, 'backend');
  assert.equal(head.uncommitted, true);
  const worktree = scope(repo, 'worktree');
  assert.deepEqual(worktree.buckets.frontend, ['web/src/New.tsx']);
  assert.notEqual(worktree.fingerprint, head.fingerprint);
});

test('the hook blocks a push when no self-review is recorded', (t) => {
  const repo = makeRepo(t);
  const result = hook(repo, 'git push -u origin feat/x');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No self-review is recorded/);
});

test('the hook lets unguarded commands through', (t) => {
  const repo = makeRepo(t);
  assert.equal(hook(repo, 'git status').status, 0);
  assert.equal(hook(repo, 'git stash push -m wip').status, 0);
  assert.equal(gate(repo, ['hook'], JSON.stringify({ tool_name: 'Bash', tool_input: {} })).status, 0);
  assert.equal(gate(repo, ['hook'], 'not json').status, 0);
});

test('a broken verdict file or a broken config keeps the gate closed', (t) => {
  const repo = makeRepo(t);
  assert.equal(record(repo, passingReview(repo)).status, 0);
  writeFileSync(join(repo, '.claude', '.pr-self-review.json'), '{ not json');
  assert.equal(hook(repo, 'git push').status, 2);

  const second = makeRepo(t);
  assert.equal(record(second, passingReview(second)).status, 0);
  writeFileSync(join(second, '.claude', 'pr-self-review.config.json'), '{ not json');
  const result = hook(second, 'git push');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /could not read the change/);
});

test('a recorded pass opens the gate until the committed change is different', (t) => {
  const repo = makeRepo(t);
  const recorded = record(repo, passingReview(repo));
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /PASS/);
  assert.equal(hook(repo, 'gh pr create --base main').status, 0);

  write(repo, 'api/src/b.ts', 'export const b = 1;\n');
  commit(repo, 'more');
  const result = hook(repo, 'gh pr create --base main');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /changed since/);
});

test('one critical finding records BLOCKED and keeps the gate closed', (t) => {
  const repo = makeRepo(t);
  const recorded = record(repo, passingReview(repo, 'head', [CRITICAL]));
  assert.match(recorded.stdout, /BLOCKED/);
  const result = hook(repo, 'git push');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /1 critical/);
});

test('a working tree reviewed and then committed unchanged passes the gate', (t) => {
  const repo = makeRepo(t);
  write(repo, 'api/src/c.ts', 'export const c = 1;\n');
  assert.equal(record(repo, passingReview(repo, 'worktree')).status, 0);
  assert.equal(hook(repo, 'git push').status, 2, 'the uncommitted file is not in HEAD yet');
  commit(repo, 'add c');
  assert.equal(hook(repo, 'git push').status, 0);
});

test('record refuses a review whose fingerprint no longer matches the tree', (t) => {
  const repo = makeRepo(t);
  const review = passingReview(repo);
  write(repo, 'api/src/d.ts', 'export const d = 1;\n');
  commit(repo, 'late change');
  const result = record(repo, review);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /changed during the review/);
});

test('record refuses a critical finding without evidence', (t) => {
  const repo = makeRepo(t);
  const result = record(repo, passingReview(repo, 'head', [{ ...CRITICAL, evidence: '' }]));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /quoted evidence/);
});

test('an override with a reason opens the gate and is logged', (t) => {
  const repo = makeRepo(t);
  assert.equal(hook(repo, 'PR_SELF_REVIEW_OVERRIDE="hotfix" git push').status, 0);
  assert.equal(hook(repo, 'gh pr create --fill', { PR_SELF_REVIEW_OVERRIDE: 'owner said so' }).status, 0);
  assert.equal(hook(repo, 'git push --no-verify').status, 0);
  const log = readFileSync(join(repo, '.claude', '.pr-self-review.log'), 'utf8');
  assert.match(log, /hotfix/);
  assert.match(log, /owner said so/);
  assert.match(log, /--no-verify/);
  assert.equal(log.trim().split('\n').length, 3);
  assert.equal(hook(repo, 'PR_SELF_REVIEW_OVERRIDE= git push').status, 2);
});

test('the verdict file is never part of the reviewed change', (t) => {
  const repo = makeRepo(t);
  assert.equal(record(repo, passingReview(repo, 'worktree')).status, 0);
  const paths = scope(repo, 'worktree').files.map((file) => file.path);
  assert.ok(!paths.includes('.claude/.pr-self-review.json'), paths.join(', '));
  assert.equal(record(repo, passingReview(repo, 'worktree')).status, 0, 'recording twice keeps the fingerprint');
});

test('a documentation-only branch passes without a review', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'pr-self-review-test-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, 'README.md', '# a\n');
  commit(repo, 'base');
  git(repo, 'checkout', '-q', '-b', 'docs/x');
  write(repo, 'README.md', '# b\n');
  commit(repo, 'docs');
  assert.equal(hook(repo, 'git push').status, 0);
});

test('a mirrored file changed on one side only blocks the verdict', (t) => {
  const repo = makeRepo(t);
  write(repo, 'api/shared/contract.ts', 'export type A = 1;\n');
  write(repo, 'web/shared/contract.ts', 'export type A = 2;\n');
  commit(repo, 'drift');
  assert.deepEqual(scope(repo).mirrorDrift, [['api/shared/contract.ts', 'web/shared/contract.ts']]);
  const recorded = record(repo, passingReview(repo));
  assert.match(recorded.stdout, /BLOCKED/);
  assert.match(recorded.stdout, /mirrored copies/);
});

test('check reports the gate state with its exit code', (t) => {
  const repo = makeRepo(t);
  assert.equal(gate(repo, ['check']).status, 1);
  record(repo, passingReview(repo));
  assert.equal(gate(repo, ['check']).status, 0);
});
