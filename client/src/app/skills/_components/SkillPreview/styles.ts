import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 4 } satisfies CSSProperties,
  subtitle: { fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
