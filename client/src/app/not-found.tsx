/* Shown for a URL that matches no route. */
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";

export default function NotFoundPage() {
  const t = useTranslations("errors");
  const router = useRouter();
  return (
    <AppShell crumb={[{ label: t("breadcrumb") }]}>
      <EmptyState
        icon="Search"
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        cta={t("notFoundCta")}
        onCta={() => router.push("/")}
      />
    </AppShell>
  );
}
