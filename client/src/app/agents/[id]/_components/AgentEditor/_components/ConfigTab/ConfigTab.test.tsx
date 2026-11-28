import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

const mutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate, isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
}));

import { AgentEditor } from "../../AgentEditor";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

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

function editor(agent: Agent) {
  return (
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>
        <AgentEditor agent={agent} tab="config" onTab={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}

describe("ConfigTab", () => {
  it("starts from the agent's saved values", () => {
    render(editor(AGENT));
    expect(screen.getByDisplayValue("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("You are a security reviewer.")).toBeInTheDocument();
  });

  it("saves every field of the form, including the edited one", () => {
    render(editor(AGENT));
    fireEvent.change(screen.getByDisplayValue("Security Reviewer"), {
      target: { value: "Secrets Reviewer" },
    });
    fireEvent.click(screen.getByText("Save agent"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({
      id: "ag1",
      patch: {
        name: "Secrets Reviewer",
        description: "Flags secrets and injection",
        provider: "openai",
        model: "gpt-4.1",
        system_prompt: "You are a security reviewer.",
        strategy: "single-pass",
        ci_fail_on: "critical",
        repo_intel: true,
        enabled: true,
      },
    });
  });

  it("drops unsaved edits when another agent is opened", () => {
    const { rerender } = render(editor(AGENT));
    fireEvent.change(screen.getByDisplayValue("Security Reviewer"), {
      target: { value: "Unsaved name" },
    });

    rerender(editor({ ...AGENT, id: "ag2", name: "Style Reviewer" }));

    expect(screen.getByDisplayValue("Style Reviewer")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Unsaved name")).not.toBeInTheDocument();
  });

  it("keeps unsaved edits when the same agent is refetched", () => {
    const { rerender } = render(editor(AGENT));
    fireEvent.change(screen.getByDisplayValue("Security Reviewer"), {
      target: { value: "Unsaved name" },
    });

    rerender(editor({ ...AGENT, version: 2 }));

    expect(screen.getByDisplayValue("Unsaved name")).toBeInTheDocument();
  });
});
