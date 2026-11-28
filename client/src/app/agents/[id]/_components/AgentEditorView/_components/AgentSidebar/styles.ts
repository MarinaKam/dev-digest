import type { CSSProperties } from "react";

export const s = {
  root: {
    width: 280,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 16px 26px",
  } satisfies CSSProperties,
  title: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  list: { flex: 1, overflow: "auto", padding: "0 12px 12px" } satisfies CSSProperties,
} as const;
