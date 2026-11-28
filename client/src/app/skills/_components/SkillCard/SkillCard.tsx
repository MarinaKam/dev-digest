"use client";

import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { typeColor } from "../helpers";
import { s } from "./styles";

interface SkillCardProps {
  skill: Skill;
  active?: boolean;
  onSelect: (id: string) => void;
}

/** One skill in the list: type icon, name, enabled toggle, description, type, source, agents. */
export function SkillCard({ skill, active, onSelect }: SkillCardProps) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();
  const color = typeColor(skill.type);

  return (
    <div style={s.card(!!active, skill.enabled)}>
      {/* The toggle sits beside this button, not inside it: a click on the
          toggle can never select the card. */}
      <button
        type="button"
        aria-label={skill.name}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(skill.id)}
        style={s.selectButton}
      />
      <div style={s.content}>
        <div style={s.headerRow}>
          <div style={s.iconBox(color)}>
            <Icon.Sparkles size={15} />
          </div>
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
          <div style={s.toggle}>
            <Toggle
              on={skill.enabled}
              onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
              size={14}
            />
          </div>
        </div>
        <div style={s.description}>{skill.description}</div>
        <div style={s.metaRow}>
          <Badge color={color} bg={`${color}1a`}>
            {t(`card.type.${skill.type}`)}
          </Badge>
          <span style={s.metaText}>{t(`card.source.${skill.source}`)}</span>
          <span className="tnum" style={s.metaText}>
            {t("card.agents", { count: skill.used_by.length })}
          </span>
        </div>
      </div>
    </div>
  );
}
