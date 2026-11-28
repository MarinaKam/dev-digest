// Run: node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findGuarded, guardedAction, mentionsGuardedWords } from './command.mjs';
import { lex } from './shell-text.mjs';

function valuesOf(command) {
  return lex(command).lists[0].map((segment) => segment.words.map((word) => word.value));
}

test('lex splits on separators and keeps quoted separators together', () => {
  assert.deepEqual(valuesOf('cd api && git push; echo done'), [['cd', 'api'], ['git', 'push'], ['echo', 'done']]);
  assert.deepEqual(valuesOf('git commit -m "fix; git push later"'), [['git', 'commit', '-m', 'fix; git push later']]);
  assert.deepEqual(valuesOf('a & b | c'), [['a'], ['b'], ['c']]);
  assert.deepEqual(valuesOf('git push 2>&1'), [['git', 'push', '2>&1']]);
  assert.deepEqual(valuesOf('echo a{b,c} ${X:-y}'), [['echo', 'a{b,c}', '${X:-y}']]);
});

test('lex reads quoting and escaping the way the shell does', () => {
  assert.deepEqual(valuesOf('echo "\\"" ; ls'), [['echo', '"'], ['ls']]);
  assert.deepEqual(valuesOf('echo "a\\"b; ls"'), [['echo', 'a"b; ls']]);
  assert.deepEqual(valuesOf("echo $'it\\'s' ; ls"), [['echo', "it's"], ['ls']]);
  assert.deepEqual(valuesOf('g"i"t pu\'\'sh'), [['git', 'push']]);
  assert.deepEqual(valuesOf('git \\\npush'), [['git', 'push']]);
  assert.deepEqual(valuesOf('echo a\\ #b; ls'), [['echo', 'a #b'], ['ls']]);
  assert.equal(lex('echo "unterminated').balanced, false);
  assert.equal(lex('echo $(ls').balanced, false);
  assert.equal(lex('cat <<EOF\nbody').balanced, false);
  assert.equal(lex('echo ok').balanced, true);
});

const SHELL_READS_AS_A_PUSH = [
  'echo a\\ #; git push',
  'echo $((1<<EOF))\ngit push\nEOF',
  '((x = 1 << EOF))\ngit push\nEOF',
  'cat <<EOF\ngit push',
  "echo $'it\\'s' ; git push ; echo 'x'",
  'echo "\\"" ; git push',
  'echo "\\\\" ; git push ; echo "\\\\"',
  'echo $((git push) )',
  'git \\\npush',
  'g"i"t push',
  "git pu''sh",
  'case x in a) git push;; esac',
  'echo a{b,c} && git push',
  'echo "$(echo ")" )" ; git push',
  'echo `echo \\`` ; git push',
];

test('guardedAction agrees with the shell on quoting, comments, arithmetic and here-documents', () => {
  for (const command of SHELL_READS_AS_A_PUSH) {
    assert.equal(guardedAction(command), 'git push', JSON.stringify(command));
  }
  assert.equal(guardedAction('echo "a\\"b; git push"'), null);
  assert.equal(guardedAction("echo $'a\\'; git push'"), null);
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

const HIDDEN_IN_AN_EXPANSION = [
  'echo ${x:-$(git push)}',
  'echo ${x:-`git push`}',
  'echo "${x:-$(git push)}"',
  'echo ${a:-${b:-$(git push)}}',
  'echo $(( $(git push) + 1 ))',
  'echo $((1 + `git push`))',
  "$'\\x67it' push",
  "git $'pu\\x73h'",
  'git $SUB origin',
  'git "$@"',
  'gh pr $VERB',
  'gh $A $B',
  '"gi\\\nt" push',
  'cat <<EOF\n$(git push)\nEOF',
  'cat <<EOF\n`git push`\nEOF',
  'cat <<-EOF\n\t${x:-$(git push)}\n\tEOF',
  '/usr/bin/gi? push',
  '"$HOME"/bin/git push',
];

test('a guarded command hidden in an expansion, or behind a word the text does not settle, is found', () => {
  for (const command of HIDDEN_IN_AN_EXPANSION) {
    assert.notEqual(guardedAction(command), null, JSON.stringify(command));
  }
});

const EXPANSIONS_THAT_RUN_NOTHING_GUARDED = [
  "cat <<'EOF'\n$(git push)\nEOF",
  'cat <<"EOF"\n$(git push)\nEOF',
  'cat <<\\EOF\n$(git push)\nEOF',
  'cat <<EOF\ngit push is gated\nEOF',
  "git commit -m \"$(cat <<'EOF'\nfix: push it\nEOF\n)\"",
  'git -C "$DIR" status',
  'git log $RANGE',
  'gh pr view $NUMBER',
  'echo ${x:-push}',
  'echo $((1 + 2))',
  "echo 'git push' \"$x\"",
];

test('an expansion that runs nothing guarded does not close the gate', () => {
  for (const command of EXPANSIONS_THAT_RUN_NOTHING_GUARDED) {
    assert.equal(guardedAction(command), null, JSON.stringify(command));
  }
});

test('lex applies the escape rules of each kind of quote', () => {
  assert.deepEqual(valuesOf('echo "a\\b" "c\\$d" "e\\\nf"'), [['echo', 'a\\b', 'c$d', 'ef']]);
  assert.equal(lex("echo $'a\\x41'").lists[0][0].words[1].dynamic, true);
  assert.equal(lex("echo $'plain'").lists[0][0].words[1].dynamic, false);
});

const UNTRUSTED_FOLDER_CHANGES = [
  '(cd /other); git push',
  '(cd /other && true); git push',
  'cd /other; git push',
  'cd /other\ngit push',
  'cd /other || true; git push',
  'true || cd /other && git push',
  'cd /other & git push',
  'cd /other | git push',
  '{ cd /other; }; git push',
  'f() { cd /other && true; }; git push',
  'if false; then cd /other && true; fi; git push',
  'while false; do cd /other && true; done; git push',
  'pushd /other && popd && git push',
  'pushd /other && popd; git push',
  'cd /other && npm test; git push',
  'cd /other && false || git push',
  'cd /other && true | git push',
  'cd /other && true\ngit push',
  'cd /other\\ repo && git push',
  'cd /other && cd - && git push',
  'cd /other && env -C /repo git push',
  'cd /other && sudo --chdir=/repo git push',
  'CDPATH=/elsewhere cd api && git push',
];

test('a command handed to a program that runs scripts is read as a script', () => {
  assert.equal(guardedAction('trap "git push" EXIT'), 'git push');
  assert.equal(guardedAction('su deploy -c "git push"'), 'git push');
  assert.equal(guardedAction('watch -n 5 "gh pr create --fill"'), 'gh pr create');
  assert.equal(findGuarded('cd /other && trap "git -C /repo push" EXIT', '/repo').directory, '/repo');
});

test('an option glued to its folder is not guessed at', () => {
  assert.deepEqual(findGuarded('cd /other && git -C/repo push', '/repo'), { action: 'git push', directory: null });
});

test('a relative folder change is not trusted while CDPATH is in effect', () => {
  assert.equal(findGuarded('cd api && git push', '/repo', { cdpath: true }).directory, null);
  assert.equal(findGuarded('cd /other && git push', '/repo', { cdpath: true }).directory, '/other');
  assert.equal(findGuarded('git -C api push', '/repo', { cdpath: true }).directory, '/repo/api');
});

test('a folder change is trusted only as a top-level "cd x &&"', () => {
  for (const command of UNTRUSTED_FOLDER_CHANGES) {
    const found = findGuarded(command, '/repo');
    assert.equal(found?.action, 'git push', command);
    assert.equal(found.directory, null, command);
  }
  assert.equal(findGuarded('cd /other && git push', '/repo').directory, '/other');
  assert.equal(findGuarded('ls; cd a && cd b && git push', '/repo').directory, '/repo/a/b');
  assert.equal(findGuarded('pushd api && git push', '/repo').directory, '/repo/api');
});

test('an environment variable that moves the repository makes the folder unknown', () => {
  for (const command of [
    'GIT_DIR=/repo/.git git -C /other push',
    'export GIT_WORK_TREE=/repo; cd /other && git push',
    'env GIT_COMMON_DIR=/repo/.git git -C /other push',
    'cd /other && GIT_DIR="/repo/.git" git push',
  ]) {
    assert.deepEqual(findGuarded(command, '/repo'), { action: 'git push', directory: null }, command);
  }
});

test('gh with an explicit repository is judged in the session folder', () => {
  for (const command of [
    'cd /other && gh pr create -R me/project --fill',
    'cd /other && gh pr create --repo me/project',
    'cd /other && gh pr merge 3 --repo=me/project',
    'cd /other && gh -R me/project pr create',
    'cd /other && GH_REPO=me/project gh pr create',
  ]) {
    assert.equal(findGuarded(command, '/repo').directory, '/repo', command);
  }
  assert.equal(findGuarded('cd /other && gh pr create --fill', '/repo').directory, '/other');
});

test('a here-document counts only where the shell would see one', () => {
  const hidden = [
    ['echo "<<EOF"', 'git push', 'EOF'],
    ["echo '<<EOF'", 'git push', 'EOF'],
    ['# <<EOF', 'git push', 'EOF'],
    ['echo x # <<EOF', 'git push', 'EOF'],
    ['cat <<< "<<EOF"', 'git push', 'EOF'],
  ];
  for (const lines of hidden) {
    assert.equal(guardedAction(lines.join('\n')), 'git push', lines[0]);
  }
  const commit = ['git commit -m "$(cat <<\'EOF\'', 'fix: push notifications', 'git push is gated now', 'EOF', ')"'];
  assert.equal(guardedAction(commit.join('\n')), null);
  assert.equal(guardedAction(['cat <<A <<B', 'git push', 'A', 'gh pr create', 'B', 'ls'].join('\n')), null);
});

test('a comment is not a command', () => {
  assert.equal(guardedAction('ls # git push'), null);
  assert.equal(guardedAction('# gh pr create\nls'), null);
  assert.equal(guardedAction('echo a#b && git push'), 'git push');
});

test('git configuration that can rename a subcommand is treated as a push', () => {
  for (const command of [
    'git -c alias.p=push p',
    'git -c "alias.x=push" x origin',
    'git -c ALIAS.x=push x',
    'git send-pack origin HEAD',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.p GIT_CONFIG_VALUE_0=push git p',
    'git --config-env=alias.p=VALUE p',
  ]) {
    assert.equal(guardedAction(command), 'git push', command);
  }
  assert.equal(guardedAction('git -c color.ui=false status'), null);
  assert.equal(guardedAction('git -c user.name=x commit -m y'), null);
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
  assert.deepEqual(findGuarded('cd /a && sh -c "cd b && gh pr create"', '/repo'), {
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
