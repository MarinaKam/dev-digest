# server — `@devdigest/api`

Fastify API over Postgres. Imports repos and PRs, indexes them, runs reviews.

## Commands
- `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed`
- Unit (no Docker): `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (needs Docker): `pnpm exec vitest run .it.test`

## Verify a change
- `pnpm typecheck` and `pnpm lint` after every change.
- `pnpm lint:arch` after every change that adds or changes an import. It checks
  the dependency direction below (`.dependency-cruiser.cjs`).
- Unit tests after every change:
  `pnpm exec vitest run --exclude '**/*.it.test.ts'`.
- Integration tests when you touch a route, a query or the schema:
  `pnpm exec vitest run .it.test` (needs Docker; each file starts its own
  disposable Postgres and never touches the development database).
- A change to `src/vendor/shared` is mirrored into `../client/src/vendor/shared`;
  run `pnpm typecheck` in `../client/` too.

## Naming
- A module is `src/modules/<kebab-name>/` with `routes.ts`, `service.ts`,
  `repository.ts`, and when it needs them `types.ts` (domain types),
  `helpers.ts` (pure functions), `constants.ts`, `ports.ts`.
- Tests are `test/<name>.test.ts`; a test that needs the database is
  `test/<name>.it.test.ts`.
- Database columns are `snake_case`; Drizzle fields are `camelCase`
  (`cost_usd` ↔ `costUsd`). API JSON is `snake_case`.
- Migrations are generated; never name or write one by hand.
- A spec is `specs/NNN-short-name.md`.

## Conventions
- Layers are `routes.ts` -> service -> repository. Routes declare Zod `params`
  and `body` schemas; handlers do not call `Schema.parse` by hand.
- A new module is `src/modules/<name>/routes.ts` plus one entry in
  `src/modules/index.ts`. There is no filesystem autoload.
- Services reach external systems only through the DI container
  (`src/platform/container.ts`), never by constructing an adapter directly.
- Every query scopes by `workspace_id`; get it from `getContext()`.
- A test that touches the database must be named `*.it.test.ts`.

## Dependency direction
Use the `onion-architecture` skill before you add a port, an adapter, a business
rule, a transaction, or an import that crosses one of these rings. Imports point
inward only, `import type` included.

| Ring | Here |
|---|---|
| Domain | `../reviewer-core/`, contracts and ports in `src/vendor/shared`, and in a module: pure rules in `helpers.ts`, `constants.ts`, `status.ts`, domain types in `types.ts`, ports in `ports.ts` |
| Application | a module's `service.ts` and use-case files (`run-executor.ts`, `repo-intel/pipeline/`) |
| Infrastructure | a module's `repository.ts` or `repository/`, `src/db/`, `src/adapters/`, `src/platform/` (its SQL is in `src/platform/repository/`) |
| Edge | a module's `routes.ts`, `src/modules/index.ts`, `src/platform/container.ts` (composition root), `src/app.ts`, `src/server.ts` |

- A new port goes to `src/vendor/shared` when the client or `reviewer-core`
  also needs the type, otherwise to `ports.ts` of the module that calls it. Not
  to the adapter's file. `ports.ts` holds only interfaces and plain types; it is
  the one module file an adapter may import, so the adapter can `implements` it.
- `pnpm lint:arch` enforces the import part.
  `.dependency-cruiser-known-violations.json` is empty and stays empty: fix the
  import, never add an entry.
- The check reads import paths, not signatures. Two things it cannot see, check
  them by hand:
  - A repository returns the module's domain types from `types.ts`. A service,
    a helper or a route never names a type inferred from a table
    (`$inferSelect`), and a repository does not re-export one.
  - `reviewer-core` imports a provider SDK only under `src/llm/`.
- A table has one writer, the repository of the module that owns it:
  `pull_requests`, `pr_files`, `pr_commits` belong to `pulls`; `repos` to
  `repos`; `reviews`, `findings`, `pr_intent`, `agent_runs`, `run_traces` to
  `reviews`; `agents`, `agent_versions`, `agent_skills` to `agents`; `settings`
  to `settings`; the index tables to `repo-intel`; `jobs` to
  `src/platform/repository/jobs.ts`. Another module writes through the owner
  (`container.pullsRepo`, `container.reposRepo`). A grouped read for one screen
  may join other modules' tables in the repository that serves the screen
  (`PullsRepository.rollupsFor`); never reuse it for a write.
- Writes that must succeed or fail together are one transaction, opened in the
  repository: a method that runs more than one statement wraps them in
  `db.transaction`. A unit across two modules goes through
  `container.unitOfWork` (the review outcome: review, findings, reviewed commit,
  run status). The transaction handle never appears in a service signature.
- An id that arrives in a request (URL or body) is resolved inside the caller's
  workspace before anything uses it, and an id of another workspace is a 404.
  This holds where the thing behind the id knows no workspace: the in-memory
  run bus (`ReviewService.assertRunExists`), the repo-intel facade (the routes
  check the repo), a skill linked to an agent
  (`AgentsService.assertSkillsInWorkspace`).
- Accepted deviations, follow them in new code:
  - Errors extend `AppError` in `src/platform/errors.ts` and carry the HTTP
    status. Services throw them; there is no separate mapping at the edge.
  - Services receive the `Container`. Do not narrow one service on its own.
  - A service returns the API contract type from `@devdigest/shared`
    (`snake_case`), mapped by a pure function in `helpers.ts`. Routes do not
    reshape it.

## Gotchas
- Secrets are read only through `SecretsProvider`. They are not in `AppConfig`
  and not in the database.
- Review runs execute in the background, in this process. Run state and the SSE
  bus are in memory, so the design assumes a single API instance.
- `src/platform/{prompt,grounding,structured}.ts` and
  `src/adapters/git/diff-parser.ts` are re-export shims. The code lives in
  `reviewer-core/`.

## Do not touch
- Existing files in `src/db/migrations/`. Change the schema, then `pnpm db:generate`.
- `clones/` is runtime data.
- `pnpm-lock.yaml`. It changes only through an install the user runs.

## Read when
- Read `README.md` when you add or change a route, an env variable, or what the
  reviewer sends to the model.
- Read `src/modules/repo-intel/AGENTS.md` when you touch the indexer or the
  review context built from it.
- Read `docs/` when you need the reasoning behind a module's design.
- Read `specs/` before you implement or change a feature.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when you learn
  something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add or move a test.
