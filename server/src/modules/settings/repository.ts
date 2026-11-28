import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SettingEntry } from './helpers.js';

/**
 * Settings data access. Owns the `settings` table: non-secret prefs stored as
 * key/value rows per workspace. Secrets never reach this table.
 */
export class SettingsRepository {
  constructor(private db: DbExecutor) {}

  async list(workspaceId: string): Promise<SettingEntry[]> {
    return this.db
      .select({ key: t.settings.key, value: t.settings.value })
      .from(t.settings)
      .where(eq(t.settings.workspaceId, workspaceId));
  }

  /**
   * Upsert the given keys as one transaction: an update either stores every
   * key or none of them.
   */
  upsertMany(workspaceId: string, userId: string, entries: SettingEntry[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      for (const { key, value } of entries) {
        await tx
          .insert(t.settings)
          .values({ workspaceId, userId, key, value })
          .onConflictDoUpdate({
            target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
            set: { value },
          });
      }
    });
  }
}
