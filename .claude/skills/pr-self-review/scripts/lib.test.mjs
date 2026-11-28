// Run: node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyFile,
  computeVerdict,
  evaluateGate,
  fingerprintOf,
  globToRegExp,
  isDocsOnly,
  mirrorCounterpart,
  overrideReason,
  validateReview,
} from './lib.mjs';

const CONFIG = {
  buckets: { frontend: ['web/**'], backend: ['api/**', 'engine/**'] },
  skip: ['**/*.lock', 'api/migrations/**'],
  mirrors: [['api/shared', 'web/shared']],
};

test('overrideReason accepts only the environment of the hook process', () => {
  assert.equal(overrideReason({ PR_SELF_REVIEW_OVERRIDE: 'approved by owner' }), 'approved by owner');
  assert.equal(overrideReason({ PR_SELF_REVIEW_OVERRIDE: '   ' }), null);
  assert.equal(overrideReason({}), null);
  assert.equal(overrideReason(undefined), null);
});

test('globToRegExp supports **, * and literal dots', () => {
  assert.ok(globToRegExp('web/**').test('web/src/app/page.tsx'));
  assert.ok(globToRegExp('**/*.lock').test('api/pnpm.lock'));
  assert.ok(globToRegExp('**/*.lock').test('pnpm.lock'));
  assert.ok(!globToRegExp('*.md').test('docs/a.md'));
  assert.ok(!globToRegExp('web/**').test('website/a.ts'));
});

test('classifyFile routes by the project map, then falls back to the extension', () => {
  assert.deepEqual(classifyFile('web/src/Button.tsx', CONFIG), { bucket: 'frontend', test: false });
  assert.deepEqual(classifyFile('api/src/service.ts', CONFIG), { bucket: 'backend', test: false });
  assert.deepEqual(classifyFile('web/src/Button.test.tsx', CONFIG), { bucket: 'frontend', test: true });
  assert.deepEqual(classifyFile('api/migrations/0001.sql', CONFIG), { bucket: 'skip', test: false });
  assert.deepEqual(classifyFile('api/pnpm.lock', CONFIG), { bucket: 'skip', test: false });
  assert.deepEqual(classifyFile('README.md', CONFIG), { bucket: 'docs', test: false });
  assert.deepEqual(classifyFile('scripts/dev.sh', CONFIG), { bucket: 'unassigned', test: false });
  assert.deepEqual(classifyFile('src/App.tsx', {}), { bucket: 'frontend', test: false });
  assert.deepEqual(classifyFile('src/server.ts', {}), { bucket: 'unassigned', test: false });
});

test('isDocsOnly is true only for a non-empty list of documentation files', () => {
  assert.equal(isDocsOnly(['README.md', 'docs/a.mdx']), true);
  assert.equal(isDocsOnly(['README.md', 'src/a.ts']), false);
  assert.equal(isDocsOnly([]), false);
});

test('mirrorCounterpart maps a file to its copy in either direction', () => {
  assert.equal(mirrorCounterpart('api/shared/contracts/a.ts', CONFIG.mirrors), 'web/shared/contracts/a.ts');
  assert.equal(mirrorCounterpart('web/shared/index.ts', CONFIG.mirrors), 'api/shared/index.ts');
  assert.equal(mirrorCounterpart('api/src/a.ts', CONFIG.mirrors), null);
});

test('fingerprintOf does not depend on entry order and changes with content', () => {
  const a = fingerprintOf(new Map([['a.ts', '1'], ['b.ts', '2']]));
  const b = fingerprintOf(new Map([['b.ts', '2'], ['a.ts', '1']]));
  const c = fingerprintOf(new Map([['a.ts', '1'], ['b.ts', '3']]));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

const critical = {
  severity: 'critical',
  file: 'api/src/repo.ts',
  line: 12,
  rule: 'SQL built from request input',
  skill: 'security',
  evidence: 'sql.raw(`order by ${sortBy}`)',
};

test('validateReview accepts a complete review and rejects a critical without evidence', () => {
  const review = { fingerprint: 'abc', checks: [{ name: 'typecheck', status: 'pass' }], findings: [critical] };
  assert.deepEqual(validateReview(review), []);
  const errors = validateReview({ ...review, findings: [{ ...critical, evidence: '', line: undefined }] });
  assert.equal(errors.length, 2);
});

test('validateReview rejects unknown severities, statuses and a skipped check without a reason', () => {
  const errors = validateReview({
    fingerprint: 'abc',
    checks: [{ name: 'tests', status: 'not_run' }, { name: 'lint', status: 'green' }],
    findings: [{ ...critical, severity: 'blocker' }],
  });
  assert.equal(errors.length, 3);
  assert.equal(validateReview({ checks: [], findings: [] }).length, 1);
});

test('computeVerdict blocks on one critical finding or one failed check', () => {
  const pass = computeVerdict({ checks: [{ name: 'lint', status: 'pass' }], findings: [{ ...critical, severity: 'warning' }] });
  assert.equal(pass.verdict, 'pass');
  assert.deepEqual(pass.counts, { critical: 0, warning: 1, note: 0, suppressed: 0 });

  const blocked = computeVerdict({ checks: [{ name: 'lint', status: 'pass' }], findings: [critical] });
  assert.equal(blocked.verdict, 'blocked');
  assert.equal(blocked.counts.critical, 1);

  const failedCheck = computeVerdict({ checks: [{ name: 'typecheck', status: 'fail' }], findings: [] });
  assert.equal(failedCheck.verdict, 'blocked');
  assert.deepEqual(failedCheck.failedChecks, ['typecheck']);
});

test('computeVerdict blocks when no check passed, so skipping every check cannot give a pass', () => {
  const skipped = computeVerdict({ checks: [{ name: 'tests', status: 'not_run', detail: 'no time' }], findings: [] });
  assert.equal(skipped.verdict, 'blocked');
  assert.deepEqual(skipped.failedChecks, ['no check passed']);
  assert.equal(computeVerdict({ checks: [], findings: [] }).verdict, 'blocked');
});

test('computeVerdict does not count a finding suppressed with a reason', () => {
  const result = computeVerdict({ checks: [{ name: 'lint', status: 'pass' }], findings: [{ ...critical, suppressed: 'accepted: internal admin tool' }] });
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(result.counts, { critical: 0, warning: 0, note: 0, suppressed: 1 });
});

const passRecord = { verdict: 'pass', fingerprint: { committed: 'c1', worktree: 'w1' }, counts: { critical: 0 } };

test('evaluateGate allows a pass recorded for the committed state', () => {
  assert.equal(evaluateGate({ committed: 'c1', docsOnly: false, empty: false }, passRecord).allow, true);
});

test('evaluateGate allows a pass recorded for a working tree that was committed unchanged', () => {
  assert.equal(evaluateGate({ committed: 'w1', docsOnly: false, empty: false }, passRecord).allow, true);
});

test('evaluateGate denies a missing, stale or blocked verdict', () => {
  const scope = { committed: 'c2', docsOnly: false, empty: false };
  assert.match(evaluateGate(scope, null).reason, /no self-review/i);
  assert.match(evaluateGate(scope, passRecord).reason, /changed since/i);
  const blocked = { ...passRecord, verdict: 'blocked', fingerprint: { committed: 'c2' }, counts: { critical: 2 }, failedChecks: [] };
  const result = evaluateGate(scope, blocked);
  assert.equal(result.allow, false);
  assert.match(result.reason, /2 critical/);
});

test('evaluateGate allows a documentation-only or empty change without a verdict', () => {
  assert.equal(evaluateGate({ committed: 'c9', docsOnly: true, empty: false }, null).allow, true);
  assert.equal(evaluateGate({ committed: 'c9', docsOnly: false, empty: true }, null).allow, true);
});
