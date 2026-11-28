import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_COLORS } from "./constants";
import { tintOf } from "./helpers";

interface SkillTypeBadgeProps {
  type: SkillType;
  /** Translated name of the type; the raw type is shown when it is missing. */
  label?: string;
}

/** A skill's type in its own colour on a faint tint of it. */
export function SkillTypeBadge({ type, label }: SkillTypeBadgeProps) {
  const color = SKILL_TYPE_COLORS[type];
  return (
    <Badge color={color} bg={tintOf(color)}>
      {label ?? type}
    </Badge>
  );
}
