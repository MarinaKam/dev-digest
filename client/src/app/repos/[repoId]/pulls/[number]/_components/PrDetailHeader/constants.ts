import type { IconName } from "@devdigest/ui";

/** Tabs of the PR detail screen: `?tab=` value, i18n key (under `detail.tabs`), icon. */
export const TABS: readonly { key: string; icon: IconName }[] = [
  { key: "overview", icon: "FileText" },
  { key: "findings", icon: "AlertOctagon" },
  { key: "diff", icon: "Code" },
];

/** PR status → colour of its badge; any other status is still open. */
export const STATUS_COLOR: Record<string, string> = {
  merged: "var(--ok)",
  closed: "var(--stale)",
};
export const OPEN_STATUS_COLOR = "var(--warn)";
