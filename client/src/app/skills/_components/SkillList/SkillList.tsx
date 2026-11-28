"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkills } from "@/lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { filterSkills } from "../helpers";
import { s } from "./styles";

interface SkillListProps {
  /** Id of the skill open in the editor. */
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
}

/** The skill list beside the editor: search, add menu, one card per skill. */
export function SkillList({ activeId, onSelect, onCreate, onImport }: SkillListProps) {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const [search, setSearch] = React.useState("");

  const visible = filterSkills(skills ?? [], search);
  const none = !isLoading && !isError && (skills?.length ?? 0) === 0;
  const noMatch = !isLoading && !isError && !none && visible.length === 0;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>{t("page.heading")}</h1>
        <Dropdown
          width={210}
          align="right"
          trigger={
            <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
              {t("page.addSkill")}
            </Button>
          }
          items={[
            { label: t("page.menu.fromScratch"), icon: "Edit", onClick: onCreate },
            { label: t("page.menu.fromFile"), icon: "Upload", onClick: onImport },
          ]}
        />
      </div>
      <div style={s.search}>
        <Icon.Search size={13} style={s.searchIcon} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("page.searchPlaceholder")}
          aria-label={t("page.searchLabel")}
          style={s.searchInput}
        />
      </div>

      <div style={s.list}>
        {isLoading && (
          <div style={s.skeletons}>
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {none && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={onCreate}
          />
        )}
        {noMatch && <EmptyState icon="Search" title={t("page.noMatch.title")} body={t("page.noMatch.body")} />}
        {visible.map((skill) => (
          <SkillCard key={skill.id} skill={skill} active={skill.id === activeId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
