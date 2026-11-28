"use client";

import { useTranslations } from "next-intl";
import { FormField, SelectInput, TextInput } from "@devdigest/ui";
import { BodyEditor } from "@/components/skill-body-editor";
import { SKILL_BODY_MAX, SKILL_DESCRIPTION_MAX, SKILL_TYPES } from "../constants";
import { isSkillType, validateSkillForm, type SkillFormValues } from "../helpers";
import { s } from "./styles";

interface SkillFieldsProps {
  values: SkillFormValues;
  onChange: (patch: Partial<SkillFormValues>) => void;
  /** The body differs from the saved one (shows the "unsaved" badge). */
  unsaved?: boolean;
}

/** Name, description, type and body of a skill, with their validation messages. */
export function SkillFields({ values, onChange, unsaved }: SkillFieldsProps) {
  const t = useTranslations("skills");
  const errors = validateSkillForm(values);
  const typeOptions = SKILL_TYPES.map((type) => ({ value: type, label: t(`card.type.${type}`) }));

  const nameHint = errors.name === "invalid" ? <span style={s.error}>{t("fields.nameRule")}</span> : undefined;
  const descriptionHint =
    errors.description === "tooLong" ? (
      <span style={s.error}>{t("fields.descriptionTooLong", { max: SKILL_DESCRIPTION_MAX })}</span>
    ) : (
      t("fields.descriptionHint")
    );
  const bodyHint =
    errors.body === "tooLong" ? (
      <span style={s.error}>{t("fields.bodyTooLong", { max: SKILL_BODY_MAX })}</span>
    ) : undefined;

  return (
    <>
      <FormField label={t("fields.name")} required hint={nameHint}>
        <TextInput
          mono
          aria-label={t("fields.name")}
          value={values.name}
          onChange={(name) => onChange({ name })}
          placeholder={t("fields.namePlaceholder")}
          aria-invalid={errors.name === "invalid"}
        />
      </FormField>
      <FormField label={t("fields.description")} required hint={descriptionHint}>
        <TextInput
          aria-label={t("fields.description")}
          value={values.description}
          onChange={(description) => onChange({ description })}
        />
      </FormField>
      <FormField label={t("fields.type")}>
        <SelectInput
          value={values.type}
          onChange={(type) => {
            if (isSkillType(type)) onChange({ type });
          }}
          options={typeOptions}
        />
      </FormField>
      <FormField label={t("fields.body")} required hint={bodyHint}>
        <BodyEditor
          name={values.name}
          value={values.body}
          onChange={(body) => onChange({ body })}
          unsaved={unsaved}
          invalid={errors.body === "tooLong"}
        />
      </FormField>
    </>
  );
}
