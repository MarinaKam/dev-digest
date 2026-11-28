import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PrDetail, PrMeta, PrReviewComment } from '@devdigest/shared';
import { PrCommentInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PullsService } from './service.js';

/**
 * F1 — pulls module. Transport layer only; the logic is in PullsService.
 *   GET  /repos/:id/pulls    → PRs of a repo (open + recently merged/closed,
 *                              synced from GitHub, persisted). `status` is the
 *                              review status derived from GitHub's merge state.
 *   GET  /pulls/:id          → full PR detail (diff/files, commits, body)
 *   GET  /pulls/:id/comments → inline review comments, live from GitHub
 *   POST /pulls/:id/comments → create one inline review comment on GitHub
 *
 * Import is idempotent (unique repo_id+number). A review is triggered manually
 * and owned by the reviews module — nothing here starts one.
 */
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new PullsService(container);

  app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req): Promise<PrMeta[]> => {
    const { workspaceId } = await getContext(container, req);
    return service.list(workspaceId, req.params.id, req.log);
  });

  app.get('/pulls/:id', { schema: { params: IdParams } }, async (req): Promise<PrDetail> => {
    const { workspaceId } = await getContext(container, req);
    return service.detail(workspaceId, req.params.id, req.log);
  });

  // ---- Inline review comments (Files changed tab) -------------------------
  // Proxied live to GitHub (no local persistence): GET reflects existing PR
  // comments; POST creates one immediately.
  app.get(
    '/pulls/:id/comments',
    { schema: { params: IdParams } },
    async (req): Promise<PrReviewComment[]> => {
      const { workspaceId } = await getContext(container, req);
      return service.listComments(workspaceId, req.params.id, req.log);
    },
  );

  app.post(
    '/pulls/:id/comments',
    { schema: { params: IdParams, body: PrCommentInput } },
    async (req): Promise<PrReviewComment> => {
      const { workspaceId } = await getContext(container, req);
      return service.createComment(workspaceId, req.params.id, req.body);
    },
  );
}
