import type { CSSProperties } from "react";
import { tintOf } from "@/components/skill-type";

export const s = {
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
  loading: { flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 28px 0",
    flexShrink: 0,
  } satisfies CSSProperties,
  iconBox: (color: string): CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 7,
    background: tintOf(color),
    color,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }),
  h1: { fontSize: 16, fontWeight: 700 } satisfies CSSProperties,
  /* Video: a red banner above the header of a skill with injection patterns. */
  injection: {
    display: "flex",
    gap: 10,
    padding: "10px 28px",
    borderBottom: "1px solid var(--crit)",
    background: "var(--crit-bg)",
    color: "var(--text-primary)",
    fontSize: 12.5,
    lineHeight: 1.45,
    flexShrink: 0,
  } satisfies CSSProperties,
  injectionIcon: { color: "var(--crit)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  injectionTitle: { color: "var(--crit)", letterSpacing: "0.02em", textTransform: "uppercase" } satisfies CSSProperties,
  injectionList: { margin: "6px 0 0", paddingLeft: 16, fontSize: 11.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  tabsBar: { marginTop: 14 } satisfies CSSProperties,
  body: { flex: 1, overflow: "auto", padding: 28 } satisfies CSSProperties,
} as const;
