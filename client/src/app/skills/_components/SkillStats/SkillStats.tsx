"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

interface SkillStatsProps {
  skill: Skill;
}

/** Stats tab: how many agents use the skill, and which. */
export function SkillStats({ skill }: SkillStatsProps) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <Card style={s.tile}>
        <div style={s.tileLabel}>{t("stats.usedBy")}</div>
        <div className="tnum" style={s.tileValue}>
          {t("stats.usedByValue", { count: skill.used_by.length })}
        </div>
      </Card>

      <Card pad={false}>
        <h2 style={s.cardTitle}>{t("stats.listTitle")}</h2>
        {skill.used_by.length === 0 && <div style={s.empty}>{t("stats.empty")}</div>}
        {skill.used_by.map((agent) => (
          <div key={agent.id} style={s.row}>
            <Icon.Cpu size={14} style={s.rowIcon} />
            <span style={s.rowName}>{agent.name}</span>
            <Link href={`/agents/${agent.id}`} style={s.link}>
              {t("stats.open")}
            </Link>
          </div>
        ))}
      </Card>
    </div>
  );
}
