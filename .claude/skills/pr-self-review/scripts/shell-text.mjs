// One lexer for a shell line. Everything the gate knows about a command comes from here,
// so there is a single reading of quotes, escapes, comments, substitutions, arithmetic and
// here-documents, not several passes that can disagree.
//
// It is not a full shell parser. Where it cannot be sure, it keeps text as commands rather
// than dropping it as data, and it reports `balanced: false` when the line does not close
// what it opens, so the caller can refuse.
//
// lex(text) -> { lists, balanced }
//   lists[0]   the simple commands of the line itself
//   lists[1..] the simple commands of each `$( )`, backtick or ambiguous `(( ))` inside it
//   a simple command is { words, before, after, depth }; a word is
//   { value, quoted, dynamic, escaped }: the text the shell would pass on, whether any part
//   was quoted, whether it holds an expansion or a pattern, whether it holds an escape.

const TWO_CHAR_SEPARATORS = ['&&', '||', ';;'];
const ONE_CHAR_SEPARATORS = new Set([';', '|', '\n']);
const PATTERN_CHARACTERS = new Set(['~', '*', '?']);
const HEREDOC_DELIMITER = /-?[ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|((?:\\.|[^\s;&|()<>])+))/y;
const GUARDED_WORDS = /\bpush\b|\bpr\s+(create|merge)\b/;

function newWord() {
  return { value: '', quoted: false, dynamic: false, escaped: false };
}

/** Moves past the bodies of the pending here-documents. Stops, unbalanced, if one never ends. */
function skipHeredocBodies(state) {
  let cursor = state.index + 1;
  for (const delimiter of state.pending) {
    let found = false;
    let line = cursor;
    while (line < state.text.length && !found) {
      const end = state.text.indexOf('\n', line);
      const stop = end === -1 ? state.text.length : end;
      found = state.text.slice(line, stop).trim() === delimiter;
      line = end === -1 ? state.text.length : end + 1;
    }
    if (!found) {
      state.balanced = false;
      break;
    }
    cursor = line;
  }
  state.pending = [];
  state.index = cursor;
}

/** The index after the `)` that closes the parenthesis opened before `start`, or -1. */
function closingParenthesis(text, start) {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    if (text[index] === ')') depth -= 1;
    if (depth === 0) return index + 1;
  }
  return -1;
}

function nest(state, text) {
  const inner = lex(text);
  state.lists.push(...inner.lists);
}

/** `$(( ))` or `(( ))`: copied as one opaque piece. Read as commands too if it could be some. */
function readArithmetic(state, word, opener) {
  const start = state.index + opener.length;
  const end = closingParenthesis(state.text, start - 1);
  const stop = end === -1 ? state.text.length : end;
  const body = state.text.slice(start - 1, stop);
  if (end === -1) state.balanced = false;
  if (GUARDED_WORDS.test(body)) nest(state, body.replace(/^\(+|\)+$/g, ' '));
  word.value += state.text.slice(state.index, stop);
  word.dynamic = true;
  state.index = stop;
}

function readBackticks(state, word) {
  let index = state.index + 1;
  let inner = '';
  while (index < state.text.length && state.text[index] !== '`') {
    if (state.text[index] === '\\') index += 1;
    inner += state.text[index] ?? '';
    index += 1;
  }
  if (index >= state.text.length) state.balanced = false;
  nest(state, inner);
  word.value += '``';
  word.dynamic = true;
  state.index = index + 1;
}

/** Reads `$...` at the cursor: arithmetic, a command substitution, `${ }` or a plain variable. */
function readDollar(state, word) {
  const { text, index } = state;
  word.dynamic = true;
  if (text.startsWith('$((', index)) return readArithmetic(state, word, '$((');
  if (text.startsWith('$(', index)) {
    state.index = index + 2;
    state.lists.push(readList(state, true));
    word.value += '$()';
    return undefined;
  }
  if (text.startsWith('${', index)) {
    const end = text.indexOf('}', index);
    if (end === -1) state.balanced = false;
    const stop = end === -1 ? text.length : end + 1;
    word.value += text.slice(index, stop);
    state.index = stop;
    return undefined;
  }
  word.value += '$';
  state.index = index + 1;
  return undefined;
}

/** Reads up to the closing quote. In `"` and `$'`, a backslash escapes the next character. */
function readQuoted(state, word, quote, opener) {
  const literal = quote === "'" && opener === "'";
  word.quoted = true;
  state.index += opener.length;
  while (state.index < state.text.length) {
    const char = state.text[state.index];
    if (char === quote) {
      state.index += 1;
      return;
    }
    if (char === '\n' && state.pending.length > 0) {
      word.value += '\n';
      skipHeredocBodies(state);
    } else if (!literal && char === '\\') {
      word.value += state.text[state.index + 1] ?? '';
      state.index += 2;
    } else if (quote === '"' && char === '$') {
      readDollar(state, word);
    } else if (quote === '"' && char === '`') {
      readBackticks(state, word);
    } else {
      word.value += char;
      state.index += 1;
    }
  }
  state.balanced = false;
}

/** `<<WORD` or `<<-WORD` outside quotes: remembers the delimiter. False if it is not one. */
function readHeredocOperator(state) {
  HEREDOC_DELIMITER.lastIndex = state.index + 2;
  const match = HEREDOC_DELIMITER.exec(state.text);
  if (!match) return false;
  state.pending.push((match[1] ?? match[2] ?? match[3]).replace(/\\/g, ''));
  state.index = HEREDOC_DELIMITER.lastIndex;
  return true;
}

function isRedirectionAmpersand(text, index) {
  return text[index - 1] === '>' || text[index - 1] === '<' || text[index + 1] === '>';
}

/** The separator at the cursor, or null. `{` and `}` separate only as words of their own. */
function separatorAt(state, wordOpen) {
  const { text, index } = state;
  const two = TWO_CHAR_SEPARATORS.find((candidate) => text.startsWith(candidate, index));
  if (two) return two;
  const char = text[index];
  if (ONE_CHAR_SEPARATORS.has(char) || char === '(' || char === ')') return char;
  if (char === '&') return isRedirectionAmpersand(text, index) ? null : '&';
  if (char === '{' && !wordOpen && /\s/.test(text[index + 1] ?? ' ')) return '{';
  if (char === '}' && !wordOpen) return '}';
  return null;
}

/** Reads one piece of a word at the cursor. Returns false when the cursor is not on one. */
function readWordPiece(state, word) {
  const { text, index } = state;
  const char = text[index];
  if (char === '\\') {
    if (text[index + 1] !== '\n') {
      word.value += text[index + 1] ?? '';
      word.escaped = true;
    }
    state.index = index + 2;
  } else if (char === "'") readQuoted(state, word, "'", "'");
  else if (char === '"') readQuoted(state, word, '"', '"');
  else if (text.startsWith("$'", index)) readQuoted(state, word, "'", "$'");
  else if (text.startsWith('$"', index)) readQuoted(state, word, '"', '$"');
  else if (char === '$') readDollar(state, word);
  else if (char === '`') readBackticks(state, word);
  else if (text.startsWith('<<<', index)) {
    word.value += '<<<';
    state.index = index + 3;
  } else {
    if (PATTERN_CHARACTERS.has(char)) word.dynamic = true;
    word.value += char;
    state.index = index + 1;
  }
}

/**
 * Reads simple commands until the end of the text or, inside `$( )`, until its closing `)`.
 * `depth` counts the `( )` and `{ }` groups a command sits in.
 */
function readList(state, insideSubstitution) {
  const segments = [];
  let words = [];
  let word = null;
  let before = null;
  let depth = 0;
  let startDepth = 0;
  const closeWord = () => {
    if (word) words.push(word);
    word = null;
  };
  const closeSegment = (after) => {
    closeWord();
    if (words.length > 0) segments.push({ words, before, after, depth: startDepth });
    words = [];
    before = after;
  };
  while (state.index < state.text.length) {
    const { text, index } = state;
    const char = text[index];
    if (char === '\n' && state.pending.length > 0) {
      closeSegment('\n');
      skipHeredocBodies(state);
    } else if (char === ' ' || char === '\t') {
      closeWord();
      state.index += 1;
    } else if (char === '#' && !word) {
      const end = text.indexOf('\n', index);
      state.index = end === -1 ? text.length : end;
    } else if (!word && words.length === 0 && text.startsWith('((', index)) {
      word = newWord();
      readArithmetic(state, word, '((');
    } else if (text.startsWith('<<', index) && !text.startsWith('<<<', index) && readHeredocOperator(state)) {
      closeWord();
    } else if (insideSubstitution && char === ')' && depth === 0) {
      closeSegment(')');
      state.index += 1;
      return segments;
    } else {
      const separator = separatorAt(state, word !== null);
      if (separator) {
        closeSegment(separator);
        if (separator === '(' || separator === '{') depth += 1;
        if (separator === ')' || separator === '}') depth = Math.max(0, depth - 1);
        startDepth = depth;
        state.index += separator.length;
      } else {
        word = word ?? newWord();
        readWordPiece(state, word);
      }
    }
  }
  closeSegment(null);
  if (insideSubstitution) state.balanced = false;
  return segments;
}

/** Reads a shell line. See the top of this file for the shape of the result. */
export function lex(text) {
  const state = { text: text ?? '', index: 0, pending: [], lists: [], balanced: true };
  const top = readList(state, false);
  return { lists: [top, ...state.lists], balanced: state.balanced };
}
