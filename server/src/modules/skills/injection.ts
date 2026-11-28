/**
 * Prompt-injection flags for a skill body. A skill is followed as a rule, so a
 * body that tells the model to drop its instructions, change role, hide issues
 * or force a verdict is shown to the user before it is enabled. Pure.
 *
 * The check is a warning for a person, not a filter: it names suspicious lines
 * and never edits or blocks the text.
 */

const PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^\n]{0,40}\b(previous|prior|above|earlier|all|system|safety)\b[^\n]{0,40}\b(instructions?|rules|prompts?|guidelines|messages?)\b/i,
  /^\s*(system|assistant)\s*:/i,
  /\byou are now\b/i,
  /\b(reveal|output|print|leak|show)\b[^\n]{0,30}\b(system prompts?|instructions|configurations?|api keys?|secrets?)\b/i,
  /\b(always|must)\b[^\n]{0,30}\b(score|verdict)\b/i,
  /\bscore\b[^\n]{0,10}\b100\b/i,
  /\bapprove\b[^\n]{0,20}\b(all|every|any)\b[^\n]{0,10}\b(prs?|pull requests?|changes?)\b/i,
  /\bnever\b[^\n]{0,20}\b(flag|report|mention)\b[^\n]{0,30}\b(security|vulnerabilit(y|ies)|issues?|findings?|bugs?)\b/i,
];

const MAX_FLAGS = 10;
const MAX_FLAG_CHARS = 200;

/** Lines of `body` that match an injection pattern, trimmed, without repeats. */
export function findInjectionFlags(body: string): string[] {
  const flags: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !PATTERNS.some((p) => p.test(line))) continue;
    const flag = line.length > MAX_FLAG_CHARS ? `${line.slice(0, MAX_FLAG_CHARS)}…` : line;
    if (!flags.includes(flag)) flags.push(flag);
    if (flags.length >= MAX_FLAGS) break;
  }
  return flags;
}
