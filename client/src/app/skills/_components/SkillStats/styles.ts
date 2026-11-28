import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  tile: { maxWidth: 220 } satisfies CSSProperties,
  tileLabel: { fontSize: 12, color: "var(--text-muted)", marginBottom: 6 } satisfies CSSProperties,
  tileValue: { fontSize: 22, fontWeight: 700 } satisfies CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 600, padding: "14px 16px", borderBottom: "1px solid var(--border)" } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  rowIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  rowName: { flex: 1, fontSize: 14 } satisfies CSSProperties,
  link: { fontSize: 13, color: "var(--accent-text)", textDecoration: "underline" } satisfies CSSProperties,
} as const;
