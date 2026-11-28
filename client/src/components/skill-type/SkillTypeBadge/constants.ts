import type { SkillType } from "@devdigest/shared";

/** Tint of a skill's type, shared by the Skills page and the agent editor. */
export const SKILL_TYPE_COLORS: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--ok)",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};

/** Share of the type colour in its faint background tint. */
export const SKILL_TYPE_TINT_PERCENT = 12;
