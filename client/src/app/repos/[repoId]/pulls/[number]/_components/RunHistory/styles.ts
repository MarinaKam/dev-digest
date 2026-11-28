import type { CSSProperties } from "react";

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const meta = { fontSize: 11, color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties;

/** Co-located styles for the PR timeline (run rows and commit rows). */
export const s = {
  list: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,

  runRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    textAlign: "left",
  } satisfies CSSProperties,
  runMain: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 } satisfies CSSProperties,
  runTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  runModel: { fontSize: 12, fontWeight: 400, color: "var(--text-muted)" } satisfies CSSProperties,
  runError: { ...ellipsis, fontSize: 12, color: "var(--crit)" } satisfies CSSProperties,
  settledLine: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  runAside: {
    ...meta,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  } satisfies CSSProperties,
  traceBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    color: "var(--text-muted)",
    cursor: "pointer",
    flexShrink: 0,
  } satisfies CSSProperties,
  deleteBtn: {
    display: "inline-flex",
    padding: 3,
    border: "none",
    background: "none",
    borderRadius: 5,
    color: "var(--text-muted)",
    flexShrink: 0,
    cursor: "pointer",
  } satisfies CSSProperties,

  // Commits are markers, not actions — lighter (dashed, transparent) so they read
  // as separators between the runs they sit chronologically between.
  commitRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px dashed var(--border)",
    background: "transparent",
  } satisfies CSSProperties,
  commitIcon: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  commitSha: { fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 } satisfies CSSProperties,
  commitMessage: {
    ...ellipsis,
    fontSize: 12.5,
    color: "var(--text-secondary)",
    flex: 1,
    minWidth: 0,
  } satisfies CSSProperties,
  meta,
} as const;

/** The agent name is a link to the run's review only when there is one to jump to. */
export function agentButtonFor(clickable: boolean): CSSProperties {
  return {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    fontWeight: 600,
    color: "var(--text-primary)",
    cursor: clickable ? "pointer" : "default",
    textDecoration: clickable ? "underline" : "none",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 3,
  };
}
