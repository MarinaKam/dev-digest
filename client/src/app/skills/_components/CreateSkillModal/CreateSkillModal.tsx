"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, Toggle } from "@devdigest/ui";
import { useCreateSkill } from "@/lib/hooks/skills";
import { SkillFields } from "../SkillFields";
import { EMPTY_FORM, hasErrors, validateSkillForm, type SkillFormValues } from "../helpers";
import { s } from "./styles";

interface CreateSkillModalProps {
  onClose: () => void;
  /** Called with the id of the new skill. */
  onCreated: (id: string) => void;
}

/** "Create from scratch": the skill fields in a modal; saves a manual skill. */
export function CreateSkillModal({ onClose, onCreated }: CreateSkillModalProps) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [form, setForm] = React.useState<SkillFormValues>(EMPTY_FORM);
  const invalid = hasErrors(validateSkillForm(form));

  const submit = () =>
    create.mutate(
      { ...form, source: "manual" },
      {
        onSuccess: (skill) => {
          onCreated(skill.id);
          onClose();
        },
      },
    );

  return (
    <Modal
      width={720}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={submit} disabled={invalid || create.isPending}>
            {create.isPending ? t("create.creating") : t("create.submit")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <SkillFields values={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} />
        <FormField label={t("fields.enabled")}>
          <Toggle on={form.enabled} onChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))} size={16} />
        </FormField>
        {/* A failed create (409 name taken, 422) is reported by the global mutation error toast. */}
      </div>
    </Modal>
  );
}
