import type { CSSProperties } from "react";

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px",
  borderRadius: 99,
  // Longhand only: `borderColor` changes per pill, and React warns when a
  // longhand is updated next to the `border` shorthand.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border-strong)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background .12s, color .12s, border-color .12s",
};

/** Co-located styles for SeverityCounters. */
export const s = {
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  /** A level that is not the active filter: neutral, no severity colour. */
  pill,
  /** A level without findings: neutral, fainter, not clickable. */
  empty: {
    ...pill,
    borderColor: "var(--border)",
    color: "var(--text-muted)",
    cursor: "default",
  } satisfies CSSProperties,
} as const;

/** The active filter: outlined, tinted and written in its severity colour. */
export function activePillStyle(color: string, tint: string): CSSProperties {
  return { ...pill, borderColor: color, background: tint, color, fontWeight: 600 };
}
