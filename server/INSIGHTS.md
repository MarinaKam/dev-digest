# server — insights

Things learned while working in `server/` that the code does not show.

Append-only: add a new entry at the bottom of its section, never rewrite or
delete an old one. If an entry turns out to be wrong, add a new entry that says so.

Entry format, one line per entry:

```
- **YYYY-MM-DD** — <concrete, actionable insight>. Evidence: `path/file.ts:NN`.
```

Write an entry only if a reader can act on it without re-investigating, and
only if it is not obvious from reading the code.

## What Works
<!-- Approaches and solutions that proved effective here. -->
- **2026-11-21** — Run cost for OpenRouter is the real charge from the response (`usage.cost`), in USD. Checked on a live run of PR #482: the three stored `cost_usd` values (0.00005595408, 0.000427815, 0.000049868) equal the Cost column of OpenRouter Logs → Generations for the same requests, and token counts match too. No second API call is needed to get the cost. Evidence: `reviewer-core/src/llm/openrouter.ts:97`, `server/src/modules/reviews/run-executor.ts:215`.
- **2026-11-27** — To prove that a multi-statement write is atomic, make one of its statements fail inside Postgres: a `before insert|update|delete` trigger that raises, created and dropped around the call in the test's own disposable database (`withFault`). It needs no mock and no seam in the code, and it exercises the real route. A test that only breaks the first statement proves nothing; break a later one and read back what the earlier ones wrote. Evidence: `server/test/atomic-writes.it.test.ts:70`.

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->
- **2026-11-21** — Do not estimate an OpenRouter run's cost as tokens × the model's list price. OpenRouter routes the same model to different upstream providers at different prices: in one batch on `deepseek/deepseek-v4-flash`, ~3K-token runs cost $0.00005 via Baidu Qianfan and $0.00043 via DeepInfra (about 8×). Only `usage.cost` is right; the price book is a fallback for when it is absent. Evidence: `server/src/platform/price-book.ts:35`.
- **2026-11-21** — A test that proves "a failed run is not counted in the PR cost" by actually failing a run proves nothing about the `status = 'done'` filter: a failed run already has `cost_usd = NULL`, so the `IS NOT NULL` clause alone passes it. To pin the status filter, insert `agent_runs` rows directly with a non-done status AND a cost. Evidence: `server/test/reviews.it.test.ts:407`.
- **2026-11-27** — Do not switch a service from `new XRepository(container.db)` to a `container.xRepo` getter without reading its tests: `agents-versions.it.test.ts` builds the service over `{ db } as unknown as Container`, and the indexer tests build a container literal with only `git`, `depgraph`, `tokenizer`, `sourceParser`. A getter that the literal lacks is `undefined` at run time while the type check stays green. A new container dependency of the indexer must be added to both literals. Evidence: `server/test/agents-versions.it.test.ts:167`, `server/test/indexer-pipeline.test.ts:132`.

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-21** — In `agent_runs.cost_usd`, NULL and 0 mean different things and must never be merged: NULL = no cost data (failed/cancelled run, unknown model price, run made before migration 0010), 0 = a free model. Write with `?? null`, never `||`. The PR list sums only `status='done'` rows with a non-null cost, and a PR with no such row returns `cost_usd: null`, not 0. Evidence: `server/src/modules/pulls/routes.ts:144`.

- **2026-11-21** — Anything the PR list shows per PR is computed in the list route with one grouped query over all listed PR ids and joined in JS (score, cost, active runs, findings per severity). Do not add a per-PR query or a per-row client request: the demo PR `demo/repo-activity-summary` is exactly that N+1 and the Performance Reviewer flags it. Evidence: `server/src/modules/pulls/routes.ts:114`.
- **2026-11-21** — "The PR's findings" on the list means the latest review of each agent, added up. "The latest review of the PR" is wrong once several agents run: `run all` writes one review per agent and the last one to finish would hide the others' findings. SCORE still uses the single latest review, so the two columns can disagree. Evidence: `server/src/modules/pulls/routes.ts:144`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->
- **2026-11-21** — Integration tests build their database from the SQL files in `src/db/migrations/`, not from the Drizzle schema. After a change in `src/db/schema/`, `*.it.test.ts` keeps running against the old tables until `pnpm db:generate` has produced the new migration file. Typecheck and unit tests stay green in that state, so run generate before trusting the integration lane. Evidence: `server/test/helpers/pg.ts:42`.

- **2026-11-22** — `pnpm lint` (Biome 2.6.8, config in the repo root `biome.json`) passes with about 180 warnings, 154 of them `noNonNullAssertion` in `test/`. That is the baseline, not a regression; the command fails only on errors. Four starter files with real errors (`noImplicitAnyLet`, `noAssignInExpressions`) are downgraded by path in the `overrides` block; code outside that list gets the full rule set. Evidence: `biome.json:33`.
- **2026-11-27** — `pnpm lint:arch` (dependency-cruiser 17.4.3) sees `import type` only because the config sets `tsPreCompilationDeps: true`; without it type-only imports are erased before the check and the row-type and port leaks pass. An npm package resolves to `node_modules/<name>/…` (not the `.pnpm` path), so a rule must match on that. The 23 violations that existed when the rules were added are matched by exact `from`/`to` in `.dependency-cruiser-known-violations.json`; moving or renaming one of those files makes it a new violation. Evidence: `server/.dependency-cruiser.cjs:82`.
- **2026-11-27** — A green `pnpm lint:arch` does not prove two things. (1) Row types: the rules match file paths, so a repository that re-exports a type inferred from a table lets `helpers.ts` and `service.ts` name a row and pass; check with `grep -rnE '\$inferSelect' src/modules | grep -vE '/repository(\.ts|/)'`, which must print nothing. (2) npm imports made by `reviewer-core` files: the cruise starts in `server/src`, and for `../reviewer-core/src/llm/openrouter.ts` its output lists only `./structured.js`, not `openai`. So the `node_modules` half of `review-engine-stays-pure` never fires, and a rule on SDK imports inside `reviewer-core` cannot be written in this config (tried, removed). Evidence: `server/.dependency-cruiser.cjs:86`.

- **2026-11-27** — Correction of the previous entry, point (2): the cause was not where the cruise starts. An npm package resolves to its declaration entry (`node_modules/openai/index.d.ts`), and the config excluded every path that ends in `.d.ts`, so each such package dropped out of the graph: `drizzle-orm`, `openai`, `@anthropic-ai/sdk`, `octokit`, `simple-git`, `js-tiktoken`, `postgres`. The Drizzle half of `orm-only-in-persistence` and most of `vendor-sdk-only-in-adapters` could not fire; only packages that resolve to a `.js` file (`fastify`, `@ast-grep/napi`) were seen. The exclude now covers the server's own declaration files only (`^src/.*\.d\.ts$`), and `review-engine-io-only-in-llm` exists. After any change to `exclude` or to a rule, plant one forbidden import and confirm the rule reports it: a rule that has never failed is not known to work. Evidence: `server/.dependency-cruiser.cjs:112`.

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
- **2026-11-21** — A run that fails or is cancelled after the model has already answered stores `cost_usd = NULL`, although money was spent: the catch path does not have the partial usage. Should spend on failed runs be recorded, and if so shown where? Evidence: `server/src/modules/reviews/run-executor.ts:305`.
