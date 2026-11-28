import type { IconName } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** Query parameters that hold the selected skill and the active tab. */
export const SKILL_PARAM = "skill";
export const TAB_PARAM = "tab";
export const DEFAULT_TAB = "config";

/** Editor tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface SkillTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

export const TABS: readonly SkillTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "Eye" },
  { key: "stats", labelKey: "editor.tabs.stats", icon: "BarChart" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "History" },
];

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];


/** Height of the app shell's top bar; the screen fills the rest of the viewport. */
export const TOP_BAR_HEIGHT = 52;
/** Width of the skill list beside the editor. */
export const LIST_WIDTH = 290;

/*
 * Field limits, mirrored from the skill contract in `@devdigest/shared`
 * (`SkillName`, `SKILL_DESCRIPTION_MAX`, `SKILL_BODY_MAX`). They are copied, not
 * imported: the web app may import only types from the shared package (see
 * `src/lib/shared-imports.test.ts`). The server validates again on save.
 */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 20_000;
