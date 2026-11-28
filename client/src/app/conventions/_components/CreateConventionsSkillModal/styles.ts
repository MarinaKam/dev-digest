import type { CSSProperties } from "react";

/* Design: `CreateSkillModal` in screen_conv_conf.jsx. */
export const s = {
  body: { padding: "18px 22px 8px" } satisfies CSSProperties,
  merged: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 13px",
    borderRadius: 8,
    background: "var(--accent-bg)",
    border: "1px solid var(--border)",
    marginBottom: 18,
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  mergedIcon: { color: "var(--accent)", flexShrink: 0 } satisfies CSSProperties,
  include: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 160,
    overflow: "auto",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: 8,
  } satisfies CSSProperties,
  includeRule: { fontSize: 12.5, fontStyle: "italic" } satisfies CSSProperties,
  pair: { display: "flex", gap: 14 } satisfies CSSProperties,
  half: { flex: 1 } satisfies CSSProperties,
  toggleRow: { display: "flex", alignItems: "center", height: 36 } satisfies CSSProperties,
  typeRow: { display: "flex", alignItems: "center", height: 36 } satisfies CSSProperties,
  error: { color: "var(--crit)" } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  savedAs: {
    fontSize: 11.5,
    color: "var(--text-muted)",
    marginRight: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } satisfies CSSProperties,
} as const;
