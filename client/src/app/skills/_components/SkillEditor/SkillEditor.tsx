"use client";

import { useTranslations } from "next-intl";
import { Badge, ErrorState, Icon, Skeleton, Tabs } from "@devdigest/ui";
import { SkillTypeBadge } from "@/components/skill-type";
import { useSkill } from "@/lib/hooks/skills";
import { SkillConfigForm } from "../SkillConfigForm";
import { SkillPreview } from "../SkillPreview";
import { SkillStats } from "../SkillStats";
import { SkillVersions } from "../SkillVersions";
import { TABS } from "../constants";
import { typeColor } from "../helpers";
import { s } from "./styles";

interface SkillEditorProps {
  skillId: string;
  tab: string;
  onTab: (tab: string) => void;
  /** Called after the open skill was deleted. */
  onDeleted: (id: string) => void;
}

/** The selected skill: header, tabs, and the active tab's body. */
export function SkillEditor({ skillId, tab, onTab, onDeleted }: SkillEditorProps) {
  const t = useTranslations("skills");
  const { data: skill, isLoading, isError, refetch } = useSkill(skillId);

  if (isError) return <ErrorState body={t("page.editorLoadError")} onRetry={() => refetch()} />;
  if (isLoading || !skill) {
    return (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }

  const tabs = TABS.map((item) => ({ key: item.key, label: t(item.labelKey), icon: item.icon }));

  return (
    <div style={s.main}>
      <div style={s.header}>
        <div style={s.iconBox(typeColor(skill.type))}>
          <Icon.Sparkles size={15} />
        </div>
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <SkillTypeBadge type={skill.type} label={t(`card.type.${skill.type}`)} />
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          {t("editor.version", { version: skill.version })}
        </Badge>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 28px" />
      </div>
      <div style={s.body}>
        {tab === "config" && <SkillConfigForm key={skill.id} skill={skill} onDeleted={onDeleted} />}
        {tab === "preview" && <SkillPreview skill={skill} />}
        {tab === "stats" && <SkillStats skill={skill} />}
        {tab === "versions" && <SkillVersions skill={skill} />}
      </div>
    </div>
  );
}
