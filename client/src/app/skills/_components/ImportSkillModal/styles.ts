import type { CSSProperties } from "react";

export const s = {
  body: { padding: 24, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  fileInput: { fontSize: 14, color: "var(--text-primary)" } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
  trust: {
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  section: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  item: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" } satisfies CSSProperties,
  path: { fontSize: 12 } satisfies CSSProperties,
  rendered: { maxHeight: 220, overflow: "auto", fontSize: 14 } satisfies CSSProperties,
  actions: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
} as const;
