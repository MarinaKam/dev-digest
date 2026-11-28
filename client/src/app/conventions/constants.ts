/*
 * Limits mirrored from the shared contract (`SkillName`, `SKILL_DESCRIPTION_MAX`,
 * `SKILL_BODY_MAX`, `CONVENTION_RULE_MAX`). Copied, not imported: the web app
 * may import only types from `@devdigest/shared` (`src/lib/shared-imports.test.ts`).
 * The server validates again on save.
 */
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 20_000;
export const CONVENTION_RULE_MAX = 500;

/** Words left out of a rule's slug (design: `slugifyRule`). */
export const SLUG_STOP_WORDS: ReadonlySet<string> = new Set([
  "always",
  "use",
  "the",
  "a",
  "an",
  "to",
  "of",
  "instead",
  "must",
  "should",
  "all",
  "in",
  "via",
  "through",
  "are",
  "is",
  "and",
  "with",
  "for",
]);

/** Confidence at which the bar turns green (design: `ConventionCard`). */
export const HIGH_CONFIDENCE = 0.85;

/** Width of the page column (design: `ScreenConventions`). */
export const PAGE_MAX_WIDTH = 880;
