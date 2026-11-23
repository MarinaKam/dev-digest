# e2e — `@devdigest/e2e`

Deterministic browser flows, driven by the `agent-browser` CLI. Not Playwright.

## Commands
- This package uses **npm**, not pnpm: `npm install` · `npm test` · `npm run typecheck`
- `npm test` runs against the stack that is already up on `:3000`.
- `npm run e2e:hermetic` boots its own stack on other ports. Read `README.md`
  before you run it and confirm those ports are free.

## Verify a change
- `npm run typecheck` and `npm run lint` after a change to the runner.
- A new or changed flow is run with `npm run e2e:hermetic`. It needs ports
  `:5433`, `:3101` and `:3100` free; a machine that already publishes Postgres
  on `:5433` collides with it.
- Do not judge a flow by `npm test` against a development database that holds
  other repos: the flows assume the seeded repo is the only one.

## Naming
- A flow is `specs/NN-name.flow.json`, with the next free two-digit number.
- `name` says what the user sees; `description` says why the flow exists and
  what data it assumes. Each step has a `label`.

## Conventions
- `specs/` here holds test flows (`NN-name.flow.json`), not feature
  specifications. A flow is a JSON list of `agent-browser` commands.
- Use deterministic locators only: `--url`, `--text`, `find role|text|label`.
  Never use the `chat` command.
- Flows read seeded data only and must not trigger a model call.

## Gotchas
- Flows assume a freshly seeded database where the demo repo is the only repo.

## Do not touch
- `package-lock.json`. It changes only through an install the user runs.

## Read when
- Read `README.md` before you write, run or debug a flow.
- Read `docs/` when you need the reasoning behind the flow conventions.
- Read `../server/specs/` or `../client/specs/` for the feature a flow covers.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when
  you learn something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add a flow.
