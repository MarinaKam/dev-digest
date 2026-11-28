import type { CSSProperties } from "react";

const heading: CSSProperties = {
  letterSpacing: "-0.01em",
  color: "var(--text-primary)",
};

const list: CSSProperties = {
  paddingLeft: 20,
  margin: "6px 0",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export const s = {
  root: { maxWidth: 680 } satisfies CSSProperties,
  h1: { ...heading, fontSize: 20, fontWeight: 700, margin: "4px 0 10px" } satisfies CSSProperties,
  h2: { ...heading, fontSize: 15.5, fontWeight: 700, margin: "18px 0 8px" } satisfies CSSProperties,
  h3: { ...heading, fontSize: 13.5, fontWeight: 700, margin: "14px 0 6px" } satisfies CSSProperties,
  // The app's CSS reset removes list markers; put them back.
  ul: { ...list, listStyle: "disc outside" } satisfies CSSProperties,
  ol: { ...list, listStyle: "decimal outside" } satisfies CSSProperties,
  li: { fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" } satisfies CSSProperties,
  p: { fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", margin: "8px 0" } satisfies CSSProperties,
  pre: {
    fontSize: 12,
    lineHeight: 1.6,
    padding: "12px 14px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    margin: "8px 0",
    overflow: "auto",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  inlineCode: {
    fontSize: "0.92em",
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-hover)",
    color: "var(--accent-text)",
  } satisfies CSSProperties,
  strong: { fontWeight: 650, color: "var(--text-primary)" } satisfies CSSProperties,
  link: { color: "var(--accent-text)", textDecoration: "underline" } satisfies CSSProperties,
} as const;
