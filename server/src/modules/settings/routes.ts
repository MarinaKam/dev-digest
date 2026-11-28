import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  SettingsUpdate,
  ConnTestRequest,
  type ConnTestResult,
  type SecretsStatus,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { SettingsService } from './service.js';

/**
 * F1 — settings module. Transport layer only; the logic is in SettingsService.
 *   GET  /settings                 → current non-secret prefs
 *   GET  /settings/secrets-status  → which provider keys are configured
 *   PUT  /settings                 → upsert prefs (key/value rows)
 *   POST /settings/test-connection → test a provider key (OpenAI/Anthropic/GitHub)
 */
export default async function settingsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new SettingsService(container);

  app.get('/settings', async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.get(workspaceId);
  });

  // Booleans only — the values are NEVER returned. Drives the "Configured /
  // Not set" badges in the API Keys panel.
  app.get('/settings/secrets-status', async (req): Promise<SecretsStatus> => {
    await getContext(container, req);
    return service.secretsStatus();
  });

  app.put('/settings', { schema: { body: SettingsUpdate } }, async (req) => {
    const { workspaceId, userId } = await getContext(container, req);
    const saved = await service.update(workspaceId, userId, req.body);
    const { theme: _theme, ...response } = saved;
    return response;
  });

  app.post(
    '/settings/test-connection',
    {
      schema: { body: ConnTestRequest },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req): Promise<ConnTestResult> => service.testConnection(req.body),
  );
}
