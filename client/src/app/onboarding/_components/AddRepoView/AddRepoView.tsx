/* AddRepoView — add-repository screen body. URL only. API keys (OpenAI /
   Anthropic / GitHub PAT) are NOT entered here; they live in Settings → API
   Keys and don't change per repo. Escapable: Esc or the close button returns
   to the app. */
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, IconBtn, Kbd, TextInput, FormField } from "@devdigest/ui";
import { ApiError } from "@/lib/api";
import { useAddRepo } from "@/lib/hooks/repos";
import { s } from "./styles";

const SETTINGS_HREF = "/settings/api-keys";

export function AddRepoView() {
  const t = useTranslations("addRepo");
  const router = useRouter();
  const [repoUrl, setRepoUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const addRepo = useAddRepo();
  const url = repoUrl.trim();

  // Escapable (the footer advertises Esc — make it real).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const submit = async () => {
    if (!url) return;
    setError(null);
    try {
      const repo = await addRepo.mutateAsync(url);
      router.push(`/repos/${repo.id}/pulls`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("error"));
    }
  };

  return (
    <div style={s.page}>
      <div style={s.brand}>
        <div style={s.brandMark}>
          <Icon.Layers size={17} style={s.brandIcon} />
        </div>
        <span style={s.brandName}>{t("brand")}</span>
      </div>

      <div style={s.card}>
        <div style={s.close}>
          <IconBtn icon="X" label={t("close")} onClick={() => router.push("/")} />
        </div>

        <h1 style={s.title}>{t("title")}</h1>
        <p style={s.intro}>
          {t.rich("intro", {
            settings: (chunks) => (
              <Link href={SETTINGS_HREF} style={s.link}>
                {chunks}
              </Link>
            ),
          })}
        </p>

        <FormField label={t("urlLabel")} hint={t("urlHint")}>
          <TextInput
            value={repoUrl}
            onChange={setRepoUrl}
            mono
            placeholder={t("urlPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </FormField>

        {error && (
          <div role="alert" style={s.error}>
            <Icon.XCircle size={16} style={s.errorIcon} />
            <span style={s.errorText}>{error}</span>
          </div>
        )}

        <div style={s.actions}>
          <Button kind="ghost" size="md" onClick={() => router.push("/")}>
            {t("cancel")}
          </Button>
          <div style={s.spacer} />
          <Button
            kind="primary"
            size="md"
            icon="Plus"
            onClick={() => void submit()}
            disabled={!url || addRepo.isPending}
          >
            {addRepo.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>

      <p style={s.footer}>
        <Icon.Lock size={12} /> {t("footerKeys")} <Kbd>esc</Kbd> {t("footerClose")}
      </p>
    </div>
  );
}
