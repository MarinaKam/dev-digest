import type { CSSProperties } from "react";
import { TOP_BAR_HEIGHT } from "../constants";

export const s = {
  layout: { display: "flex", height: `calc(100vh - ${TOP_BAR_HEIGHT}px)` } satisfies CSSProperties,
  loading: { flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  blank: { flex: 1 } satisfies CSSProperties,
} as const;
