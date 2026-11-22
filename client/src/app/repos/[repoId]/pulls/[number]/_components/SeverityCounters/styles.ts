import type { CSSProperties } from "react";

/** Text on a pill filled with a severity colour. The page background gives a
    dark label on the bright dark-theme colours and a light label on the deeper
    light-theme ones; plain white is below 4.5:1 on all three dark-theme colours. */
const ON_SEVERITY_COLOR = "var(--bg-primary)";

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 12px",
  borderRadius: 99,
  // Longhand only: `borderColor` changes per pill, and React warns when a
  // longhand is updated next to the `border` shorthand.
  borderWidth: 1,
  borderStyle: "solid",
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background .12s, color .12s, opacity .12s",
};

/** Co-located styles for SeverityCounters. */
export const s = {
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  pill,
  empty: {
    ...pill,
    borderColor: "var(--border)",
    color: "var(--text-muted)",
    cursor: "default",
  } satisfies CSSProperties,
} as const;

/** Opacity of a level that the active filter hides. */
const DIMMED_OPACITY = 0.45;

/** Outlined in the severity colour; filled with it when the level is the active
    filter; faded when another level is the active filter. */
export function pillStyle(color: string, active: boolean, dimmed: boolean): CSSProperties {
  return {
    ...pill,
    borderColor: color,
    color: active ? ON_SEVERITY_COLOR : color,
    background: active ? color : "transparent",
    opacity: dimmed ? DIMMED_OPACITY : 1,
  };
}
