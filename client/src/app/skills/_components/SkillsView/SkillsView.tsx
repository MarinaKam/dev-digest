/* SkillsView — /skills. The skill list on the left, the selected skill's
   editor (tabs) on the right. The selected skill and the tab live in the URL. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkills } from "@/lib/hooks/skills";
import { useQueryParams } from "@/lib/query-params";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillModal } from "../ImportSkillModal";
import { SkillEditor } from "../SkillEditor";
import { SkillList } from "../SkillList";
import { DEFAULT_TAB, SKILL_PARAM, TABS, TAB_PARAM } from "../constants";
import { s } from "./styles";

type Modal = "create" | "import" | null;

export function SkillsView() {
  const t = useTranslations("skills");
  const query = useQueryParams();
  const { data: skills } = useSkills();
  const [modal, setModal] = React.useState<Modal>(null);

  const requestedSkill = query.get(SKILL_PARAM);
  const activeId = skills?.find((skill) => skill.id === requestedSkill)?.id ?? skills?.[0]?.id ?? null;

  const requestedTab = query.get(TAB_PARAM);
  const tab = TABS.some((item) => item.key === requestedTab) && requestedTab ? requestedTab : DEFAULT_TAB;

  const select = (id: string) => query.set(SKILL_PARAM, id);
  // After a delete the list may still hold the deleted skill: pick another one.
  const afterDelete = (id: string) => query.set(SKILL_PARAM, skills?.find((skill) => skill.id !== id)?.id ?? null);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {modal === "create" && <CreateSkillModal onClose={() => setModal(null)} onCreated={select} />}
      {modal === "import" && <ImportSkillModal onClose={() => setModal(null)} onCreated={select} />}
      <div style={s.layout}>
        <SkillList
          activeId={activeId}
          onSelect={select}
          onCreate={() => setModal("create")}
          onImport={() => setModal("import")}
        />
        {activeId ? (
          <SkillEditor
            key={activeId}
            skillId={activeId}
            tab={tab}
            onTab={(next) => query.set(TAB_PARAM, next)}
            onDeleted={afterDelete}
          />
        ) : (
          <div style={s.empty}>
            <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
