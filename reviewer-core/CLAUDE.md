# reviewer-core — `@devdigest/reviewer-core`

The pure review engine: diff -> prompt -> LLM -> structured findings -> grounding.

## Commands
- This package uses **npm**, not pnpm: `npm ci` · `npm test` · `npm run typecheck`
- After a change, also run `pnpm typecheck` in `../server/`. The server imports
  this source directly.

## Verify a change
- `npm run typecheck` and `npm test` here, after every change.
- Then `pnpm typecheck` and the unit tests in `../server/`: the server imports
  this source directly, so a change here can break it without failing here.

## Naming
- One pipeline stage per file in `src/` (`prompt.ts`, `grounding.ts`); the
  orchestration is `src/review/`, providers are `src/llm/`.
- Tests are `<name>.test.ts`. A spec is `specs/NNN-short-name.md`.
- Severity and verdict values are the exact strings of the shared contract
  (`CRITICAL`, `WARNING`, `SUGGESTION`; `request_changes`, `comment`,
  `approve`). Do not add a level.

## Conventions
- No I/O. No database, GitHub, filesystem or environment access. The only
  outside call is the `LLMProvider` passed in by the caller.
- Everything the caller may use is exported from `src/index.ts`.
- Contracts come from `@devdigest/shared`, which resolves to
  `../server/src/vendor/shared`. Do not redefine those types here.

## Gotchas
- All external content (diff, PR body, repo map, callers) is untrusted. It goes
  through `wrapUntrusted`; the defense is the `INJECTION_GUARD` rule in
  `src/prompt.ts`. Do not add keyword filtering of untrusted text.
- A finding that cites a line outside the diff is dropped, and the score is
  recomputed from the findings that remain. The model's own score is ignored.

## Do not touch
- `package-lock.json`. It changes only through an install the user runs.

## Read when
- Read `README.md` when you change a pipeline stage or the public API.
- Read `docs/` when you need the reasoning behind a prompt or grounding decision.
- Read `specs/` before you implement or change a feature.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when you learn
  something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add or move a test.
