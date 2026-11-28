// Finds a guarded action (a push, a pull request creation or merge) in a shell line, and
// the folder it would run in. Pure text analysis, tested in command.test.mjs.
//
// The rule is positional, not a list of known wrappers: inside one simple command, any
// word that names `git` or `gh` starts a candidate, wherever it stands. So `timeout 30
// git push`, `then git push` and `xargs git push` need no special case.
//
// It is deliberately conservative: an ambiguous form is reported as the action, and a
// folder that cannot be known is reported as `directory: null`, so the caller can refuse.
// It does not follow aliases, a variable holding a whole command, script files, or a
// command passed as data to another program (`echo "..." | sh`, `node -e`, `gh api`).
import { resolve } from 'node:path';

const SEPARATORS = ['&&', '||', ';', '|', '&', '\n', '(', ')', '{', '}'];
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SHELL_KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', 'time']);
const FOLDER_COMMANDS = new Set(['cd', 'pushd']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const GIT_OPTIONS_MOVING_THE_REPOSITORY = /^--(git-dir|work-tree)(=|$)/;
const GH_OPTIONS_WITH_VALUE = new Set(['-R', '--repo', '--hostname']);
const UNRESOLVABLE_PATH = /[$~`*?]|^-/;
const HEREDOC_START = /<<-?\s*(["']?)([A-Za-z_][A-Za-z0-9_]*)\1/;
const SUBSTITUTION = /\$\(([^()]*)\)|`([^`]*)`/g;
const WORD = /"[^"]*"|'[^']*'|[^\s"']+(?:"[^"]*"|'[^']*')?/g;
const GUARDED_WORDS = /\bpush\b|\bpr\s+(create|merge)\b/;

/** Loose test for text that could not be parsed as a tool call. */
export function mentionsGuardedWords(text) {
  return GUARDED_WORDS.test(text ?? '');
}

/** Removes here-document bodies: they are data for a command, not commands. */
function stripHeredocs(text) {
  const kept = [];
  let delimiter = null;
  for (const line of text.split('\n')) {
    if (delimiter !== null) {
      if (line.trim() === delimiter) delimiter = null;
    } else {
      kept.push(line);
      delimiter = HEREDOC_START.exec(line)?.[2] ?? null;
    }
  }
  return kept.join('\n');
}

function separatorAt(text, index) {
  const separator = SEPARATORS.find((candidate) => text.startsWith(candidate, index));
  if (separator === '{' && text[index - 1] === '$') return null;
  return separator ?? null;
}

/** Splits a shell line into simple commands. Separators inside quotes do not split. */
export function splitCommands(command) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const separator = quote ? null : separatorAt(command, index);
    if (separator) {
      parts.push(current);
      current = '';
      index += separator.length - 1;
    } else {
      if (quote && char === quote) quote = null;
      else if (!quote && (char === '"' || char === "'")) quote = char;
      current += char;
    }
  }
  return [...parts, current].map((part) => part.trim()).filter(Boolean);
}

/** A word as the shell would pass it on: surrounding quotes and escaping backslashes removed. */
function plain(word) {
  const text = word ?? '';
  const quoted = /^(["'])([\s\S]*)\1$/.exec(text);
  return quoted ? quoted[2] : text.replace(/\\/g, '');
}

/** The program a word names: the folder is dropped; `$` stands for "named by a variable". */
function programOf(word) {
  const text = plain(word);
  return text.includes('$') ? '$' : text.slice(text.lastIndexOf('/') + 1);
}

/** The words of a simple command, without leading shell keywords and assignments. */
function wordsOf(simpleCommand) {
  const words = simpleCommand.match(WORD) ?? [];
  const first = words.findIndex((word) => !ASSIGNMENT.test(word) && !SHELL_KEYWORDS.has(word));
  return first === -1 ? [] : words.slice(first);
}

function resolveDirectory(directory, rawPath) {
  const path = plain(rawPath);
  if (directory === null || !path || UNRESOLVABLE_PATH.test(path)) return null;
  return resolve(directory, path);
}

function gitAction(words, directory) {
  let target = directory;
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    const option = words[index];
    if (option === '-C') target = resolveDirectory(target, words[index + 1]);
    if (GIT_OPTIONS_MOVING_THE_REPOSITORY.test(option)) target = null;
    index += GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
  }
  return plain(words[index]) === 'push' ? { action: 'git push', directory: target } : null;
}

function pullRequestAction(words, start, directory) {
  const verb = plain(words[start + 1]);
  const guarded = plain(words[start]) === 'pr' && (verb === 'create' || verb === 'merge');
  return guarded ? { action: `gh pr ${verb}`, directory } : null;
}

function ghAction(words, directory) {
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    index += GH_OPTIONS_WITH_VALUE.has(words[index]) ? 2 : 1;
  }
  return pullRequestAction(words, index, directory);
}

/** A command named by a variable cannot be read; judge it by the words that follow. */
function variableAction(words, directory) {
  const rest = words.slice(1).map(plain);
  if (rest.includes('push')) return { action: 'git push', directory };
  const pr = rest.indexOf('pr');
  return pr === -1 ? null : pullRequestAction(rest, pr, directory);
}

/** Every argument of a shell or of `eval` may be a script: analyse each one. */
function scriptAction(words, directory) {
  for (const word of words.slice(1)) {
    const found = analyse(plain(word), directory);
    if (found) return found;
  }
  return null;
}

/** The action that starts at one word of a simple command, or null. */
function actionAt(words, position, directory) {
  const candidate = words.slice(position);
  const program = programOf(candidate[0]);
  if (program === 'git') return gitAction(candidate, directory);
  if (program === 'gh') return ghAction(candidate, directory);
  if (program === 'eval' || SHELLS.has(program)) return scriptAction(candidate, directory);
  if (program === '$' && position === 0) return variableAction(candidate, directory);
  return null;
}

function analyse(rawText, startDirectory) {
  const text = stripHeredocs(rawText);
  for (const match of text.matchAll(SUBSTITUTION)) {
    const found = analyse(match[1] ?? match[2] ?? '', startDirectory);
    if (found) return found;
  }
  let directory = startDirectory;
  for (const simpleCommand of splitCommands(text)) {
    const words = wordsOf(simpleCommand);
    if (FOLDER_COMMANDS.has(programOf(words[0]))) {
      directory = resolveDirectory(directory, words[1]);
      continue;
    }
    for (let position = 0; position < words.length; position += 1) {
      const found = actionAt(words, position, directory);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The first guarded action a shell line would run and the folder it would run in:
 * `{ action, directory }`, with `directory: null` when the folder cannot be known, or
 * null when the line runs no guarded action.
 */
export function findGuarded(command, cwd) {
  return analyse(command ?? '', cwd);
}

export function guardedAction(command) {
  return findGuarded(command, '/')?.action ?? null;
}
