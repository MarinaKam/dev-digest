import type { Settings } from '@devdigest/shared';

/** One stored setting: a key and its JSON value (non-secret prefs). */
export interface SettingEntry {
  key: string;
  value: unknown;
}

/** Collapse key/value settings into a flat `Settings` object. */
export function entriesToSettings(entries: SettingEntry[]): Settings {
  return Object.fromEntries(entries.map((e) => [e.key, e.value])) as Settings;
}
