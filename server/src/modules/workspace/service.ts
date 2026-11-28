import type { Container } from '../../platform/container.js';

export interface WorkspaceSummary {
  workspaceId: string;
  cloneDir: string;
  repos: {
    id: string;
    full_name: string;
    clone_path: string | null;
    last_polled_at: string | null;
    cloned: boolean;
  }[];
}

/** Where clones live, plus a summary of the workspace's repos. Read-only. */
export class WorkspaceService {
  constructor(private container: Container) {}

  async summary(workspaceId: string): Promise<WorkspaceSummary> {
    const repos = await this.container.reposRepo.list(workspaceId);
    return {
      workspaceId,
      cloneDir: this.container.config.cloneDir,
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  }
}
