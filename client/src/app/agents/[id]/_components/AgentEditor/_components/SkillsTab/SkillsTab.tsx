/* SkillsTab — the agent's linked skills, in prompt order. Check a skill to link
   it, drag (or Alt+Arrow) a linked row to reorder. Every change sends the full
   ordered list; the server replaces the agent's set. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, ErrorState, Icon, Skeleton, TextInput } from "@devdigest/ui";
import { useAgentSkillLinks, useSetAgentSkills, useSkills } from "@/lib/hooks/skills";
import { countEnabledLinked, matchesQuery, moveLinked, orderedRows } from "./helpers";
import { s } from "./styles";

interface SkillsTabProps {
  agentId: string;
}

export function SkillsTab({ agentId }: SkillsTabProps) {
  const t = useTranslations("agents");
  const skillsQuery = useSkills();
  const linksQuery = useAgentSkillLinks(agentId);
  const setSkills = useSetAgentSkills();
  const [query, setQuery] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);

  const skills = skillsQuery.data ?? [];
  const linkedIds = (linksQuery.data ?? []).map((l) => l.skill_id);
  const rows = orderedRows(skills, linkedIds);
  const visible = rows.filter((r) => matchesQuery(r.skill, query));

  const save = (skillIds: string[]) => setSkills.mutate({ agentId, skillIds });
  const toggle = (id: string, on: boolean) =>
    save(on ? [...linkedIds, id] : linkedIds.filter((x) => x !== id));
  const move = (from: number, to: number) => {
    if (from !== to && to >= 0 && to < linkedIds.length) save(moveLinked(linkedIds, from, to));
  };
  const endDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  if (skillsQuery.isLoading || linksQuery.isLoading) {
    return (
      <div style={s.wrap}>
        <div style={s.skeletons}>
          <Skeleton height={38} />
          <Skeleton height={38} />
          <Skeleton height={38} />
        </div>
      </div>
    );
  }
  if (skillsQuery.isError || linksQuery.isError) {
    return (
      <div style={s.wrap}>
        <ErrorState
          body={t("skills.loadError")}
          onRetry={() => {
            skillsQuery.refetch();
            linksQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (skills.length === 0) {
    return (
      <div style={s.wrap}>
        <EmptyState icon="Sparkles" title={t("skills.emptyTitle")} body={t("skills.emptyBody")} />
        <p style={s.hint}>
          <Link href="/skills" style={s.link}>
            {t("skills.emptyCta")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge>
          {t("skills.enabledCount", {
            linked: countEnabledLinked(skills, linkedIds),
            total: skills.length,
          })}
        </Badge>
      </div>
      <div style={s.filter}>
        <TextInput value={query} onChange={setQuery} placeholder={t("skills.filterPlaceholder")} />
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      {visible.length === 0 && <p style={s.hint}>{t("skills.noMatches", { q: query })}</p>}
      <div style={s.list}>
        {visible.map(({ skill, linked }) => {
          const index = linkedIds.indexOf(skill.id);
          const off = linked && !skill.enabled;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: a linked row is a drag source and drop target, and handles Alt+Arrow itself.
            <div
              key={skill.id}
              data-testid={`skill-row-${skill.name}`}
              tabIndex={linked ? 0 : undefined}
              draggable={linked}
              onDragStart={
                linked
                  ? (e: React.DragEvent) => {
                      // Firefox starts a drag only when it carries data.
                      e.dataTransfer.setData("text/plain", skill.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragFrom(index);
                    }
                  : undefined
              }
              onDragOver={
                linked && dragFrom != null
                  ? (e) => {
                      e.preventDefault();
                      setDragOver(index);
                    }
                  : undefined
              }
              onDrop={
                linked && dragFrom != null
                  ? (e) => {
                      e.preventDefault();
                      move(dragFrom, index);
                      endDrag();
                    }
                  : undefined
              }
              onDragEnd={endDrag}
              onKeyDown={
                linked
                  ? (e) => {
                      if (!e.altKey || e.target !== e.currentTarget) return;
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        move(index, index + (e.key === "ArrowUp" ? -1 : 1));
                      }
                    }
                  : undefined
              }
              style={s.row(linked, off, dragOver === index && dragFrom !== index)}
            >
              <span style={s.handle(linked)} aria-hidden={!linked}>
                <Icon.Menu size={14} />
              </span>
              <input
                type="checkbox"
                checked={linked}
                onChange={(e) => toggle(skill.id, e.target.checked)}
                aria-label={t("skills.toggleSkill", { name: skill.name })}
                style={s.checkbox}
              />
              <span className="mono" style={s.name}>
                {skill.name}
              </span>
              {off && <span style={s.off}>{t("skills.offGlobally")}</span>}
              <Badge>{skill.type}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
