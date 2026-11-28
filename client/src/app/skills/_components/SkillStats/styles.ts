import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  tiles: { display: "flex", gap: 12, marginBottom: 20 } satisfies CSSProperties,
  tile: {
    padding: 15,
    borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    minWidth: 160,
  } satisfies CSSProperties,
  tileLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  tileValue: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 } satisfies CSSProperties,
  tileSuffix: { fontSize: 15, fontWeight: 500, color: "var(--text-muted)", letterSpacing: 0 } satisfies CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 } satisfies CSSProperties,
  rows: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  rowIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "var(--accent-bg)",
    color: "var(--accent)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  } satisfies CSSProperties,
  rowName: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600 } satisfies CSSProperties,
  /** MonoLink's resting look. */
  link: {
    fontSize: 13,
    color: "var(--text-secondary)",
    textDecoration: "none",
    textUnderlineOffset: 2,
  } satisfies CSSProperties,
} as const;
