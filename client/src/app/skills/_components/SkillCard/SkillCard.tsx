"use client";

import { useTranslations } from "next-intl";
import { Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skill-type";
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
          <div style={s.iconBox(typeColor(skill.type))}>
            <Icon.Sparkles size={15} />
          </div>
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
          {/* The UI kit's Toggle takes no aria-label: the label names the switch. */}
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Toggle renders a role="switch" button, a labelable element */}
          <label style={s.toggle}>
            <span style={s.visuallyHidden}>{t("card.enabledLabel", { name: skill.name })}</span>
            <Toggle
              on={skill.enabled}
              onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
              size={14}
            />
          </label>
        </div>
        <div style={s.description}>{skill.description}</div>
        <div style={s.metaRow}>
          <SkillTypeBadge type={skill.type} label={t(`card.type.${skill.type}`)} />
          <span style={s.metaText}>{t(`card.source.${skill.source}`)}</span>
          <span className="tnum" style={s.metaText}>
            {t("card.agents", { count: skill.used_by.length })}
          </span>
        </div>
      </div>
    </div>
  );
}
