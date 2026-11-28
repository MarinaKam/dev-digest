import type { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';

/**
 * Agent domain values. The repository returns these; the service and the pure
 * helpers take them. None of them is inferred from a table.
 */

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  outputSchema: unknown;
  strategy: ReviewStrategy;
  ciFailOn: CiFailOn;
  repoIntel: boolean;
  enabled: boolean;
  version: number;
  createdBy: string | null;
  createdAt: Date;
}

/** An immutable snapshot of an agent's config at one version. */
export interface AgentVersionRecord {
  agentId: string;
  version: number;
  /** Untyped stored JSON; parse it through `AgentVersionConfig` before use. */
  configJson: unknown;
  createdAt: Date;
}

/** A skill linked to an agent, with its position in the agent's skill order. */
export interface LinkedSkill {
  skill: { id: string; name: string };
  order: number;
}
