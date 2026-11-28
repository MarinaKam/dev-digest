import type { WorkspaceSummary } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';

/** Where clones live, plus a summary of the workspace's repos. Read-only. */
export class WorkspaceService {
  constructor(private container: Container) {}

  async summary(workspaceId: string): Promise<WorkspaceSummary> {
    const repos = await this.container.reposRepo.list(workspaceId);
    return {
      workspace_id: workspaceId,
      clone_dir: this.container.config.cloneDir,
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
