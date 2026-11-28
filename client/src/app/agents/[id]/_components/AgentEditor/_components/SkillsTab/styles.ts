import type { CSSProperties } from "react";

/** Co-located styles for SkillsTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  filter: { marginBottom: 10 } satisfies CSSProperties,
  hint: { fontSize: 12, color: "var(--text-muted)", marginBottom: 12 } satisfies CSSProperties,
  error: { fontSize: 12, color: "var(--crit)", marginBottom: 12 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  row: (linked: boolean, dimmed: boolean, dragOver: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    border: `1px solid ${dragOver ? "var(--accent)" : "var(--border)"}`,
    background: linked ? "var(--bg-elevated)" : "transparent",
    opacity: dimmed ? 0.55 : 1,
  }),
  handle: (draggable: boolean): CSSProperties => ({
    display: "grid",
    placeItems: "center",
    color: "var(--text-muted)",
    cursor: draggable ? "grab" : "default",
    visibility: draggable ? "visible" : "hidden",
  }),
  checkbox: { cursor: "pointer", accentColor: "var(--accent)" } satisfies CSSProperties,
  name: { fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } satisfies CSSProperties,
  off: { fontSize: 11, color: "var(--warn)" } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  link: { color: "var(--accent)" } satisfies CSSProperties,
} as const;
