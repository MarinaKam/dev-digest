import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  enabledLabel: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, marginTop: 10, alignItems: "center" } satisfies CSSProperties,
  snapshotNote: { fontSize: 13, color: "var(--text-secondary)", marginTop: 10 } satisfies CSSProperties,
  danger: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--crit)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  dangerTitle: { fontSize: 14, fontWeight: 600, color: "var(--crit)", flex: 1 } satisfies CSSProperties,
} as const;
