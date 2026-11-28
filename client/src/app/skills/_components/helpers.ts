import type { Skill, SkillType, UpdateSkill } from "@devdigest/shared";
import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_MAX,
  SKILL_NAME_PATTERN,
  SKILL_TYPES,
} from "./constants";
import { SKILL_TYPE_COLORS } from "@/components/skill-type";

/** The editable fields of a skill, as a form holds them. */
export interface SkillFormValues {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

export type FieldError = "empty" | "invalid" | "tooLong";

export interface SkillFormErrors {
  name?: FieldError;
  description?: FieldError;
  body?: FieldError;
}

export const EMPTY_FORM: SkillFormValues = {
  name: "",
  description: "",
  type: "custom",
  body: "",
  enabled: true,
};

export function toFormValues(skill: Skill): SkillFormValues {
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
    enabled: skill.enabled,
  };
}

/** A rough token count of a text: about four characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The number of lines a text shows in an editor (an empty text has one). */
export function countLines(text: string): number {
  return text.split("\n").length;
}

export function typeColor(type: SkillType): string {
  return SKILL_TYPE_COLORS[type];
}

/** True when a string (a select's value) is one of the skill types. */
export function isSkillType(value: string): value is SkillType {
  return (SKILL_TYPES as readonly string[]).includes(value);
}

/** Case-insensitive filter over a skill's name. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => s.name.toLowerCase().includes(q));
}

/** The rules of the server contract, checked before a request is sent. */
export function validateSkillForm(values: SkillFormValues): SkillFormErrors {
  const errors: SkillFormErrors = {};
  if (values.name === "") errors.name = "empty";
  else if (values.name.length > SKILL_NAME_MAX || !SKILL_NAME_PATTERN.test(values.name)) errors.name = "invalid";

  const description = values.description.trim();
  if (description === "") errors.description = "empty";
  else if (description.length > SKILL_DESCRIPTION_MAX) errors.description = "tooLong";

  const body = values.body.trim();
  if (body === "") errors.body = "empty";
  else if (body.length > SKILL_BODY_MAX) errors.body = "tooLong";
  return errors;
}

export function hasErrors(errors: SkillFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Only the fields whose value differs from the saved skill. */
export function changedFields(skill: Skill, values: SkillFormValues): UpdateSkill {
  const patch: UpdateSkill = {};
  if (values.name !== skill.name) patch.name = values.name;
  if (values.description !== skill.description) patch.description = values.description;
  if (values.type !== skill.type) patch.type = values.type;
  if (values.body !== skill.body) patch.body = values.body;
  if (values.enabled !== skill.enabled) patch.enabled = values.enabled;
  return patch;
}
