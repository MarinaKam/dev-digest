/* AgentCard — model chip, skills count, enabled toggle. Stats are an A5 mount;
   we render the provider/model + skill count here. */
"use client";

import type React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useDeleteAgent } from "@/lib/hooks/agents";
import { skillCountsByAgent, useSkills } from "@/lib/hooks/skills";
import { modelColor } from "./helpers";
import { s } from "./styles";

interface AgentCardProps {
  ag: Agent;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}

export function AgentCard({ ag, active, onClick, onToggle }: AgentCardProps) {
  const t = useTranslations("agents");
  const del = useDeleteAgent();
  const { data: skills } = useSkills();
  // No count until the skills are loaded: "0 skills" would read as a real answer.
  const skillCount = skills ? (skillCountsByAgent(skills).get(ag.id) ?? 0) : null;
  const color = modelColor(ag.model);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("card.deleteConfirm", { name: ag.name }))) del.mutate(ag.id);
  };

  return (
    <div onClick={onClick} style={s.card(!!active, ag.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Cpu size={15} />
        </div>
        <span style={s.name}>{ag.name}</span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={ag.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={del.isPending}
          title={t("card.deleteTitle")}
          aria-label={t("card.deleteTitle")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spinning : undefined} />
        </button>
      </div>
      <div style={s.description}>{ag.description || t("card.noDescription")}</div>
      <div style={s.metaRow}>
        <span className="mono" style={s.modelChip(color)}>
          {ag.model}
        </span>
        {skillCount !== null && (
          <Badge color="var(--text-secondary)" icon="Sparkles">
            {t("card.skillCount", { count: skillCount })}
          </Badge>
        )}
      </div>
    </div>
  );
}
