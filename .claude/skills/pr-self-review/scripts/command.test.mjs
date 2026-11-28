// Run: node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findGuarded, guardedAction, mentionsGuardedWords, splitCommands } from './command.mjs';

test('splitCommands splits on separators and keeps quoted separators together', () => {
  assert.deepEqual(splitCommands('cd api && git push; echo done'), ['cd api', 'git push', 'echo done']);
  assert.deepEqual(splitCommands('git commit -m "fix; git push later"'), [
    'git commit -m "fix; git push later"',
  ]);
  assert.deepEqual(splitCommands('a & b | c'), ['a', 'b', 'c']);
});

test('guardedAction finds a push, a pull request creation and a merge', () => {
  assert.equal(guardedAction('git push -u origin feat/x'), 'git push');
  assert.equal(guardedAction('git -C ../repo -c a=b push'), 'git push');
  assert.equal(guardedAction('cd api && FOO=1 git push'), 'git push');
  assert.equal(guardedAction('gh pr create --base main --title "x"'), 'gh pr create');
  assert.equal(guardedAction('gh pr merge 12 --squash'), 'gh pr merge');
});

test('guardedAction ignores commands that only mention a guarded word', () => {
  assert.equal(guardedAction('git stash push -m wip'), null);
  assert.equal(guardedAction('git log --grep push'), null);
  assert.equal(guardedAction('git commit -m "prepare git push"'), null);
  assert.equal(guardedAction('gh pr list'), null);
  assert.equal(guardedAction('echo "gh pr create"'), null);
  assert.equal(guardedAction('env FOO=1 git stash push'), null);
  assert.equal(guardedAction('git commit -m "a & b; (git push)"'), null);
  assert.equal(guardedAction('grep -rn "git push" docs'), null);
  assert.equal(guardedAction("sh -c 'git status'"), null);
  assert.equal(guardedAction(''), null);
});

const WRAPPED_PUSHES = [
  'git push &',
  'true&&git push',
  'git push||true',
  '(git push)',
  '{ git push; }',
  'echo $(git push)',
  'echo "$(git push origin x)"',
  'echo `git push`',
  'env git push',
  'env FOO=1 BAR=2 git push',
  'command git push',
  'sudo -E git push',
  'exec git push',
  'nohup git push',
  'time git push',
  'xargs git push',
  '/usr/bin/git push',
  '\\git push',
  'sh -c "git push"',
  "bash -lc 'cd api && git push -u origin x'",
  'eval "git push"',
  '"$GIT" push origin x',
  'git --no-pager -c color.ui=false push',
  'if true; then git push; fi',
  'for r in origin; do git push $r; done',
  '! git push',
  "git 'push'",
  'git "push" origin',
  'git p\\ush',
  'timeout 30 git push',
  'stdbuf -o0 git push',
  'sudo -u deploy git push',
  'npx git push',
  'bash <<< "git push"',
  'echo git push | sh',
];

const HARMLESS = [
  'git status',
  'git commit -m "docs: explain git push gate"',
  'git log --oneline -5 | grep push',
  'git config push.default current',
  'git remote show origin',
  'gh pr view 12',
  'gh pr list --state open',
  'gh pr checks',
  'rg "gh pr create" docs',
  'echo push',
  'npm run push-docs',
  'bash scripts/dev.sh',
];

test('guardedAction lets everyday commands that mention a guarded word through', () => {
  for (const command of HARMLESS) {
    assert.equal(guardedAction(command), null, command);
  }
});

test('findGuarded keeps tracking the folder through shell keywords', () => {
  assert.equal(findGuarded('if true; then cd api; fi; git push', '/repo').directory, '/repo/api');
  assert.equal(findGuarded('pushd api && git push', '/repo').directory, '/repo/api');
});

test('guardedAction sees a push behind separators, substitutions, wrappers and paths', () => {
  for (const command of WRAPPED_PUSHES) {
    assert.equal(guardedAction(command), 'git push', command);
  }
});

test('guardedAction sees a wrapped pull request command', () => {
  assert.equal(guardedAction('gh -R owner/repo pr create --fill'), 'gh pr create');
  assert.equal(guardedAction('/opt/homebrew/bin/gh pr merge 1'), 'gh pr merge');
  assert.equal(guardedAction('env GH_TOKEN=x gh pr create'), 'gh pr create');
  assert.equal(guardedAction('sh -c "gh pr merge 3 --squash"'), 'gh pr merge');
  assert.equal(guardedAction('gh "pr" create'), 'gh pr create');
  assert.equal(guardedAction('timeout 60 gh pr create --fill'), 'gh pr create');
});

test('guardedAction holds for every wrapper combined with every frame', () => {
  const wrappers = ['', 'env ', 'command ', 'sudo ', 'env A=1 command ', '/usr/local/bin/'];
  const frames = [
    (text) => text,
    (text) => `ls && ${text}`,
    (text) => `ls; ${text} &`,
    (text) => `(${text})`,
    (text) => `sh -c "${text}"`,
    (text) => `echo $(${text})`,
  ];
  const actions = [
    ['git push', 'git push'],
    ['git -C . push', 'git push'],
    ['gh pr create', 'gh pr create'],
    ['gh pr merge 1', 'gh pr merge'],
  ];
  for (const wrapper of wrappers) {
    for (const frame of frames) {
      for (const [text, expected] of actions) {
        const command = frame(`${wrapper}${text}`);
        assert.equal(guardedAction(command), expected, command);
      }
    }
  }
});

test('guardedAction does not read the body of a here-document as commands', () => {
  const script = ["python3 - <<'E'", 'git push', 'gh pr create', 'E', 'ls'].join('\n');
  assert.equal(guardedAction(script), null);
  const message = ['git commit -m "$(cat <<EOF', 'git push is blocked now', 'EOF', ')"'].join('\n');
  assert.equal(guardedAction(message), null);
  const after = ["cat <<'E'", 'text', 'E', 'git push'].join('\n');
  assert.equal(guardedAction(after), 'git push');
});

test('findGuarded resolves the folder the command would run in', () => {
  assert.deepEqual(findGuarded('git push', '/repo'), { action: 'git push', directory: '/repo' });
  assert.deepEqual(findGuarded('cd api && git push', '/repo'), { action: 'git push', directory: '/repo/api' });
  assert.deepEqual(findGuarded('git -C ../other push', '/repo'), { action: 'git push', directory: '/other' });
  assert.deepEqual(findGuarded('cd /a; sh -c "cd b && gh pr create"', '/repo'), {
    action: 'gh pr create',
    directory: '/a/b',
  });
});

test('findGuarded reports an unknown folder instead of guessing', () => {
  assert.equal(findGuarded('cd "$SOMEWHERE" && git push', '/repo').directory, null);
  assert.equal(findGuarded('cd ~/x && git push', '/repo').directory, null);
  assert.equal(findGuarded('git --git-dir=/x/.git push', '/repo').directory, null);
  assert.equal(findGuarded('git --work-tree /x push', '/repo').directory, null);
});

test('mentionsGuardedWords is the fallback for input that cannot be parsed', () => {
  assert.equal(mentionsGuardedWords('{"command": "git push"'), true);
  assert.equal(mentionsGuardedWords('gh  pr   merge'), true);
  assert.equal(mentionsGuardedWords('git status'), false);
});
