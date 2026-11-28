"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, FormField, TextInput } from "@devdigest/ui";
import type { ConnTestProvider } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useTestConnection } from "@/lib/hooks/settings";
import { s } from "../../styles";

interface StatusBadgeProps {
  /** `undefined` while the status is still loading. */
  configured: boolean | undefined;
}

/** "Configured / Not set" pill driven by GET /settings/secrets-status. */
function StatusBadge({ configured }: StatusBadgeProps) {
  const t = useTranslations("settings");
  if (configured === undefined) return null;
  return (
    <span style={s.badge(configured)}>
      <span style={s.badgeDot(configured)} />
      {configured ? t("apiKeys.configured") : t("apiKeys.notSet")}
    </span>
  );
}

interface KeyRowProps {
  label: string;
  provider: ConnTestProvider;
  hint: string;
  configured: boolean | undefined;
}

/** One provider key: a masked input and "Test connection" with its result. */
export function KeyRow({ label, provider, hint, configured }: KeyRowProps) {
  const t = useTranslations("settings");
  const [val, setVal] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const test = useTestConnection();
  const [res, setRes] = React.useState<{ ok: boolean; message: string } | null>(null);

  const run = async () => {
    setRes(null);
    try {
      const r = await test.mutateAsync({ provider, key: val.trim() || undefined });
      setRes({ ok: r.ok, message: r.message });
    } catch (e) {
      setRes({ ok: false, message: e instanceof ApiError ? e.message : t("apiKeys.testFailed") });
    }
  };

  return (
    <FormField label={label} hint={hint} right={<StatusBadge configured={configured} />}>
      <div style={s.keyRow}>
        <div style={s.keyInput}>
          <TextInput
            value={val}
            onChange={setVal}
            mono
            type={reveal ? "text" : "password"}
            placeholder={t("apiKeys.placeholder")}
            suffix={
              <Icon.EyeOff size={14} style={s.revealIcon} onClick={() => setReveal((r) => !r)} />
            }
          />
        </div>
        <Button kind="secondary" size="md" onClick={() => void run()} disabled={test.isPending}>
          {test.isPending ? t("apiKeys.testing") : t("apiKeys.testConnection")}
        </Button>
      </div>
      {res && (
        <div style={s.result(res.ok)}>
          {res.ok ? <Icon.CheckCircle size={13} /> : <Icon.XCircle size={13} />}
          {res.message}
        </div>
      )}
    </FormField>
  );
}
