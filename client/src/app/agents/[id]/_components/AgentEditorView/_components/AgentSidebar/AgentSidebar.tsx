"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown } from "@devdigest/ui";
import { useAgents, useUpdateAgent } from "@/lib/hooks/agents";
import { AgentCard } from "../../../../../_components/AgentCard";
import { s } from "./styles";

const ADD_MENU_WIDTH = 210;

interface AgentSidebarProps {
  /** Id of the agent open in the editor. */
  activeId: string;
  /** The editor tab to keep when switching to another agent. */
  tab: string;
}

/** The agent list beside the editor: pick another agent, toggle it, add one. */
export function AgentSidebar({ activeId, tab }: AgentSidebarProps) {
  const t = useTranslations("agents");
  const router = useRouter();
  const { data: agents = [] } = useAgents();
  const update = useUpdateAgent();

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>{t("editor.listTitle")}</h1>
        <Dropdown
          width={ADD_MENU_WIDTH}
          align="right"
          trigger={
            <Button kind="primary" size="sm" icon="Plus">
              {t("editor.add")}
            </Button>
          }
          items={[
            { label: t("editor.createFromScratch"), icon: "Edit", onClick: () => router.push("/agents") },
          ]}
        />
      </div>
      <div style={s.list}>
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            ag={agent}
            active={agent.id === activeId}
            onClick={() => router.push(`/agents/${agent.id}?tab=${tab}`)}
            onToggle={(enabled) => update.mutate({ id: agent.id, patch: { enabled } })}
          />
        ))}
      </div>
    </div>
  );
}
