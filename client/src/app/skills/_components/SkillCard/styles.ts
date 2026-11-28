import type { CSSProperties } from "react";

export const s = {
  card: (active: boolean, enabled: boolean): CSSProperties => ({
    position: "relative",
    padding: 14,
    borderRadius: 8,
    border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
    background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
    opacity: enabled ? 1 : 0.6,
    marginBottom: 10,
  }),
  /** Covers the card: a click anywhere on it selects the skill. */
  selectButton: {
    position: "absolute",
    inset: 0,
    width: "100%",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    cursor: "pointer",
  } satisfies CSSProperties,
  /** Content above the select button; clicks fall through to it. */
  content: { position: "relative", pointerEvents: "none" } satisfies CSSProperties,
  toggle: { pointerEvents: "auto" } satisfies CSSProperties,
  headerRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  iconBox: (color: string): CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 7,
    background: `${color}1a`,
    color,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }),
  name: {
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  description: {
    fontSize: 13,
    color: "var(--text-muted)",
    margin: "8px 0",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  metaRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  metaText: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
