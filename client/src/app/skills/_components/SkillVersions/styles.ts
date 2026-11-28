import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  explain: { fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  version: { fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  date: { fontSize: 13, color: "var(--text-muted)", flex: 1 } satisfies CSSProperties,
  diff: {
    margin: "12px 0 0",
    padding: "8px 0",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    fontSize: 12,
    lineHeight: 1.6,
    overflow: "auto",
  } satisfies CSSProperties,
  diffLine: (kind: "same" | "removed" | "added"): CSSProperties => ({
    display: "block",
    padding: "0 12px",
    whiteSpace: "pre-wrap",
    color: kind === "removed" ? "var(--crit)" : kind === "added" ? "var(--ok)" : "var(--text-secondary)",
    background: kind === "removed" ? "var(--crit-bg)" : kind === "added" ? "var(--ok-bg)" : "transparent",
  }),
  note: { fontSize: 13, color: "var(--text-muted)", marginTop: 12 } satisfies CSSProperties,
} as const;
