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

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->
- **2026-11-21** — Do not estimate an OpenRouter run's cost as tokens × the model's list price. OpenRouter routes the same model to different upstream providers at different prices: in one batch on `deepseek/deepseek-v4-flash`, ~3K-token runs cost $0.00005 via Baidu Qianfan and $0.00043 via DeepInfra (about 8×). Only `usage.cost` is right; the price book is a fallback for when it is absent. Evidence: `server/src/platform/price-book.ts:35`.
- **2026-11-21** — A test that proves "a failed run is not counted in the PR cost" by actually failing a run proves nothing about the `status = 'done'` filter: a failed run already has `cost_usd = NULL`, so the `IS NOT NULL` clause alone passes it. To pin the status filter, insert `agent_runs` rows directly with a non-done status AND a cost. Evidence: `server/test/reviews.it.test.ts:407`.

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-21** — In `agent_runs.cost_usd`, NULL and 0 mean different things and must never be merged: NULL = no cost data (failed/cancelled run, unknown model price, run made before migration 0010), 0 = a free model. Write with `?? null`, never `||`. The PR list sums only `status='done'` rows with a non-null cost, and a PR with no such row returns `cost_usd: null`, not 0. Evidence: `server/src/modules/pulls/routes.ts:144`.

- **2026-11-21** — Anything the PR list shows per PR is computed in the list route with one grouped query over all listed PR ids and joined in JS (score, cost, active runs, findings per severity). Do not add a per-PR query or a per-row client request: the demo PR `demo/repo-activity-summary` is exactly that N+1 and the Performance Reviewer flags it. Evidence: `server/src/modules/pulls/routes.ts:114`.
- **2026-11-21** — "The PR's findings" on the list means the latest review of each agent, added up. "The latest review of the PR" is wrong once several agents run: `run all` writes one review per agent and the last one to finish would hide the others' findings. SCORE still uses the single latest review, so the two columns can disagree. Evidence: `server/src/modules/pulls/routes.ts:144`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->
- **2026-11-21** — Integration tests build their database from the SQL files in `src/db/migrations/`, not from the Drizzle schema. After a change in `src/db/schema/`, `*.it.test.ts` keeps running against the old tables until `pnpm db:generate` has produced the new migration file. Typecheck and unit tests stay green in that state, so run generate before trusting the integration lane. Evidence: `server/test/helpers/pg.ts:42`.

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
- **2026-11-21** — A run that fails or is cancelled after the model has already answered stores `cost_usd = NULL`, although money was spent: the catch path does not have the partial usage. Should spend on failed runs be recorded, and if so shown where? Evidence: `server/src/modules/reviews/run-executor.ts:305`.
