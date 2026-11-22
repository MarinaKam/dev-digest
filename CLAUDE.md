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

Each of these has its own `CLAUDE.md` with the conventions for that module.

## Commands
- Whole stack: `./scripts/dev.sh` (`--db-only` for Postgres + migrate + seed)
- There is no root `package.json`. Run package commands inside the package.

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

## Read when
- Read `README.md` when you need the end-to-end review flow.
- Read `server/README.md` when you add or change a route or an env variable.
- Read `reviewer-core/README.md` when you touch the prompt, grounding or scoring.
- Read `TESTING.md` before you add or move a test.
- Read `<module>/specs/` before you implement or change a feature in that module.
  A feature that spans packages is specified in `server/specs/`.
- Read `<module>/LEARNINGS.md` before you debug in that module. When you learn
  something the code does not show, append a dated entry. Never rewrite entries.
