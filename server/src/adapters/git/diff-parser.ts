/**
 * The unified-diff parser moved to @devdigest/reviewer-core: it is a pure
 * function over the shared `UnifiedDiff` contract, and the review module needs
 * it without importing an adapter. This file is a thin re-export shim so the
 * git adapter and existing importers keep working.
 */
export { parseUnifiedDiff } from '@devdigest/reviewer-core';
