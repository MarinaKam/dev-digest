import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
  empty: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
