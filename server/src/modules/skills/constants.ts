/** Limits of the skills feature (spec `server/specs/003-review-agent-skills.md`). */

/** Largest uploaded file, after base64 decoding. */
export const MAX_UPLOAD_BYTES = 1_048_576;

/**
 * Request body limit of `POST /skills/import/preview`. A 1 MiB file is 1,398,104
 * base64 characters before the JSON envelope; the global limit is 1 MiB.
 */
export const IMPORT_BODY_LIMIT = 1_572_864;

/** Most entries a skill archive may list. */
export const MAX_ZIP_ENTRIES = 200;

/** Largest decompressed skill core (`SKILL.md`). */
export const MAX_CORE_BYTES = 200 * 1024;

/** Name of the core file inside an archive. */
export const SKILL_CORE_FILE = 'SKILL.md';

/** Type given to an imported skill until the user picks one. */
export const IMPORTED_SKILL_TYPE = 'custom';

/** First version of every skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Note of version 1 when the creator gave none. */
export const CREATED_VERSION_NOTE = 'Created';

/** Postgres SQLSTATE for a unique-index violation. */
export const UNIQUE_VIOLATION = '23505';
