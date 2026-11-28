import type {
  ConnTestRequest,
  ConnTestResult,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';
import { entriesToSettings } from './helpers.js';
import { SettingsRepository } from './repository.js';

/**
 * Settings: the workspace's non-secret prefs, which provider keys are
 * configured, and the connection test.
 *
 * Secrets are NOT stored here. The connection test reads (and, when the UI
 * supplies one, first stores) the key through SecretsProvider and makes one
 * cheap live call (list models / current GitHub login).
 */
export class SettingsService {
  private repo: SettingsRepository;

  constructor(private container: Container) {
    this.repo = new SettingsRepository(container.db);
  }

  async get(workspaceId: string): Promise<Settings> {
    return entriesToSettings(await this.repo.list(workspaceId));
  }

  async update(workspaceId: string, userId: string, patch: SettingsUpdate): Promise<Settings> {
    const entries = Object.entries(patch).map(([key, value]) => ({ key, value }));
    await this.repo.upsertMany(workspaceId, userId, entries);
    return this.get(workspaceId);
  }

  /** Which provider keys are configured. Booleans only: a value is never returned. */
  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, string][]).map(
        async ([provider, key]) =>
          [provider, Boolean(await this.container.secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  /** Test a provider connection. Never throws: a failure is `ok: false`. */
  async testConnection({ provider, key }: ConnTestRequest): Promise<ConnTestResult> {
    try {
      // If the UI supplied a key, persist it (BYO key) before testing so the
      // test reflects — and the rest of the app can use — the new value.
      if (key) {
        if (!this.container.secrets.set) {
          return { provider, ok: false, message: 'Secrets backend is read-only' };
        }
        await this.container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
        this.container.invalidateSecretCaches();
      }
      if (provider === GITHUB_PROVIDER) {
        const gh = await this.container.github();
        const login = await gh.currentLogin();
        return { provider, ok: true, message: `Connected as @${login}` };
      }
      const llm = await this.container.llm(provider);
      const models = await llm.listModels();
      return { provider, ok: true, message: `OK — ${models.length} models available` };
    } catch (err) {
      return { provider, ok: false, message: (err as Error).message };
    }
  }
}
