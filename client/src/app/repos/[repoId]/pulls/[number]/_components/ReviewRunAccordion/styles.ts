import type { CSSProperties } from "react";

export const s = {
  root: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-surface)",
    marginBottom: 14,
    overflow: "hidden",
    scrollMarginTop: 16,
  } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 8, paddingRight: 12 } satisfies CSSProperties,
  toggle: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 0 13px 16px",
    background: "none",
    border: "none",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  agentIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  agentName: { fontWeight: 600, fontSize: 14 } satisfies CSSProperties,
  counts: { fontSize: 12.5, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  when: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  body: { padding: "0 16px 16px" } satisfies CSSProperties,
  verdict: { marginBottom: 16 } satisfies CSSProperties,
  spinning: { animation: "ddspin 1s linear infinite" } satisfies CSSProperties,
} as const;

export function chevronFor(open: boolean): CSSProperties {
  return {
    transform: open ? "rotate(180deg)" : "none",
    transition: "transform .15s",
    color: "var(--text-muted)",
  };
}

export function deleteButtonFor(pending: boolean): CSSProperties {
  return {
    background: "none",
    border: "none",
    cursor: pending ? "not-allowed" : "pointer",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  };
}
