/** A rough token count of a text: about four characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The number of lines a text shows in an editor (an empty text has one). */
export function countLines(text: string): number {
  return text.split("\n").length;
}
