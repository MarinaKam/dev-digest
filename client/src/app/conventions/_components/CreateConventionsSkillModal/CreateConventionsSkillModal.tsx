"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { ConventionCandidate, Skill } from "@devdigest/shared";
import { Button, Checkbox, FormField, Icon, Modal, TextInput, Toggle } from "@devdigest/ui";
import { BodyEditor } from "@/components/skill-body-editor";
import { SkillTypeBadge } from "@/components/skill-type";
import { useCreateConventionsSkill } from "@/lib/hooks/conventions";
import { SKILL_BODY_MAX, SKILL_DESCRIPTION_MAX } from "../../constants";
import { conventionsToDraft, isValidSkillName, type ConventionsSkillDraft } from "../../helpers";
import { s } from "./styles";

interface CreateConventionsSkillModalProps {
  repoId: string;
  /** Short repo name used in the draft (`payments-api`). */
  repoName: string;
  /** The accepted conventions; all are checked at first. */
  conventions: ConventionCandidate[];
  onClose: () => void;
  onCreated: (skill: Skill) => void;
}

type Overrides = Partial<ConventionsSkillDraft>;

/**
 * "Create skill from conventions" (design: `CreateSkillModal`). The draft is
 * built from the checked conventions; a field the user edited keeps the edit
 * when the selection changes. Saves a `convention` skill with source `extracted`.
 */
export function CreateConventionsSkillModal({
  repoId,
  repoName,
  conventions,
  onClose,
  onCreated,
}: CreateConventionsSkillModalProps) {
  const t = useTranslations("conventions");
  const tSkills = useTranslations("skills");
  const create = useCreateConventionsSkill();
  const [checked, setChecked] = React.useState<ReadonlySet<string>>(() => new Set(conventions.map((c) => c.id)));
  const [overrides, setOverrides] = React.useState<Overrides>({});
  const [enabled, setEnabled] = React.useState(true);

  const selected = conventions.filter((c) => checked.has(c.id));
  const draft = conventionsToDraft(selected, repoName);
  const name = overrides.name ?? draft.name;
  const description = overrides.description ?? draft.description;
  const body = overrides.body ?? draft.body;

  const nameOk = isValidSkillName(name);
  const descriptionOk = description.trim().length > 0 && description.length <= SKILL_DESCRIPTION_MAX;
  const bodyOk = body.trim().length > 0 && body.length <= SKILL_BODY_MAX;
  const valid = selected.length > 0 && nameOk && descriptionOk && bodyOk;

  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = () =>
    create.mutate(
      {
        repoId,
        input: {
          convention_ids: selected.map((c) => c.id),
          name,
          description: description.trim(),
          body: body.trim(),
          enabled,
        },
      },
      {
        onSuccess: (skill) => {
          onCreated(skill);
          onClose();
        },
      },
    );

  return (
    <Modal
      width={760}
      title={t("modal.title")}
      subtitle={name}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <span style={s.savedAs}>
            <Icon.GitCommit size={13} />
            {t("modal.savedAs", { version: "v1" })}
          </span>
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? t("modal.creating") : t("modal.submit")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.merged}>
          <Icon.Wrench size={15} style={s.mergedIcon} />
          <span>{t("modal.merged", { count: selected.length, repo: repoName })}</span>
        </div>

        <FormField label={t("modal.include")} hint={t("modal.includeHint")}>
          <div style={s.include}>
            {conventions.map((c) => (
              <Checkbox
                key={c.id}
                checked={checked.has(c.id)}
                onChange={(on) => toggle(c.id, on)}
                label={<span style={s.includeRule}>{c.rule}</span>}
              />
            ))}
          </div>
        </FormField>

        <FormField
          label={t("modal.name")}
          required
          hint={nameOk ? undefined : <span style={s.error}>{t("modal.nameRule")}</span>}
        >
          <TextInput
            mono
            aria-label={t("modal.name")}
            value={name}
            onChange={(v) => setOverrides((o) => ({ ...o, name: v }))}
            aria-invalid={!nameOk}
          />
        </FormField>
        <FormField label={t("modal.description")} required hint={t("modal.descriptionHint")}>
          <TextInput
            aria-label={t("modal.description")}
            value={description}
            onChange={(v) => setOverrides((o) => ({ ...o, description: v }))}
          />
        </FormField>
        <div style={s.pair}>
          <div style={s.half}>
            <FormField label={t("modal.type")}>
              <div style={s.typeRow}>
                <SkillTypeBadge type="convention" label={tSkills("card.type.convention")} />
              </div>
            </FormField>
          </div>
          <div style={s.half}>
            <FormField label={t("modal.enabled")} hint={t("modal.enabledHint")}>
              <div style={s.toggleRow}>
                <Toggle on={enabled} onChange={setEnabled} size={17} />
              </div>
            </FormField>
          </div>
        </div>
        <FormField label={t("modal.body")} required hint={t("modal.bodyHint")}>
          <BodyEditor
            name={name}
            value={body}
            onChange={(v) => setOverrides((o) => ({ ...o, body: v }))}
            invalid={!bodyOk}
          />
        </FormField>
        {/* A failed save (409 name taken, 422) is reported by the global mutation error toast. */}
      </div>
    </Modal>
  );
}
