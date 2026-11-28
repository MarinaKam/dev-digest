# Conventions Extractor on a real repository: `MarinaKam/dev-digest`

Two stretch tasks of the L02 homework, run on the same repository and commit:

- **Extractor on a work repository** — the fork itself, a real TypeScript code
  base whose conventions are written down in `AGENTS.md` / `CLAUDE.md`, so each
  candidate can be graded against rules the team actually wrote.
- **More findings of better quality** — the same run with two sampling
  strategies: `top` (the task's baseline: the 12 best-ranked files) and
  `spread` (24 ranked files spread across folders, the default now).

Setup: clone at `94400ae`, model `openrouter/deepseek/deepseek-v4-flash`,
one run per strategy on 2026-11-28. A strategy is chosen with
`POST /repos/:id/conventions/extract { "sampling": "top" | "spread" }`; both
runs are stored in `convention_scans`.

## Before and after: `top` vs `spread`

| | `top` (before) | `spread` (after) |
|---|---|---|
| Files sent (incl. `biome.json`) | 13 | 23 |
| Rules proposed by the model | 20 | 20 |
| Kept by the evidence check | 20 | 19 (1 dropped: snippet not in the file) |
| Folders the evidence comes from | 6 | 16 |
| Confidence | all 1.0 | 0.50–0.90, mean 0.73 |
| Cost | $0.00186 | $0.00103 |

What changed, read from the candidates:

- **`top` is narrow.** Ranked files cluster in `server/src/db/schema/` and
  `client/src/app/repos/[repoId]/pulls/`, so half the rules are micro facts of
  one folder ("use `index` for non-unique indexes", "use `uniqueIndex` for
  composite unique constraints", "use `ReadonlySet` for sets of constant
  values"). Every one has confidence 1.0, including rules seen once.
- **`spread` covers the architecture.** The same budget reaches the error
  taxonomy (`server/src/platform/errors.ts`), request context
  (`server/src/modules/_shared/context.ts`), the API client
  (`client/src/lib/api.ts`), query key factories, i18n, co-located styles and
  component folders. The prompt's "seen in one file only: at most 0.6" rule is
  followed: confidence now separates repeated rules from one-offs.
- **What the model still lacks:** files are picked by rank, and rank favours
  hubs. A rule seen in two places is still cited from one file; the next step
  is several evidence files per rule (repo-intel would need to return files
  that share a pattern, not only the top of the rank).

## Grading the `spread` candidates against `AGENTS.md`

| # | Candidate (shortened) | Verdict | Why |
|---|---|---|---|
| 1 | Barrel-export all schema tables from `db/schema.ts` | take | Real structure; new tables must be added there |
| 2 | Co-locate styles in `styles.ts` with `satisfies CSSProperties` / `as const` | take | Matches `client/INSIGHTS.md` (styles are objects in `styles.ts`, not Tailwind) |
| 3 | Use `as const` for constant objects | weak | True but too general to review against |
| 4 | Use `useTranslations` from next-intl | take | `client/AGENTS.md`: user text lives in `messages/en/*.json` |
| 5 | React Query with query key factories | take | `client/AGENTS.md`: keys only from the domain's factory |
| 6 | Domain error classes extending `AppError` | take | `server/AGENTS.md`: errors extend `AppError` and carry the status |
| 7 | Component folder with `constants.ts`, `helpers.ts`, `styles.ts` | take | `client/AGENTS.md` naming rules |
| 8 | `ApiError` + typed `api` object for every call | take | `client/AGENTS.md`: all API calls go through `src/lib/api.ts` |
| 9 | UI constants in co-located `constants.ts` | take | Same rule family as 7 |
| 10 | Handle null in presentational components | weak | Generic advice, not a house rule |
| 11 | Request context (`workspaceId`, `userId`) from the auth provider | take | `server/AGENTS.md`: every query scopes by `workspace_id` from `getContext()` |
| 12 | Pure helpers in separate files | take | `server/AGENTS.md`: `helpers.ts` holds pure rules |
| 13 | JSDoc on every props field | false | Not a rule; many props have none |
| 14 | Prefix hook files with `use`, place in `lib/hooks/` | **false** — rejected in the UI | Data hooks are grouped by domain (`lib/hooks/agents.ts`); only UI hooks are `useThing.ts` |
| 15 | `React.useMemo` for derived data | false | Not a rule; derived data is mostly computed in render |
| 16 | Phase-tag future constants | false | A starter-code artifact, not a convention |
| 17 | Re-export shims when logic moves to a core library | weak | A documented gotcha, not a rule for new code |
| 18 | Shared `now()` helper for `created_at` | take | `server/src/db/schema/_shared.ts`, used by every table |
| 19 | Document design decisions in comments | weak | Good practice, not checkable |

**Result:** 11 worth a skill, 4 weak, 4 false out of 19.

**Missing** — rules `AGENTS.md` states that the extractor did not find:

- API JSON and DB columns are `snake_case`, TypeScript is `camelCase`;
- a Zod schema and its inferred type share one `PascalCase` name;
- layers go `routes.ts → service → repository`, a table has one writer;
- the web app imports only types from `@devdigest/shared`;
- a test that needs the database is `*.it.test.ts`;
- migrations are generated, never written by hand;
- no default export except route files.

Most of these live in configuration or in many files at once (naming across
the whole tree), which a 24-file sample cannot show; they are the case for
several evidence files per rule above.
