# e2e — `@devdigest/e2e`

Deterministic browser flows, driven by the `agent-browser` CLI. Not Playwright.

## Commands
- This package uses **npm**, not pnpm: `npm install` · `npm test` · `npm run typecheck`
- `npm test` runs against the stack that is already up on `:3000`.
- `npm run e2e:hermetic` boots its own stack on other ports. Read `README.md`
  before you run it and confirm those ports are free.

## Conventions
- `specs/` here holds test flows (`NN-name.flow.json`), not feature
  specifications. A flow is a JSON list of `agent-browser` commands.
- Use deterministic locators only: `--url`, `--text`, `find role|text|label`.
  Never use the `chat` command.
- Flows read seeded data only and must not trigger a model call.

## Gotchas
- Flows assume a freshly seeded database where the demo repo is the only repo.

## Read when
- Read `README.md` before you write, run or debug a flow.
- Read `docs/` when you need the reasoning behind the flow conventions.
- Read `../server/specs/` or `../client/specs/` for the feature a flow covers.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when
  you learn something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add a flow.
