"use client";

import { useTranslations } from "next-intl";
import { Card } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { MarkdownBody } from "../MarkdownBody";
import { s } from "./styles";

interface SkillPreviewProps {
  skill: Skill;
}

/** Preview tab: the body rendered as the reviewing agent receives it. */
export function SkillPreview({ skill }: SkillPreviewProps) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      <Card>
        {skill.body ? <MarkdownBody>{skill.body}</MarkdownBody> : <span style={s.empty}>{t("preview.empty")}</span>}
      </Card>
    </div>
  );
}
