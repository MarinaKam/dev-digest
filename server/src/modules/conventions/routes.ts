import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateSkillFromConventions,
  ExtractConventionsRequest,
  UpdateConvention,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ConventionsService } from './service.js';

const ConventionParams = IdParams.extend({ conventionId: z.string().uuid() });

/**
 * Conventions module (spec 004). `:id` is the repo.
 *   GET   /repos/:id/conventions                    → candidates + last run
 *   POST  /repos/:id/conventions/extract            → one run (one model call)
 *   PATCH /repos/:id/conventions/:conventionId      → edit the rule, accept or reject
 *   POST  /repos/:id/conventions/skill              → save accepted ones as a skill
 */
export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams, body: ExtractConventionsRequest.optional() } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.extract(workspaceId, req.params.id, req.body?.sampling);
    },
  );

  app.patch(
    '/repos/:id/conventions/:conventionId',
    { schema: { params: ConventionParams, body: UpdateConvention } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.params.conventionId, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillFromConventions } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.createSkill(workspaceId, req.params.id, req.body);
    },
  );
}
