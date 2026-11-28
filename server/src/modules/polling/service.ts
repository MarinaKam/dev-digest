import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';

/**
 * Manual refresh of a repo's PR list: new and updated pull requests appear and
 * `head_sha` moves. It never triggers a review. The rows are written by the
 * pulls repository, the single writer of `pull_requests`.
 */
export class PollingService {
  constructor(private container: Container) {}

  async poll(workspaceId: string, repoId: string): Promise<{ synced: number }> {
    const repo = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    const gh = await this.container.github();
    const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
    await this.container.pullsRepo.upsertFromGitHub(workspaceId, repo.id, pulls);
    await this.container.reposRepo.markPolled(repo.id);
    return { synced: pulls.length };
  }
}
