# client — insights

Things learned while working in `client/` that the code does not show.

Append-only: add a new entry at the bottom of its section, never rewrite or
delete an old one. If an entry turns out to be wrong, add a new entry that says so.

Entry format, one line per entry:

```
- **YYYY-MM-DD** — <concrete, actionable insight>. Evidence: `path/file.ts:NN`.
```

Write an entry only if a reader can act on it without re-investigating, and
only if it is not obvious from reading the code.

## What Works
<!-- Approaches and solutions that proved effective here. -->

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->

- **2026-11-21** — A `vi.mock` factory that returns `{ mutate: vi.fn() }` builds a new spy on every render, so a test can never assert on it. To check which finding an action was sent for, create the spy with `vi.hoisted(() => vi.fn())` above the mock and return that same spy. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.test.tsx:7`.
- **2026-11-27** — An effect that reports "finished" through a callback prop must clear its own "was running" ref before it calls the callback. `RunStatus` did not, and its `onDone` prop was a new function on every parent render, so each re-render after the stream closed called `onDone` again (three calls in the test where one was expected). Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunStatus/RunStatus.tsx:31`.
- **2026-11-27** — A `// biome-ignore lint/correctness/useExhaustiveDependencies` placed on the dependency-array line does nothing: Biome reports the rule on the line of the hook call, so the comment goes directly above `React.useEffect(`. An `eslint-disable` comment does nothing at all here; ESLint is not installed. Evidence: `client/src/lib/hooks/reviews.ts:229`.

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-21** — Every place that shows a run's price must take it from `completedRunCost(run)` and print it with `formatCost`. The first returns a cost only for `status === "done"` (a running, failed or cancelled run shows "—" even if a number is present); the second renders `null` as "—" and `0` as "$0.00". Do not format a cost with `toFixed` in a component: real runs cost about $0.00005, which a fixed 2–3 decimals turns into "$0.00". Evidence: `client/src/app/repos/[repoId]/pulls/helpers.ts:46`.
- **2026-11-21** — Styling here is co-located style objects (`styles.ts` or module-level `CSSProperties` constants) passed to `style=`. The `react-best-practices` skill says "Tailwind utilities, no inline `style={}`"; that rule does not match this codebase, so follow the neighbouring files. Evidence: `client/src/app/repos/[repoId]/pulls/styles.ts:5`.
- **2026-11-21** — Do not put white text on a surface filled with a severity colour. Against `#fff` the dark-theme tokens give 2.15:1 (`--warn`), 3.76:1 (`--crit`) and 3.68:1 (`--sugg`), all below WCAG AA 4.5:1. Use `var(--bg-primary)` for the text: it is near-black in the dark theme and white in the light one, where `--crit` and `--sugg` pass. Light-theme `--warn` stays at 3.19:1 with either colour; that is a token problem. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/SeverityCounters/styles.ts:6`.
- **2026-11-21** — A filter kept in `useState` whose control can become disabled must be cleared when that happens, not only ignored. Deriving "effective filter = selected, if its count > 0" hides the stuck filter, but the stale `selected` comes back by itself when a refetch gives the level findings again. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:40`.

- **2026-11-21** — A hook in `src/lib/hooks/` that needs a rule (for example a polling interval that depends on the data) exports the rule as a pure function next to the hook and tests it there (`core.test.ts`). Do not import helpers from `src/app/...` into `src/lib/`: the dependency points the wrong way. Evidence: `client/src/lib/hooks/core.ts:108`.

- **2026-11-21** — Supersedes the 2026-11-21 entry on white text over a severity fill: the severity counters no longer use a solid fill. The active counter is the severity colour as text and border on the `--*-bg` tint, like `SeverityBadge`; inactive counters are neutral grey. The contrast figures in that entry still hold for any future solid fill. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/SeverityCounters/styles.ts:39`.
- **2026-11-21** — A hover popover whose panel is offset with `margin` closes while the pointer crosses the gap. Put the gap inside the hover area: an absolutely positioned wrapper flush under the trigger with `paddingTop`, and the panel inside it. Pin on click for content with links. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunFindingsPopover/styles.ts:16`.

- **2026-11-21** — A popover inside the PR list must be `position: fixed` with coordinates taken from the trigger's `getBoundingClientRect()`: the table card has `overflow: hidden` for its rounded corners and clips anything positioned `absolute` inside a row. A fixed popover must then close on page scroll, or it drifts away from its trigger. Evidence: `client/src/app/repos/[repoId]/pulls/styles.ts:90`.
- **2026-11-21** — A control placed inside a `PRRow` must stop click propagation on its own root: the whole row has an `onClick` that navigates to the PR. Evidence: `client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/FindingsPopover.tsx:122`.

- **2026-11-21** — Name a prop after the type it carries. `FindingsTab` took the PR's reviews as `runs` next to `prRuns` (run metadata); the General Reviewer read `runs` as `RunSummary[]` and reported a CRITICAL "field `findings` does not exist" on code that type-checks and works. Renamed to `reviews`, with a doc comment on both props. A reviewer model sees only the diff, so a misleading name costs a false blocker. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:18`.
- **2026-11-21** — Supersedes the 2026-11-21 entry on clearing a stale filter: the reset now lives in a `useEffect` keyed on "the selected level is empty", and the effective filter is still derived during render. Calling `setState` in the render body worked but two reviewer agents flagged it on PR #6. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:42`.
- **2026-11-27** — Supersedes part of the 2026-11-21 entry on styling: the `react-best-practices` skill no longer says "no inline `style={}`"; that line and its rules for Axios, `useApiQuery`, Vite `manualChunks`, `utils/` and `components/ui/` were removed because this client has none of them. The styling convention itself is unchanged. `react-error-boundary` and React Router still appear in that skill and are not installed here. Evidence: `.claude/skills/react-best-practices/SKILL.md:114`.
- **2026-11-27** — Folder case is deliberate, not drift: a shared module directly under `src/components/` is kebab-case (`app-shell`, `diff-viewer`) and the component folders inside it and in `_components/` are PascalCase. UI hooks for one component live in its own `hooks/` folder; only data hooks go to `src/lib/hooks/`. `AGENTS.md` said otherwise until this date. Evidence: `client/src/components/app-shell/hooks/useGlobalShortcuts.ts:1`.
- **2026-11-27** — Supersedes the path in the entry above: the hook now lives at `src/components/app-shell/AppShell/hooks/useGlobalShortcuts.ts`. Since this date every shared module holds PascalCase component folders, also a module with one component, and no component has a default export. Evidence: `client/src/components/app-shell/AppShell/AppShell.tsx:1`.
- **2026-11-27** — Query keys are built only by the key factory in the domain's hook file (`reviewKeys`, `pullKeys`, `agentKeys`). The PR page used to repeat `["pr-runs", prId]` as a literal in four places; a renamed key would have broken its invalidation without a type error. Cache upkeep that follows the in-flight runs is `useLiveRuns`, called once by the view. Evidence: `client/src/lib/hooks/reviews.ts:21`.
- **2026-11-27** — A tab or view calls the data hooks it needs itself instead of taking the data as props. `FindingsTab` went from thirteen props (with a `UseMutationResult<any, …>` among them) to seven; two components calling `usePrReviews(prId)` share one cache entry and one request. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:43`.
- **2026-11-27** — A form that edits a server record keeps one state object and is reset by `key={record.id}` on the form component, not by an effect that copies props into state. The key resets on another record and keeps unsaved edits when the same record is refetched; both cases are tested. Evidence: `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.tsx:29`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->

- **2026-11-22** — Biome 2.6.8 is the linter (`pnpm lint`); one `biome.json` at the repo root serves all four packages, each run from its own folder finds it. Things that cost time: (1) the `recommended: true` rule switch is deprecated in favour of `"preset": "recommended"`; (2) file arguments containing `[repoId]` are read as globs and match nothing — lint a directory instead; (3) `role="presentation"` does not satisfy `noStaticElementInteractions`, a wrapper with hover handlers needs a `biome-ignore` with a reason; (4) Tailwind 4 directives in `styles.css` need `css.parser.tailwindDirectives`. Evidence: `biome.json:1`.
- **2026-11-22** — Starter code fails ~100 recommended rules (mostly a11y in `src/vendor/ui`). They are downgraded to warnings for a fixed list of starter paths in `biome.json` `overrides`; any file outside that list is checked at full strength. Add nothing to the list; fix or suppress one line with a reason. Evidence: `biome.json:33`.
- **2026-11-27** — The lint baseline in `biome.json` matches by path, so moving logic out of a listed file makes the moved code be checked at full strength: `pulls/page.tsx` was listed, `PullsView` is not. Six client entries were dropped on this date; `agents/**`, `RunTraceDrawer/**`, `FindingCard.tsx` and `PRRow.tsx` remain, for clickable `div`s and index keys that still need a rewrite. Evidence: `biome.json:36`.

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->
### 2026-11-21
- Added severity counters to a review run (`client/specs/001-severity-counters.md`): counted and filtered in `FindingsPanel` from the findings `usePrReviews` already loaded; no API change.
- Decided that all three levels are always shown and a level without findings is a disabled `0` counter. The task's reference screenshot hides the empty level; its acceptance criteria ask for three levels and for `0`, and the criteria won.
- Decided that counts cover the whole run and ignore "Hide low confidence", so they add up to "N findings" in the run header.
- A browser tab opened before the change kept showing the old panel until a reload; `next dev` did not hot-swap it. Reload before judging that a UI change "is not there".
- Added, outside the homework scope and on the repo owner's request, the FINDINGS column and the "Reviewing…" state on the PR list and the severity tally on the run timeline (`server/specs/002-pr-list-review-state.md`). The course mockups show these as existing; the starter fork did not have them.
### 2026-11-27
- Added the `frontend-architecture` skill (where code lives; portable, no project paths) and linked it from `AGENTS.md`. Project rules rank above it.
- Measured before writing it: with the rules in `AGENTS.md` and the neighbouring folders, a fresh agent placed a shared formatter, a new filter bar and the pieces of `RunHistory` correctly without any skill. Fixing a wrong rule in `AGENTS.md` changes agent behaviour more than adding a skill does; check the rules against the tree first.
- Local event handlers are named both `handleX` (8) and `onX` (4) in `src/app` and `src/components`; no rule was written for them. Callback props are always `onX`, props types always `<Name>Props`, boolean props bare adjectives.
- Refactored the client to its own written rules (branch `refactor/client-structure`): every `page.tsx` is a thin entry; data hooks are split by domain with key factories; shared components sit in component folders; the app has one root `error.tsx`, `global-error.tsx` and `not-found.tsx`.
- Decided against moving the `<Suspense>` in `layout.tsx` down to the views: without `pnpm build` there is no way to see a missing boundary around `useSearchParams`, and a build writes into the `.next` folder the running dev server uses.
- The PR list sort order moved from `useState` to the URL (`?sort`), next to `?status`. The text filter stayed local: it is typed, not linked to.
- Correction from the repo owner during this session: lab work is done on one branch, and every agent working on the lab commits there. Do not cut a new branch for each task while the previous one is not merged. This session cut `refactor/client-structure` off the unmerged `feat/frontend-architecture-skill` (PR #12) for the refactor; that was the extra branch. A second agent then committed its own work (`c8691af`, the onion-architecture skill) onto the same branch from the same folder, which is what the owner intends for the lab, not a mistake to undo.
- Consequence for an agent here: before the first commit, ask which branch the lab is on instead of cutting one; expect commits by other agents on it; stage your own files by path (`git add <paths>`, never `git add -A`), because the working folder is shared.
- Audited `src/` against `frontend-architecture`, `react-best-practices` and `next-best-practices` (read-only, no code changed). Clean: no `fetch` outside `lib/api.ts`, no import from `src/app` into `components/` or `lib/`, no sibling-route import, no render factories. Not clean: four `page.tsx` files still hold state and data hooks (`/`, `pulls`, `pulls/[number]`, `agents/[id]`); 45 imports climb three or more `../` against 21 that use `@/`; `React.memo` is used nowhere, so a `useCallback` whose result is only passed to a child does nothing.

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
- **2026-11-21** — The same run shows its tokens in two formats: `3.1K→0.4K` next to the cost (Timeline, verdict banner) and `3k→0.4k` in the drawer's TOKENS tile, which uses the older `formatTokens`. Unify them, or keep the tile as is? Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/helpers.ts:26`.
- **2026-11-21** — Every expanded `FindingsPanel` registers its own `keydown` handler on `window`, so with two runs expanded `j`/`k` move the focus in both and `a`/`d` accept or dismiss a finding in each. Scope the shortcuts to one run, or keep them page-wide? Also, `j` on an empty list sets `focusIdx` to -1. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:64`.
- **2026-11-27** — `RunStatus` never resets `wasRunning` after it calls `onDone`, and `onDone` arrives as a new inline function on every render of the PR page. Read from the code, not reproduced: while the component stays mounted after a run ends, each re-render would call `onDone` again (three invalidations each). Does it fire more than once in practice? Count the `/runs/active` requests after a run settles before changing it. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunStatus/RunStatus.tsx:23`.
- **2026-11-27** — Answers the entry above: yes, it fired on every re-render; reproduced in `RunStatus.test.tsx` and fixed the same day.
- **2026-11-27** — `window.confirm` still guards four deletions (run, review, agent, repo). The text is translated now, but the dialog is the browser's own; the UI kit has `Modal` and no confirm dialog. Build one in `src/vendor/ui`, or keep the native one? Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:61`.
- **2026-11-27** — `src/lib/toast.tsx` keeps inline styles and the hardcoded `aria-label="Dismiss"`. Moving the label to messages makes `ToastProvider` need the `common` namespace in every test that renders it. Worth it? Evidence: `client/src/lib/toast.tsx:122`.
