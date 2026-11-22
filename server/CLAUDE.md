# server — `@devdigest/api`

Fastify API over Postgres. Imports repos and PRs, indexes them, runs reviews.

## Commands
- `pnpm dev` · `pnpm typecheck` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed`
- Unit (no Docker): `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (needs Docker): `pnpm exec vitest run .it.test`

## Conventions
- Layers are `routes.ts` -> service -> repository. Routes declare Zod `params`
  and `body` schemas; handlers do not call `Schema.parse` by hand.
- A new module is `src/modules/<name>/routes.ts` plus one entry in
  `src/modules/index.ts`. There is no filesystem autoload.
- Services reach external systems only through the DI container
  (`src/platform/container.ts`), never by constructing an adapter directly.
- Every query scopes by `workspace_id`; get it from `getContext()`.
- A test that touches the database must be named `*.it.test.ts`.

## Gotchas
- Secrets are read only through `SecretsProvider`. They are not in `AppConfig`
  and not in the database.
- Review runs execute in the background, in this process. Run state and the SSE
  bus are in memory, so the design assumes a single API instance.
- `src/platform/{prompt,grounding,structured}.ts` are re-export shims. The code
  lives in `reviewer-core/`.

## Do not touch
- Existing files in `src/db/migrations/`. Change the schema, then `pnpm db:generate`.
- `clones/` is runtime data.

## Read when
- Read `README.md` when you add or change a route, an env variable, or what the
  reviewer sends to the model.
- Read `src/modules/repo-intel/CLAUDE.md` when you touch the indexer or the
  review context built from it.
- Read `docs/` when you need the reasoning behind a module's design.
- Read `specs/` before you implement or change a feature.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when you learn
  something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add or move a test.
