import type { ConventionCandidate } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { SKILL_NAME_MAX, SLUG_STOP_WORDS } from "./constants";

/** The editable draft of a skill built from accepted conventions. */
export interface ConventionsSkillDraft {
  name: string;
  description: string;
  body: string;
}

/** A slug of at most `max` characters, cut at a dash. */
function slug(text: string, max = SKILL_NAME_MAX): string {
  const full = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (full.length <= max) return full;
  return full.slice(0, max).replace(/-[^-]*$/, "") || full.slice(0, max);
}

/** A short slug of a rule: up to four words that are not stop words (design: `slugifyRule`). */
export function slugifyRule(rule: string): string {
  const words = slug(rule.replace(/`/g, ""), 500)
    .split("-")
    .filter((w) => w && !SLUG_STOP_WORDS.has(w));
  return slug(words.slice(0, 4).join("-")) || "convention";
}

/** `path:12-18`, `path:12`, or the bare path when the lines are unknown. */
export function evidenceLabel(c: Pick<ConventionCandidate, "evidence_path" | "evidence_line_start" | "evidence_line_end">): string {
  const { evidence_path: path, evidence_line_start: start, evidence_line_end: end } = c;
  if (start == null) return path;
  return end != null && end !== start ? `${path}:${start}-${end}` : `${path}:${start}`;
}

/**
 * The evidence on GitHub at the cited lines: pinned to the commit it was read
 * at, so the lines stay right after the branch moves on; the default branch
 * only when the commit is unknown.
 */
export function evidenceUrl(repoFullName: string, branch: string, c: ConventionCandidate): string {
  return githubBlobUrl(
    repoFullName,
    c.evidence_sha || branch,
    c.evidence_path,
    c.evidence_line_start ?? undefined,
    c.evidence_line_end ?? undefined,
  );
}

/** The longest run of backticks in a text, so a fence around it can be one longer. */
function fenceFor(text: string): string {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  return "`".repeat(longest + 1);
}

/**
 * The draft of a skill made from `conventions` (design: `conventionsToDraft`).
 * One convention: named after its rule. Several: `<repo>-conventions`. A name
 * the user typed replaces the generated one, also in the body's title.
 */
export function conventionsToDraft(
  conventions: readonly ConventionCandidate[],
  repoName: string,
  chosenName?: string,
): ConventionsSkillDraft {
  const single = conventions.length === 1 ? conventions[0] : undefined;
  const name = chosenName ?? (single ? slugifyRule(single.rule) : slug(`${repoName}-conventions`));
  const description = single
    ? single.rule
    : `${conventions.length} house conventions extracted from ${repoName}`;
  const sections = conventions.map((c) => {
    const fence = fenceFor(c.evidence_snippet);
    return [
      `## ${c.rule}`,
      "",
      `Detected in \`${evidenceLabel(c)}\`:`,
      "",
      fence,
      c.evidence_snippet,
      fence,
    ].join("\n");
  });
  const body = [
    `# ${name}`,
    "",
    `House conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`,
    "",
    sections.join("\n\n"),
  ].join("\n");
  return { name, description, body };
}

/** A skill name the server accepts: a slug of at most 64 characters. */
export function isValidSkillName(name: string): boolean {
  return name.length > 0 && name.length <= SKILL_NAME_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}
