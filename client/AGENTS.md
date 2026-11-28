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
- A shared module directly under `src/components/` is a `kebab-case` folder
  (`app-shell`, `diff-viewer`); the component folders inside it are
  `PascalCase`.
- Route-private components live in `_components/` next to their `page.tsx`.
- Hooks are `useThing`. Data hooks are grouped by domain in
  `src/lib/hooks/<domain>.ts`. A UI hook used by one component lives in that
  component's `hooks/` folder, one hook per file (`hooks/useThing.ts`).
- A props type is `<Name>Props`. A callback prop is `onThing`. A boolean prop
  is a bare adjective (`open`, `running`), without an `is` or `has` prefix.
- Message keys are `camelCase` inside a namespace file
  (`messages/en/prReview.json` → `panel.severityCount`).
- A prop is named after what it carries (`reviews`, `prRuns`), not after where
  it is shown.

## Architecture
- Next.js is the router and shell of a client-rendered app. The only Server
  Component is `src/app/layout.tsx` (locale, messages, providers); views are
  Client Components.
- All data comes from the Fastify API, in the browser. Do not add server-side
  data fetching, Server Actions or route handlers (`route.ts`); a new endpoint
  belongs in `../server/`.
- A new `page.tsx` is a thin route entry: it renders one view from
  `_components/<Name>View` and holds no state, effects or data hooks. Do not
  copy the older pages that still hold logic.
- Imports point one way: `app/` -> `components/` -> `lib/` and `vendor/`.
  Nothing outside `src/app` imports from it, and a route does not import
  another route's `_components/`. A component used by two routes moves to
  their nearest shared `_components/` or to `src/components/`.
- State that must survive a reload or be linkable (active tab, filter) lives
  in the URL query. Server state lives only in the TanStack Query cache.
- A view handles its own loading, error and empty states from the hook's
  flags, with `Skeleton`, `ErrorState` and `EmptyState`. There are no
  `loading.tsx` or `error.tsx` files; do not add them for one screen.
- Every screen renders inside `AppShell` and passes its breadcrumb as `crumb`.
- Where a skill disagrees with this file, this file wins. Example: the
  `next-best-practices` skill recommends server-first patterns; this section
  overrides them.

## Conventions
- All API calls go through `src/lib/api.ts`, wrapped in TanStack Query hooks in
  `src/lib/hooks/`. Components do not call `fetch` directly.
- Import UI components from `@devdigest/ui` (the barrel), never from a file
  inside `src/vendor/ui/`.
- User-facing text lives in `messages/en/*.json` (next-intl), not in components.

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
- Use the `frontend-architecture` skill before you add, move or split a file
  and are not sure where it belongs (component, hook, constant, helper, route
  folder).
