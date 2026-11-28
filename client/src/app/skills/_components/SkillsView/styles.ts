import type { CSSProperties } from "react";
import { TOP_BAR_HEIGHT } from "../constants";

export const s = {
  layout: { display: "flex", height: `calc(100vh - ${TOP_BAR_HEIGHT}px)` } satisfies CSSProperties,
  empty: { flex: 1, display: "grid", placeItems: "center" } satisfies CSSProperties,
} as const;
