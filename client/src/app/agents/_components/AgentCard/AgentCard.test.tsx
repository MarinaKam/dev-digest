import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../messages/en/agents.json";
const skillsData = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/lib/hooks/skills", async (orig) => ({
  ...(await orig<typeof import("@/lib/hooks/skills")>()),
  useSkills: () => ({ data: skillsData.data }),
}));

import { AgentCard } from "./AgentCard";

afterEach(cleanup);

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const used = (id: string) => ({
  id: `s-${id}`,
  name: "n",
  description: "d",
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  used_by: [{ id: "ag1", name: "x" }],
});

describe("AgentCard (smoke)", () => {
  it("shows the count of skills linked to the agent, read by the card itself", () => {
    skillsData.data = [used("1"), used("2"), used("3")];
    renderWithIntl(<AgentCard ag={AGENT} />);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("3 skills")).toBeInTheDocument();
  });

  it("shows a zero count when no skill is linked to the agent", () => {
    skillsData.data = [];
    renderWithIntl(<AgentCard ag={AGENT} />);
    expect(screen.getByText("0 skills")).toBeInTheDocument();
  });

  it("falls back to a translated placeholder when description is empty", () => {
    renderWithIntl(<AgentCard ag={{ ...AGENT, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });
});
