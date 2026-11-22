# client — `@devdigest/web`

Next.js web app. Talks to the API on `:3001`; has no backend logic of its own.

## Commands
- `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`

## Verify a change
- `pnpm typecheck`, `pnpm lint` and `pnpm test`, all green, after every change.
  `pnpm lint` passing with warnings is fine; a new error is not.
- Then look at the change in the running app (`:3000`). Reload the tab first:
  a tab opened before the change can keep showing the old code.
- A change to `src/vendor/shared` is made in `../server/src/vendor/shared`
  first; run `pnpm typecheck` in `../server/` too.

## Naming
- A component is a folder: `Name/Name.tsx`, `Name.test.tsx`, `index.ts`, and,
  when needed, `styles.ts`, `helpers.ts`, `constants.ts`. `PascalCase` for the
  component and its folder.
- Route-private components live in `_components/` next to their `page.tsx`.
- Hooks are `useThing`, grouped by domain in `src/lib/hooks/<domain>.ts`.
- Message keys are `camelCase` inside a namespace file
  (`messages/en/prReview.json` → `panel.severityCount`).
- A prop is named after what it carries (`reviews`, `prRuns`), not after where
  it is shown.

## Conventions
- All API calls go through `src/lib/api.ts`, wrapped in TanStack Query hooks in
  `src/lib/hooks/`. Components do not call `fetch` directly.
- Import UI components from `@devdigest/ui` (the barrel), never from a file
  inside `src/vendor/ui/`.
- User-facing text lives in `messages/en/*.json` (next-intl), not in components.
- Route-private components sit in `_components/` next to their `page.tsx`.

## Gotchas
- `src/vendor/shared` is a copy of `server/src/vendor/shared`. Change the server
  copy first, then mirror it here. Never edit this copy alone.
- Some hooks call endpoints the starter server does not have yet. Check
  `../server/README.md` before you rely on a hook.

## Do not touch
- `pnpm-lock.yaml`. It changes only through an install the user runs.
- `src/vendor/shared` on its own (see Gotchas).

## Read when
- Read `README.md` when you add or move a page (it holds the UI route map).
- Read `src/vendor/ui/README.md` when you add, change or theme a UI component.
- Read `docs/` when you need the reasoning behind a screen or a UI pattern.
- Read `specs/` before you implement or change a feature. A feature that also
  changes the API is specified in `../server/specs/`.
- Read `INSIGHTS.md` before you start any work here. Append a dated entry when you learn
  something the code does not show. Never rewrite entries.
- Read `../TESTING.md` before you add or move a test.
