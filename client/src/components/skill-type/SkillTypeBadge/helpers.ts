import { SKILL_TYPE_TINT_PERCENT } from "./constants";

/**
 * A faint background tint of a colour. Built with `color-mix`, because the
 * colours are CSS variables: appending a hex alpha (`${color}1a`) to
 * `var(--accent)` gives an invalid value that the browser drops.
 */
export function tintOf(color: string): string {
  return `color-mix(in srgb, ${color} ${SKILL_TYPE_TINT_PERCENT}%, transparent)`;
}
