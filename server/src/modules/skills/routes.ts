import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateSkill, SkillImportRequest, UpdateSkill } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { IMPORT_BODY_LIMIT } from './constants.js';
import { SkillsService } from './service.js';

/**
 * Skills module.
 *   GET    /skills                  → all skills of the workspace, with used_by
 *   GET    /skills/:id              → one skill
 *   POST   /skills                  → create (version 1)
 *   PATCH  /skills/:id              → update; a body change makes a new version
 *   DELETE /skills/:id              → delete (unlinks it from every agent)
 *   GET    /skills/:id/versions     → body snapshots, newest first
 *   POST   /skills/import/preview   → parse an upload into a draft; writes nothing
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.get(workspaceId, req.params.id);
  });

  app.post('/skills', { schema: { body: CreateSkill } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.create(workspaceId, req.body);
  });

  app.patch('/skills/:id', { schema: { params: IdParams, body: UpdateSkill } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.update(workspaceId, req.params.id, req.body);
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    await service.delete(workspaceId, req.params.id);
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.versions(workspaceId, req.params.id);
  });

  // A 1 MiB file is ~1.4 MB as base64, over the global 1 MiB body limit.
  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: SkillImportRequest } },
    async (req) => {
      await getContext(app.container, req);
      return service.previewImport(req.body);
    },
  );
}
