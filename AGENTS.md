# DevDigest

Local-first AI pull-request review. Four standalone packages, no workspace.

## Stack
Node >=22 · TypeScript 5.7 · Zod 3 · Vitest 2
- server: Fastify 5 · Drizzle ORM 0.38 · Postgres 16 + pgvector
- client: Next.js 15 (App Router) · React 19 · TanStack Query 5 · Tailwind 4

## Where things live
| Path | What | Package manager |
|---|---|---|
| `server/` | API, DB schema, adapters, feature modules | pnpm |
| `server/src/modules/repo-intel/` | codebase indexer | (server) |
| `client/` | web app | pnpm |
| `reviewer-core/` | pure review engine: diff -> prompt -> LLM -> findings | npm |
| `e2e/` | browser flows | npm |

Each of these has its own `AGENTS.md` with the conventions for that module.

`AGENTS.md` is the source of the agent instructions, for every coding agent.
The `CLAUDE.md` next to it is a symlink to it, so Claude Code reads the same
text. Change the instructions in `AGENTS.md`.

## Commands
- Whole stack: `./scripts/dev.sh` (`--db-only` for Postgres + migrate + seed)
- There is no root `package.json`. Run package commands inside the package.

## Verify a change
Run the checks of every package you touched, inside that package. A change is
not done until they pass; quote the output, do not summarise it.

| Package | Type check | Lint | Tests |
|---|---|---|---|
| `client/` | `pnpm typecheck` | `pnpm lint` | `pnpm test` |
| `server/` | `pnpm typecheck` | `pnpm lint` | `pnpm exec vitest run --exclude '**/*.it.test.ts'` (unit) · `pnpm exec vitest run .it.test` (integration, needs Docker) |
| `reviewer-core/` | `npm run typecheck` | `npm run lint` | `npm test` |
| `e2e/` | `npm run typecheck` | `npm run lint` | `npm run e2e:hermetic` |

- Lint is Biome (`biome.json` at the repo root, one config for all packages;
  linter only, formatting is not Biome's job here). `lint` fails on errors.
  Warnings are the known baseline of the starter code: do not add to them.
- Never run `biome lint --write` over a package: it rewrites hundreds of
  starter files. Fix the lines you touched by hand.
- Silence a rule only on one line, with
  `// biome-ignore lint/<group>/<rule>: <reason>`. Do not add a file to the
  `overrides` list in `biome.json` to make new code pass; that list is the
  baseline of starter files and should only shrink.

- A change in `reviewer-core/` or in `server/src/vendor/shared` also needs
  `pnpm typecheck` in `server/` and, for the shared contracts, in `client/`.
- A change to a route or a query needs the integration tests, not only the
  unit tests.
- A UI change is also checked in the running app; reload the tab first.

## Before a push or a pull request
- Run the `pr-self-review` skill. It runs the checks above, sends the changed
  `client/` files to the frontend skills and the changed `server/` and
  `reviewer-core/` files to the backend skills, and records a verdict for that
  exact content.
- A hook in `.claude/settings.json` blocks `git push`, `gh pr create` and
  `gh pr merge` until that verdict is a pass. One critical finding blocks. A
  change that touches only `*.md` files passes without a review.
- Which folder goes to which reviewer, which files are skipped, and which
  folders must stay identical copies is in `.claude/pr-self-review.config.json`.
  Change that file when a package is added; do not work around the gate.
- When the gate blocks, tell the user. Do not reach the same result another way
  (a script, an alias, another tool). The override is the user's and is not
  read from the command.

## Naming
- Branches: `<type>/<slug>` (`feat/severity-counters`). Commits:
  `<type>: <description>`; types `feat`, `fix`, `refactor`, `docs`, `test`,
  `chore`, `perf`, `ci`.
- Specs: `NNN-short-name.md`, numbered per `specs/` folder. E2E flows:
  `NN-name.flow.json`.
- Tests sit in the package's own suite: `Name.test.tsx` next to the component
  (client), `test/<name>.test.ts` (server), and `*.it.test.ts` for any test
  that needs the database.
- API JSON fields and database columns are `snake_case` (`cost_usd`,
  `active_runs`); TypeScript identifiers and Drizzle fields are `camelCase`.
- A Zod schema and its inferred type share one `PascalCase` name
  (`Severity`, `PrMeta`).
- Name a value after what it holds: a list of reviews is `reviews`, not `runs`.
- Package-specific naming is in each package's `AGENTS.md`.

## Gotchas
- The server imports `reviewer-core` source through a tsconfig alias. A change
  there must pass `pnpm typecheck` in `server/` too.
- `@devdigest/shared` exists twice. `server/src/vendor/shared` is the source of
  truth; mirror every change into `client/src/vendor/shared`.
- Migrations never run on boot: `cd server && pnpm db:migrate`.
- The DB schema holds tables for future milestones. Empty tables are intended.

## Do not touch
- Existing files in `server/src/db/migrations/` (add new ones with `pnpm db:generate`)
- `server/clones/` (runtime data) and any `.env` file
- Lock files: `client/pnpm-lock.yaml`, `server/pnpm-lock.yaml`,
  `reviewer-core/package-lock.json`, `e2e/package-lock.json`, `skills-lock.json`.
  Never edit them by hand. They change only as the result of an install
  command, and installs are run by the user, not by the agent.

## Read when
- Read `README.md` when you need the end-to-end review flow.
- Read `server/README.md` when you add or change a route or an env variable.
- Read `reviewer-core/README.md` when you touch the prompt, grounding or scoring.
- Read `TESTING.md` before you add or move a test.
- Read `<module>/specs/` before you implement or change a feature in that module.
  A feature that spans packages is specified in `server/specs/`.
- Read `<module>/INSIGHTS.md` before you start any work in that module. Before
  the session ends, append what you learned that the code does not show and that
  the file does not already hold (skill `engineering-insights`). Never rewrite
  entries.

## Homework pull requests
- Homework is submitted as a pull request in my fork: `gh pr create --repo MarinaKam/dev-digest --base main`.
- Write the description by filling in every section of `.github/pull_request_template.md`. Do not replace the template with free text.
- Paste the homework checklist from the course materials; if I have not given it to you, ask me for it.
- "Not done / known limits" must list every open item from your final report.
- Remind me to record and attach the screencast before the PR is ready. Put the
  video link first in "Screenshots / Demo", on its own line, above any image.
- Before ticking a criterion about the agent setup (`AGENTS.md`, `CLAUDE.md`,
  `INSIGHTS.md`, `docs/`, `specs/`), open the files and check their content
  against the lesson's requirements. That the file exists is not the criterion.
