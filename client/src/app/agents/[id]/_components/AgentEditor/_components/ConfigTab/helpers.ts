import type { Agent } from "@devdigest/shared";

/** The agent fields the Config tab edits and saves. */
export type AgentForm = Pick<
  Agent,
  | "name"
  | "description"
  | "provider"
  | "model"
  | "system_prompt"
  | "strategy"
  | "ci_fail_on"
  | "repo_intel"
  | "enabled"
>;

export function toForm(agent: Agent): AgentForm {
  return {
    name: agent.name,
    description: agent.description,
    provider: agent.provider,
    model: agent.model,
    system_prompt: agent.system_prompt,
    strategy: agent.strategy,
    ci_fail_on: agent.ci_fail_on,
    repo_intel: agent.repo_intel,
    enabled: agent.enabled,
  };
}

type ModelOption = string | { value: string; label: string };

/** The model list with the agent's current model first when the provider does
    not list it, so the select never shows an empty value. */
export function withCurrentModel<T extends ModelOption>(options: readonly T[], model: string): (T | string)[] {
  const listed = options.some((o) => (typeof o === "string" ? o : o.value) === model);
  return listed ? [...options] : [model, ...options];
}
