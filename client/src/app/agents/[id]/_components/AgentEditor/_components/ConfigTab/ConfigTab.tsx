"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, TextInput, SelectInput, SearchableSelect, Textarea, Toggle, Button } from "@devdigest/ui";
import type { Agent, CiFailOn, Provider, ReviewStrategy } from "@devdigest/shared";
import { useUpdateAgent, useProviderModels } from "@/lib/hooks/agents";
import { toModelOptions } from "@/lib/model-label";
import { useToast } from "@/lib/toast";
import { CI_FAIL_ON_VALUES, OUTPUT_SCHEMA_VALUE, PROVIDER_OPTIONS, STRATEGY_VALUES } from "./constants";
import { toForm, withCurrentModel, type AgentForm } from "./helpers";
import { s } from "./styles";

interface ConfigTabProps {
  /** The form starts from this agent. Render with `key={agent.id}` so that
      opening another agent starts a fresh form. */
  agent: Agent;
}

/** Config tab — name/description/provider/model/system-prompt + enabled toggle. */
export function ConfigTab({ agent }: ConfigTabProps) {
  const t = useTranslations("agents");
  const toast = useToast();
  const update = useUpdateAgent();
  const [form, setForm] = React.useState<AgentForm>(() => toForm(agent));

  const setField =
    <K extends keyof AgentForm>(field: K) =>
    (value: AgentForm[K]) =>
      setForm((prev) => ({ ...prev, [field]: value }));

  const { data: models } = useProviderModels(form.provider);
  // Show the price (USD per 1M in/out tokens) in the label when the provider
  // exposes it (OpenRouter) so a cheap model is easy to pick; value stays the id.
  const modelOptions = withCurrentModel(toModelOptions(models), form.model);
  // Empty list after load = provider key missing/invalid (listModels failed) —
  // guide the user instead of showing a silent one-item dropdown.
  const noModels = models !== undefined && models.length === 0;

  // Friendly labels for the strategy select (values come from constants).
  const strategyOptions = STRATEGY_VALUES.map((v) => ({ value: v, label: t(`config.strategyOptions.${v}`) }));
  const ciFailOnOptions = CI_FAIL_ON_VALUES.map((v) => ({ value: v, label: t(`config.ciFailOnOptions.${v}`) }));

  const save = () =>
    update.mutate(
      { id: agent.id, patch: form },
      {
        // Failures are surfaced by the global mutation error toast; confirm the
        // save with a success toast (not just the inline "Saved (vN)" note).
        onSuccess: (data) => toast.success(t("config.savedToast", { version: data.version })),
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={form.enabled} onChange={setField("enabled")} size={16} />
        </label>
      </div>
      <FormField label={t("config.name")} required>
        <TextInput value={form.name} onChange={setField("name")} />
      </FormField>
      <FormField label={t("config.description")}>
        <TextInput value={form.description} onChange={setField("description")} />
      </FormField>
      <FormField label={t("config.provider")}>
        <SelectInput
          value={form.provider}
          onChange={(v) => setField("provider")(v as Provider)}
          options={[...PROVIDER_OPTIONS]}
        />
      </FormField>
      <FormField
        label={t("config.model")}
        hint={noModels ? t("config.modelEmptyHint", { provider: form.provider }) : t("config.modelHint")}
      >
        <SearchableSelect
          value={form.model}
          onChange={setField("model")}
          options={modelOptions}
          placeholder={t("config.modelSearch")}
        />
      </FormField>
      <FormField label={t("config.strategy")} hint={t("config.strategyHint")}>
        <SelectInput
          value={form.strategy}
          onChange={(v) => setField("strategy")(v as ReviewStrategy)}
          options={strategyOptions}
        />
      </FormField>
      <FormField label={t("config.ciFailOn")} hint={t("config.ciFailOnHint")}>
        <SelectInput
          value={form.ci_fail_on}
          onChange={(v) => setField("ci_fail_on")(v as CiFailOn)}
          options={ciFailOnOptions}
        />
      </FormField>
      <FormField label={t("config.repoIntel")} hint={t("config.repoIntelHint")}>
        <label style={s.enabledLabel}>
          <Toggle on={form.repo_intel} onChange={setField("repo_intel")} size={16} />
        </label>
      </FormField>
      <FormField label={t("config.systemPrompt")} hint={t("config.systemPromptHint")}>
        <Textarea value={form.system_prompt} onChange={setField("system_prompt")} rows={8} mono />
      </FormField>
      <FormField label={t("config.outputSchema")}>
        <SelectInput value={OUTPUT_SCHEMA_VALUE} options={[OUTPUT_SCHEMA_VALUE]} />
      </FormField>
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        {update.isSuccess && (
          <span style={s.savedNote}>{t("config.saved", { version: update.data?.version })}</span>
        )}
      </div>
    </div>
  );
}
