import type { CSSProperties } from "react";

export const EDITOR_LINE_HEIGHT = 20;
export const EDITOR_PAD = 10;

export const s = {
  frame: (invalid: boolean): CSSProperties => ({
    border: `1px solid ${invalid ? "var(--crit)" : "var(--border-strong)"}`,
    borderRadius: 7,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  filename: { fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  area: { display: "flex", height: 320 } satisfies CSSProperties,
  gutter: {
    width: 44,
    flexShrink: 0,
    overflow: "hidden",
    padding: `${EDITOR_PAD}px 8px`,
    textAlign: "right",
    fontSize: 12,
    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    userSelect: "none",
    whiteSpace: "pre",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "none",
    padding: `${EDITOR_PAD}px 12px`,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
    whiteSpace: "pre",
    overflow: "auto",
  } satisfies CSSProperties,
} as const;
