/**
 * Job kinds a module enqueues for another module to run. The enqueuing side and
 * the handler agree on the kind here, so neither imports the other's folder.
 */

/** Full index of a cloned repo (repo-intel handles it; repos enqueues it after a clone). */
export const INDEX_JOB_KIND = 'repo-intel-index';
/** Incremental reindex after a refresh. */
export const REFRESH_JOB_KIND = 'repo-intel-refresh';
