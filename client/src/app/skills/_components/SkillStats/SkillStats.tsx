"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, EmptyState, Icon, SectionLabel } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

interface SkillStatsProps {
  skill: Skill;
}

/** Stats tab: how many agents use the skill, and which. */
export function SkillStats({ skill }: SkillStatsProps) {
  const t = useTranslations("skills");
  const count = skill.used_by.length;
  if (count === 0) {
    return <EmptyState icon="BarChart" title={t("stats.noUsageTitle")} body={t("stats.noUsageBody")} />;
  }
  return (
    <div style={s.wrap}>
      <div style={s.tiles}>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.usedBy")}</div>
          <div className="tnum" style={s.tileValue}>
            {count}
            <span style={s.tileSuffix}> {t("stats.usedBySuffix", { count })}</span>
          </div>
        </div>
      </div>

      <div style={s.grid}>
        <Card>
          <SectionLabel icon="Cpu">{t("stats.listTitle")}</SectionLabel>
          <ul style={s.rows}>
            {skill.used_by.map((agent) => (
              <li key={agent.id} style={s.row}>
                <div style={s.rowIcon}>
                  <Icon.Cpu size={12} />
                </div>
                <span style={s.rowName}>{agent.name}</span>
                {/* MonoLink's href opens a new tab; an in-app link stays in the tab. */}
                <Link href={`/agents/${agent.id}`} className="mono" style={s.link}>
                  {t("stats.open")}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
