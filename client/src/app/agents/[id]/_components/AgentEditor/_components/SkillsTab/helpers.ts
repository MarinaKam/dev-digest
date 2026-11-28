import type { Skill } from "@devdigest/shared";

export interface SkillRow {
  skill: Skill;
  linked: boolean;
}

/** Linked skills first, in link order; then the unlinked ones by name. A linked id with no skill is dropped. */
export function orderedRows(skills: Skill[], linkedIds: string[]): SkillRow[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linkedSet = new Set(linkedIds);
  const linked: SkillRow[] = [];
  for (const id of linkedIds) {
    const skill = byId.get(id);
    if (skill) linked.push({ skill, linked: true });
  }
  const rest = skills
    .filter((sk) => !linkedSet.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, linked: false }));
  return [...linked, ...rest];
}

/** A copy of `ids` with the item at `from` moved to `to`. Out-of-range or equal indexes return an unchanged copy. */
export function moveLinked(ids: string[], from: number, to: number): string[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < ids.length;
  if (!inRange(from) || !inRange(to) || from === to) return [...ids];
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as string);
  return next;
}

/** Skills that are linked and enabled globally. */
export function countEnabledLinked(skills: Skill[], linkedIds: string[]): number {
  const linkedSet = new Set(linkedIds);
  return skills.filter((sk) => linkedSet.has(sk.id) && sk.enabled).length;
}

/** Case-insensitive name filter; an empty query keeps everything. */
export function matchesQuery(skill: Skill, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || skill.name.toLowerCase().includes(q);
}
