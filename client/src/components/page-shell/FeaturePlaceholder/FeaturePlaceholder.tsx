/* FeaturePlaceholder — stands in for a route owned by a feature agent (A1–A6):
   the full shell with an EmptyState. The feature replaces it with its screen. */
"use client";

import { useTranslations } from "next-intl";
import { EmptyState, type Crumb, type IconName } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "../PageContainer";

interface FeaturePlaceholderProps {
  crumb?: Crumb[];
  title: string;
  icon?: IconName;
  owner: string;
  body?: string;
}

export function FeaturePlaceholder({ crumb, title, icon = "Boxes", owner, body }: FeaturePlaceholderProps) {
  const t = useTranslations("shell");
  return (
    <AppShell crumb={crumb}>
      <PageContainer>
        <EmptyState
          icon={icon}
          title={title}
          body={body ?? t("featurePlaceholder.defaultBody", { owner })}
        />
      </PageContainer>
    </AppShell>
  );
}
