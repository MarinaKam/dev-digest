// Run: node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  carriedFindings,
  classifyFile,
  isSuppressed,
  computeVerdict,
  evaluateGate,
  fingerprintOf,
  globToRegExp,
  guardedAction,
  isDocsOnly,
  mirrorCounterpart,
  overrideReason,
  reviewPlan,
  validateReview,
} from './lib.mjs';

const CONFIG = {
  buckets: { frontend: ['web/**'], backend: ['api/**', 'engine/**'] },
  skip: ['**/*.lock', 'api/migrations/**'],
  mirrors: [['api/shared', 'web/shared']],
};

test('guardedAction finds a push, a pull request creation and a merge', () => {
  assert.equal(guardedAction('git push -u origin feat/x'), 'git push');
  assert.equal(guardedAction('git -C ../repo -c a=b push'), 'git push');
  assert.equal(guardedAction('cd api && FOO=1 git push'), 'git push');
  assert.equal(guardedAction('git add . && git commit -m "x" && git push'), 'git push');
  assert.equal(guardedAction('(git push)'), 'git push');
  assert.equal(guardedAction('gh pr create --base main --title "x"'), 'gh pr create');
  assert.equal(guardedAction('gh pr merge 12 --squash'), 'gh pr merge');
});

test('guardedAction sees through global flags, a path prefix, a redirection and backticks', () => {
  assert.equal(guardedAction('gh -R owner/repo pr create --fill'), 'gh pr create');
  assert.equal(guardedAction('gh --repo owner/repo pr merge 1'), 'gh pr merge');
  assert.equal(guardedAction('gh pr -R owner/repo create'), 'gh pr create');
  assert.equal(guardedAction('/usr/bin/git push'), 'git push');
  assert.equal(guardedAction('git --git-dir .git --work-tree . push'), 'git push');
  assert.equal(guardedAction("echo it\\'s; git push; echo \\'"), 'git push');
  assert.equal(guardedAction('git push>/dev/null'), 'git push');
  assert.equal(guardedAction('echo `git push`'), 'git push');
});

test('guardedAction is not hidden by an apostrophe in a here-document or a comment', () => {
  assert.equal(guardedAction("git commit -F - <<EOF\nfix: don't crash\nEOF\ngit push && echo 'done'"), 'git push');
  assert.equal(guardedAction("# don't forget\ngit push # it's ready"), 'git push');
});

test('guardedAction reads a long run of flags in linear time', () => {
  const started = Date.now();
  assert.equal(guardedAction(`git ${'-c '.repeat(5000)}status; git push`), 'git push');
  assert.equal(guardedAction(`gh ${'-R '.repeat(5000)}x`), null);
  assert.equal(guardedAction(`gh pr ${'-R '.repeat(5000)}x`), null);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
});

test('guardedAction ignores commands that only mention a guarded word', () => {
  assert.equal(guardedAction('git stash push -m wip'), null);
  assert.equal(guardedAction('git --no-pager stash push -m wip'), null);
  assert.equal(guardedAction('git log --grep push'), null);
  assert.equal(guardedAction('git commit -m "prepare git push"'), null);
  assert.equal(guardedAction("git commit -m 'docs: gh pr create gate'"), null);
  assert.equal(guardedAction('git commit -m "$(cat <<EOF\ngit push is gated\nEOF\n)"'), null);
  assert.equal(guardedAction('gh pr list'), null);
  assert.equal(guardedAction('git config push.default current'), null);
  assert.equal(guardedAction(''), null);
});

test('overrideReason reads a reason from the command or the environment, or --no-verify', () => {
  assert.equal(overrideReason('PR_SELF_REVIEW_OVERRIDE="hotfix for prod" git push', {}), 'hotfix for prod');
  assert.equal(overrideReason('PR_SELF_REVIEW_OVERRIDE=hotfix git push', {}), 'hotfix');
  assert.equal(overrideReason('git push', { PR_SELF_REVIEW_OVERRIDE: 'approved by owner' }), 'approved by owner');
  assert.equal(overrideReason('git push --no-verify', {}), '--no-verify');
  assert.equal(overrideReason('PR_SELF_REVIEW_OVERRIDE= git push', {}), null);
  assert.equal(overrideReason('PR_SELF_REVIEW_OVERRIDE="  " git push', {}), null);
  assert.equal(overrideReason('git push', {}), null);
});

test('overrideReason counts only an override that belongs to the guarded command', () => {
  assert.equal(overrideReason('git commit --no-verify -m x && git push', {}), null);
  assert.equal(overrideReason('git commit -m "note PR_SELF_REVIEW_OVERRIDE=later" && git push', {}), null);
  assert.equal(overrideReason('echo PR_SELF_REVIEW_OVERRIDE=x; git push', {}), null);
  assert.equal(overrideReason('git push -m "--no-verify"', {}), null);
  assert.equal(overrideReason('git add . && PR_SELF_REVIEW_OVERRIDE=hotfix git push', {}), 'hotfix');
  assert.equal(overrideReason('git commit -m x && git push --no-verify', {}), '--no-verify');
  assert.equal(overrideReason('PR_SELF_REVIEW_OVERRIDE=a git push && gh pr create --fill', {}), null);
  assert.equal(overrideReason('echo x > --no-verify git push', {}), null);
  assert.equal(overrideReason('echo " PR_SELF_REVIEW_OVERRIDE=sneaky" git push', {}), null);
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
  assert.equal(isDocsOnly(['README.md', 'docs/a.md']), true);
  assert.equal(isDocsOnly(['README.md', 'docs/a.mdx']), false);
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

test('a suppression is a reason in words; anything else does not suppress', () => {
  assert.equal(isSuppressed({ suppressed: 'internal admin tool' }), true);
  for (const value of [true, 1, '', '   ', null, undefined, {}]) assert.equal(isSuppressed({ suppressed: value }), false);
  const result = computeVerdict({ checks: [{ name: 'lint', status: 'pass' }], findings: [{ ...critical, suppressed: true }] });
  assert.equal(result.verdict, 'blocked');
  assert.match(validateReview({ fingerprint: 'f', checks: [], findings: [{ ...critical, suppressed: true }] }).join(' '), /suppressed/);
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

const CONFIG_PATH = '.claude/pr-self-review.config.json';
const reviewed = { mergeBase: 'base1', files: { 'api/a.ts': 'h1', 'web/B.tsx': 'h2', 'web/C.tsx': 'h3' } };
const plan = (content, overrides = {}) =>
  reviewPlan({ previous: reviewed, mergeBase: 'base1', content: new Map(content), configPath: CONFIG_PATH, ...overrides });

test('reviewPlan reviews only the files whose content differs from the last review', () => {
  const result = plan([['api/a.ts', 'h1'], ['web/B.tsx', 'changed'], ['web/New.tsx', 'h4']]);
  assert.equal(result.mode, 'incremental');
  assert.deepEqual(result.files, ['web/B.tsx', 'web/New.tsx']);
  assert.deepEqual(result.removed, ['web/C.tsx']);
  assert.equal(plan(Object.entries(reviewed.files)).files.length, 0);
});

test('reviewPlan falls back to a full review without an earlier one, on a moved base or a changed config', () => {
  const content = [['api/a.ts', 'h1'], ['web/B.tsx', 'changed']];
  const all = ['api/a.ts', 'web/B.tsx'];
  for (const overrides of [{ previous: null }, { previous: { verdict: 'pass' } }, { mergeBase: 'base2' }]) {
    const result = plan(content, overrides);
    assert.equal(result.mode, 'full', JSON.stringify(overrides));
    assert.ok(result.reason);
    assert.deepEqual(result.files, all);
  }
  const withConfig = plan([...content, [CONFIG_PATH, 'new']]);
  assert.equal(withConfig.mode, 'full');
  assert.match(withConfig.reason, /config/);
});

test('reviewPlan widens the review to the whole folder of a changed instruction file', () => {
  const inFolder = plan([['api/a.ts', 'h1'], ['web/B.tsx', 'h2'], ['web/C.tsx', 'h3'], ['web/AGENTS.md', 'new']]);
  assert.equal(inFolder.mode, 'incremental');
  assert.deepEqual(inFolder.files, ['web/AGENTS.md', 'web/B.tsx', 'web/C.tsx']);
  assert.deepEqual(inFolder.widenedBy, ['web/AGENTS.md']);
  const atRoot = plan([['api/a.ts', 'h1'], ['web/B.tsx', 'h2'], ['web/C.tsx', 'h3'], ['CLAUDE.md', 'new']]);
  assert.deepEqual(atRoot.files, ['CLAUDE.md', 'api/a.ts', 'web/B.tsx', 'web/C.tsx']);
});

test('carriedFindings keeps the findings of files that were not reviewed again and are still in the change', () => {
  const previous = [
    { severity: 'critical', file: 'api/a.ts' },
    { severity: 'warning', file: 'web/B.tsx' },
    { severity: 'note', file: 'web/C.tsx' },
    { severity: 'note' },
  ];
  const incremental = plan([['api/a.ts', 'h1'], ['web/B.tsx', 'changed']]);
  assert.deepEqual(carriedFindings(previous, incremental, new Set(['api/a.ts', 'web/B.tsx'])), [previous[0]]);
  assert.deepEqual(carriedFindings(previous, plan([], { previous: null }), new Set(['api/a.ts'])), []);
});
