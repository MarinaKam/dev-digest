// Reads a shell line as text: removes what is data (comments, here-document bodies) and
// splits what is left into simple commands. Pure; tested through command.test.mjs.
//
// This is not a shell parser. It tracks just enough structure (quotes, `$( )`, groups) to
// tell a command from text that only looks like one, and it errs towards "this is a command".

const SEPARATORS = ['&&', '||', ';', '|', '&', '\n', '(', ')', '{', '}'];
const OPENERS = new Set(['(', '{']);
const CLOSERS = new Set([')', '}']);
const HEREDOC_OPERATOR = /<<-?\s*(["']?)([A-Za-z_][A-Za-z0-9_]*)\1/y;

/** The index just after the bodies of the given here-documents, which start at `start`. */
function afterBodies(text, start, delimiters) {
  let index = start;
  for (const delimiter of delimiters) {
    while (index < text.length) {
      const end = text.indexOf('\n', index);
      const line = text.slice(index, end === -1 ? text.length : end);
      index = end === -1 ? text.length : end + 1;
      if (line.trim() === delimiter) break;
    }
  }
  return index;
}

function heredocAt(text, index) {
  if (!text.startsWith('<<', index) || text.startsWith('<<<', index)) return null;
  HEREDOC_OPERATOR.lastIndex = index;
  return HEREDOC_OPERATOR.exec(text);
}

function startsComment(text, index) {
  return text[index] === '#' && (index === 0 || /\s/.test(text[index - 1]));
}

/**
 * One step of the scan in a place where the shell reads commands (the top level or inside
 * `$( )`). Returns how many characters to copy, how many to drop, and what to remember.
 */
function commandStep(text, index, context) {
  const char = text[index];
  if (char === '"' || char === "'") return { copy: 1, push: char };
  if (text.startsWith('$(', index)) return { copy: 2, push: '(' };
  if (char === '(') return { copy: 1, push: '(' };
  if (char === ')' && context === '(') return { copy: 1, pop: true };
  if (startsComment(text, index)) {
    const end = text.indexOf('\n', index);
    return { drop: (end === -1 ? text.length : end) - index };
  }
  if (text.startsWith('<<<', index)) return { copy: 3 };
  const heredoc = heredocAt(text, index);
  if (heredoc) return { copy: heredoc[0].length, heredoc: heredoc[2] };
  return { copy: 1 };
}

function quotedStep(text, index, context) {
  const char = text[index];
  if (context === "'") return { copy: 1, pop: char === "'" };
  if (char === '"') return { copy: 1, pop: true };
  if (text.startsWith('$(', index)) return { copy: 2, push: '(' };
  return { copy: char === '\\' ? 2 : 1 };
}

/**
 * Removes comments and here-document bodies. A `<<WORD` counts only where the shell would
 * read it as an operator: not inside quotes, not in a comment, not as part of `<<<`.
 */
export function withoutData(text) {
  let output = '';
  let contexts = [];
  let pending = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] === '\n' && pending.length > 0) {
      output += '\n';
      index = afterBodies(text, index + 1, pending);
      pending = [];
      continue;
    }
    const context = contexts.at(-1);
    const quoted = context === '"' || context === "'";
    const escaped = !quoted && text[index] === '\\';
    const step = escaped ? { copy: 2 } : (quoted ? quotedStep : commandStep)(text, index, context);
    output += text.slice(index, index + (step.copy ?? 0));
    index += (step.copy ?? 0) + (step.drop ?? 0);
    if (step.pop) contexts = contexts.slice(0, -1);
    if (step.push) contexts = [...contexts, step.push];
    if (step.heredoc) pending = [...pending, step.heredoc];
  }
  return output;
}

function separatorAt(text, index) {
  const separator = SEPARATORS.find((candidate) => text.startsWith(candidate, index));
  if (separator === '{' && text[index - 1] === '$') return null;
  return separator ?? null;
}

/**
 * The simple commands of a shell line, each with the separator before and after it and its
 * nesting depth inside `( )` and `{ }`. Separators inside quotes do not split.
 */
export function segmentsOf(command) {
  const segments = [];
  let current = { text: '', before: null, depth: 0 };
  let depth = 0;
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const separator = quote ? null : separatorAt(command, index);
    if (!separator) {
      if (quote && char === quote) quote = null;
      else if (!quote && (char === '"' || char === "'")) quote = char;
      current = { ...current, text: current.text + char };
      continue;
    }
    segments.push({ ...current, after: separator });
    if (OPENERS.has(separator)) depth += 1;
    if (CLOSERS.has(separator)) depth = Math.max(0, depth - 1);
    current = { text: '', before: separator, depth };
    index += separator.length - 1;
  }
  return [...segments, { ...current, after: null }]
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text !== '');
}

/** Splits a shell line into simple commands. */
export function splitCommands(command) {
  return segmentsOf(command).map((segment) => segment.text);
}
