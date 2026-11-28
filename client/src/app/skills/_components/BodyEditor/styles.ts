import type { CSSProperties } from "react";

export const EDITOR_LINE_HEIGHT = 21;
export const EDITOR_PAD = 12;
export const EDITOR_HEIGHT = 460;
export const GUTTER_WIDTH = 40;

export const s = {
  frame: (invalid: boolean): CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    height: EDITOR_HEIGHT,
    border: `1px solid ${invalid ? "var(--crit)" : "var(--border-strong)"}`,
    borderRadius: 8,
    background: "var(--bg-surface)",
    overflow: "hidden",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  } satisfies CSSProperties,
  fileIcon: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  filename: { fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  area: { display: "flex", flex: 1, minHeight: 0 } satisfies CSSProperties,
  gutter: {
    width: GUTTER_WIDTH,
    flexShrink: 0,
    overflow: "hidden",
    padding: `${EDITOR_PAD}px 14px ${EDITOR_PAD}px 0`,
    textAlign: "right",
    fontSize: 12.5,
    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
    color: "var(--text-muted)",
    userSelect: "none",
    whiteSpace: "pre",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "none",
    padding: `${EDITOR_PAD}px 14px ${EDITOR_PAD}px 0`,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 12.5,
    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
    whiteSpace: "pre",
    overflow: "auto",
  } satisfies CSSProperties,
} as const;
