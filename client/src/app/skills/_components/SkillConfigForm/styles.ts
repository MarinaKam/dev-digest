import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 } satisfies CSSProperties,
  h2: { fontSize: 16, fontWeight: 700 } satisfies CSSProperties,
  enabledLabel: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
    cursor: "pointer",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, marginTop: 10, alignItems: "center" } satisfies CSSProperties,
  snapshotNote: { marginLeft: "auto", fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  snapshotVersion: { fontWeight: 700, color: "var(--text-secondary)" } satisfies CSSProperties,
  danger: {
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  dangerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  dangerTitle: { fontSize: 13, fontWeight: 600, color: "var(--crit)" } satisfies CSSProperties,
  dangerBody: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
} as const;
