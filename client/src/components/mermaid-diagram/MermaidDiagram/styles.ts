import type { CSSProperties } from "react";

/** The diagram box stays hidden until mermaid has rendered into it. */
export function boxFor(rendered: boolean): CSSProperties {
  return {
    display: rendered ? "flex" : "none",
    justifyContent: "center",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 12,
    overflowX: "auto",
  };
}
