import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_COLORS } from "./constants";

interface SkillTypeBadgeProps {
  type: SkillType;
}

/** A skill's type in its own colour on a faint tint of it. */
export function SkillTypeBadge({ type }: SkillTypeBadgeProps) {
  const color = SKILL_TYPE_COLORS[type];
  return (
    <Badge color={color} bg={`color-mix(in srgb, ${color} 12%, transparent)`}>
      {type}
    </Badge>
  );
}
