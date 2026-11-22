# repo-intel — the codebase indexer

Indexes a cloned repo once (symbols, import graph, file rank, repo map). Reviews
only read the result.

## Conventions
- Other modules use the facade only: `container.repoIntel.*` (`service.ts`,
  interface in `types.ts`). Do not import from `pipeline/` or `repository.ts`
  outside this folder.
- Every facade method degrades instead of throwing: an unindexed or partly
  indexed repo returns an empty result.
- A new consumer feature (blast radius, conventions, onboarding) adds or uses a
  facade method. It does not re-index.

## Gotchas
- Two switches gate enrichment: the global `REPO_INTEL_ENABLED` and the
  per-agent `repo_intel` flag. With either off, the review prompt must be
  identical to the diff-only prompt.
- Indexing runs as a background job after clone and on resync, not at request time.

## Read when
- Read `README.md` when you need the pipeline stages or the list of facade methods.
- Read `../../../specs/` before you implement or change a feature that uses the index.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry
  when you learn something the code does not show. Never rewrite entries.
