// Finds a guarded action (a push, a pull request creation or merge) in a shell line, and
// the folder it would run in. Pure text analysis, tested in command.test.mjs.
//
// The rule is positional, not a list of known wrappers: inside one simple command, any
// word that names `git` or `gh` starts a candidate, wherever it stands. So `timeout 30
// git push`, `then git push` and `xargs git push` need no special case.
//
// It is deliberately conservative. An ambiguous form is reported as the action. The folder
// is reported only when the text leaves no doubt about it; otherwise it is `null`, and the
// caller refuses. A folder change is believed only as a top-level `cd x &&`.
//
// It does not follow a persistent alias, a variable holding a whole command, script files,
// or a command passed as data to another program (`echo "..." | sh`, `node -e`, `gh api`).
import { resolve } from 'node:path';
import { lex } from './shell-text.mjs';

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SHELL_KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', 'time']);
const ENTER_FOLDER = new Set(['cd', 'pushd']);
const LEAVE_FOLDER = new Set(['popd']);
const TRUSTED_BEFORE_FOLDER_CHANGE = new Set([null, '&&', ';', '\n']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const SCRIPT_RUNNERS = new Set([...SHELLS, 'eval', 'trap', 'su', 'watch']);
const GIT_FOLDER_OPTION_WITH_ATTACHED_VALUE = /^-C./;
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const GIT_OPTIONS_MOVING_THE_REPOSITORY = /^--(git-dir|work-tree)(=|$)/;
const GIT_CONFIG_RENAMING_A_SUBCOMMAND = /^alias\./i;
const GIT_PUBLISHING_SUBCOMMANDS = new Set(['push', 'send-pack']);
const GH_REPOSITORY_OPTION = /^(-R|--repo)(=|$)/;
const GH_OPTIONS_WITH_VALUE = new Set(['-R', '--repo', '--hostname']);
const ABSOLUTE_PATH = /^\//;
const PREFIX_OPTION_CHANGING_THE_FOLDER = /^(-C|--chdir|-D|--directory|--cwd|--workdir)(=|$)|^-C./;
const VARIABLE_REDIRECTING_CD = /\bCDPATH\s*=/;
const UNREADABLE_COMMAND = 'a push or pull request command';
const GUARDED_WORDS = /\bpush\b|\bpr\s+(create|merge)\b/;
const VARIABLE_MOVING_THE_REPOSITORY = /\bGIT_(DIR|WORK_TREE|COMMON_DIR)\s*=/;
const VARIABLE_INJECTING_GIT_CONFIG = /\bGIT_CONFIG\w*\s*=/;
const VARIABLE_NAMING_THE_GH_REPOSITORY = /\bGH_REPO\s*=/;

/** Loose test for text that could not be parsed as a tool call. */
export function mentionsGuardedWords(text) {
  return GUARDED_WORDS.test(text ?? '');
}

/** The program a word names: the folder is dropped; `$` stands for "named by a variable". */
function programOf(word) {
  if (!word) return '';
  if (word.dynamic && /[$`]/.test(word.value)) return '$';
  return word.value.slice(word.value.lastIndexOf('/') + 1);
}

function isKeyword(word) {
  return !word.quoted && SHELL_KEYWORDS.has(word.value);
}

function isAssignment(word) {
  return ASSIGNMENT.test(word.value);
}

/** The words of a simple command without leading keywords and assignments. */
function wordsOf(segment) {
  const first = segment.words.findIndex((word) => !isAssignment(word) && !isKeyword(word));
  const lead = first === -1 ? segment.words : segment.words.slice(0, first);
  return {
    words: first === -1 ? [] : segment.words.slice(first),
    conditional: lead.some(isKeyword),
  };
}

/** The folder a word names, or null when the text does not settle it. */
function resolveDirectory(directory, word) {
  const settled = word && word.value !== '' && !word.dynamic && !word.escaped && !word.value.startsWith('-');
  return directory !== null && settled ? resolve(directory, word.value) : null;
}

/** The folder after a `cd`/`pushd`/`popd`, or null when the change cannot be relied on. */
function folderAfter(segment, parsed, context) {
  const program = programOf(parsed.words[0]);
  if (LEAVE_FOLDER.has(program)) return null;
  const searchPathApplies = context.cdpath && !ABSOLUTE_PATH.test(parsed.words[1]?.value ?? '');
  const trusted =
    segment.depth === 0 &&
    segment.after === '&&' &&
    TRUSTED_BEFORE_FOLDER_CHANGE.has(segment.before) &&
    !parsed.conditional &&
    !searchPathApplies;
  return trusted ? resolveDirectory(context.directory, parsed.words[1]) : null;
}

function gitAction(words, context) {
  let target = context.directory;
  let renamed = context.configInjected;
  let index = 1;
  while (index < words.length && words[index].value.startsWith('-')) {
    const option = words[index].value;
    const value = words[index + 1]?.value ?? '';
    if (option === '-C') target = resolveDirectory(target, words[index + 1]);
    if (GIT_OPTIONS_MOVING_THE_REPOSITORY.test(option)) target = null;
    if (GIT_FOLDER_OPTION_WITH_ATTACHED_VALUE.test(option)) target = null;
    if (option === '-c' && GIT_CONFIG_RENAMING_A_SUBCOMMAND.test(value)) renamed = true;
    if (option.startsWith('--config-env')) renamed = true;
    index += GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
  }
  const publishes = renamed || GIT_PUBLISHING_SUBCOMMANDS.has(words[index]?.value);
  return publishes ? { action: 'git push', directory: target } : null;
}

function pullRequestAction(words, start, directory) {
  const verb = words[start + 1]?.value;
  const guarded = words[start]?.value === 'pr' && (verb === 'create' || verb === 'merge');
  return guarded ? { action: `gh pr ${verb}`, directory } : null;
}

/** `gh` aimed at a named repository acts on it from any folder: judge it in the session's. */
function ghAction(words, context) {
  let index = 1;
  while (index < words.length && words[index].value.startsWith('-')) {
    index += GH_OPTIONS_WITH_VALUE.has(words[index].value) ? 2 : 1;
  }
  const named = context.ghRepositoryNamed || words.some((word) => GH_REPOSITORY_OPTION.test(word.value));
  return pullRequestAction(words, index, named ? context.origin : context.directory);
}

/** A command named by a variable cannot be read; judge it by the words that follow. */
function variableAction(words, context) {
  const rest = words.slice(1);
  if (rest.some((word) => word.value === 'push')) return { action: 'git push', directory: context.directory };
  const pr = rest.findIndex((word) => word.value === 'pr');
  return pr === -1 ? null : pullRequestAction(rest, pr, context.directory);
}

/** Every argument of a shell, `eval`, `trap` and the like may be a script: analyse each one. */
function scriptAction(words, context) {
  // The script starts in the folder known so far; its own folder changes are judged afresh.
  const start = { ...context, moved: false };
  for (const word of words.slice(1)) {
    const found = analyse(word.value, start);
    if (found) return found;
  }
  return null;
}

/** The action that starts at one word of a simple command, or null. */
function actionAt(words, position, context) {
  const candidate = words.slice(position);
  const program = programOf(candidate[0]);
  if (program === 'git') return gitAction(candidate, context);
  if (program === 'gh') return ghAction(candidate, context);
  if (SCRIPT_RUNNERS.has(program)) return scriptAction(candidate, context);
  if (program === '$' && position === 0) return variableAction(candidate, context);
  return null;
}

/** A program in front of the command may run it elsewhere (`env -C`, `sudo --chdir`). */
function prefixMovesTheFolder(words, position) {
  return words.slice(0, position).some((word) => PREFIX_OPTION_CHANGING_THE_FOLDER.test(word.value));
}

function actionIn(words, context) {
  for (let position = 0; position < words.length; position += 1) {
    const found = actionAt(words, position, context);
    if (found) return prefixMovesTheFolder(words, position) ? { ...found, directory: null } : found;
  }
  return null;
}

/** The first guarded action among the simple commands of one list, or null. */
function actionInList(segments, startContext) {
  let context = startContext;
  for (const segment of segments) {
    // After a folder change, only an unbroken `&&` chain proves where a command runs:
    // behind any other separator it may run although the change failed.
    if (context.moved && segment.before !== '&&') context = { ...context, directory: null };
    const parsed = wordsOf(segment);
    const program = programOf(parsed.words[0]);
    if (ENTER_FOLDER.has(program) || LEAVE_FOLDER.has(program)) {
      context = { ...context, moved: true, directory: folderAfter(segment, parsed, context) };
      continue;
    }
    const found = actionIn(parsed.words, context);
    if (found) return found;
  }
  return null;
}

/**
 * Substitutions are judged first, each from the folder known at the start. A line that does
 * not close what it opens and still mentions a guarded command is reported with no folder.
 */
function analyse(text, startContext) {
  const { lists, balanced } = lex(text);
  const [top, ...nested] = lists;
  for (const segments of [...nested, top]) {
    const found = actionInList(segments, startContext);
    if (found) return found;
  }
  const unreadable = !balanced && GUARDED_WORDS.test(text);
  return unreadable ? { action: UNREADABLE_COMMAND, directory: null } : null;
}

/**
 * The first guarded action a shell line would run and the folder it would run in:
 * `{ action, directory }`, with `directory: null` when the folder cannot be known, or
 * null when the line runs no guarded action. `environment.cdpath` says that CDPATH is set
 * for the shell, which makes a relative `cd` land somewhere the text does not show.
 */
export function findGuarded(command, cwd, environment = {}) {
  const text = command ?? '';
  const found = analyse(text, {
    origin: cwd,
    directory: cwd,
    moved: false,
    cdpath: Boolean(environment.cdpath) || VARIABLE_REDIRECTING_CD.test(text),
    configInjected: VARIABLE_INJECTING_GIT_CONFIG.test(text),
    ghRepositoryNamed: VARIABLE_NAMING_THE_GH_REPOSITORY.test(text),
  });
  if (found && !found.action.startsWith('gh ') && VARIABLE_MOVING_THE_REPOSITORY.test(text)) {
    return { ...found, directory: null };
  }
  return found;
}

export function guardedAction(command) {
  return findGuarded(command, '/')?.action ?? null;
}
