/* AgentEditorView — /agents/:id. The agent list on the left, the selected
   agent's editor (tabs) on the right. The active tab lives in ?tab=. */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { useAgent } from "@/lib/hooks/agents";
import { useQueryParams } from "@/lib/query-params";
import { AgentEditor } from "../AgentEditor";
import { TABS } from "../constants";
import { AgentSidebar } from "./_components/AgentSidebar";
import { DEFAULT_TAB, TAB_PARAM } from "./constants";
import { s } from "./styles";

export function AgentEditorView() {
  const t = useTranslations("agents");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useQueryParams();
  const { data: agent, isLoading, isError, error, refetch } = useAgent(id);

  const requestedTab = query.get(TAB_PARAM);
  const tab = TABS.some((item) => item.key === requestedTab) && requestedTab ? requestedTab : DEFAULT_TAB;

  const crumb = [
    { label: t("list.breadcrumbLab") },
    { label: t("list.breadcrumb"), href: "/agents" },
    { label: agent?.name ?? t("editor.agentFallback") },
  ];

  if (isError || (!isLoading && !agent)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("editor.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("editor.loadErrorBody")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.layout}>
        <AgentSidebar activeId={id} tab={tab} />

        {isLoading || !agent ? (
          <div style={s.loading}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={s.main}>
            <div style={s.header}>
              <Icon.Cpu size={18} style={s.headerIcon} />
              <h1 style={s.h1}>{agent.name}</h1>
              <Badge color="var(--text-secondary)" mono>
                {agent.provider}/{agent.model}
              </Badge>
              {!agent.enabled && <Badge color="var(--text-muted)">{t("editor.disabled")}</Badge>}
              <div style={s.headerActions}>
                <Button kind="secondary" size="sm" icon="GitPullRequest" onClick={() => router.push("/")}>
                  {t("editor.runOnPr")}
                </Button>
              </div>
            </div>
            <div style={s.editor}>
              <AgentEditor agent={agent} tab={tab} onTab={(next) => query.set(TAB_PARAM, next)} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
