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
  tabsBar: { marginTop: 14 } satisfies CSSProperties,
  body: { flex: 1, overflow: "auto", padding: 28 } satisfies CSSProperties,
} as const;
