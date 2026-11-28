import type { CSSProperties } from "react";

const column = {
  display: "flex",
  flexDirection: "column",
  maxWidth: 1080,
  margin: "0 auto",
} satisfies CSSProperties;

export const s = {
  loading: { ...column, padding: "28px 32px", gap: 16 } satisfies CSSProperties,
  body: { ...column, padding: "24px 32px 44px", gap: 24 } satisfies CSSProperties,
} as const;
