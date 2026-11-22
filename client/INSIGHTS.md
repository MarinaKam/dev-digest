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

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-21** — Every place that shows a run's price must take it from `completedRunCost(run)` and print it with `formatCost`. The first returns a cost only for `status === "done"` (a running, failed or cancelled run shows "—" even if a number is present); the second renders `null` as "—" and `0` as "$0.00". Do not format a cost with `toFixed` in a component: real runs cost about $0.00005, which a fixed 2–3 decimals turns into "$0.00". Evidence: `client/src/app/repos/[repoId]/pulls/helpers.ts:46`.
- **2026-11-21** — Styling here is co-located style objects (`styles.ts` or module-level `CSSProperties` constants) passed to `style=`. The `react-best-practices` skill says "Tailwind utilities, no inline `style={}`"; that rule does not match this codebase, so follow the neighbouring files. Evidence: `client/src/app/repos/[repoId]/pulls/styles.ts:5`.
- **2026-11-21** — Do not put white text on a surface filled with a severity colour. Against `#fff` the dark-theme tokens give 2.15:1 (`--warn`), 3.76:1 (`--crit`) and 3.68:1 (`--sugg`), all below WCAG AA 4.5:1. Use `var(--bg-primary)` for the text: it is near-black in the dark theme and white in the light one, where `--crit` and `--sugg` pass. Light-theme `--warn` stays at 3.19:1 with either colour; that is a token problem. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/SeverityCounters/styles.ts:6`.
- **2026-11-21** — A filter kept in `useState` whose control can become disabled must be cleared when that happens, not only ignored. Deriving "effective filter = selected, if its count > 0" hides the stuck filter, but the stale `selected` comes back by itself when a refetch gives the level findings again. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:40`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
- **2026-11-21** — The same run shows its tokens in two formats: `3.1K→0.4K` next to the cost (Timeline, verdict banner) and `3k→0.4k` in the drawer's TOKENS tile, which uses the older `formatTokens`. Unify them, or keep the tile as is? Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/helpers.ts:26`.
- **2026-11-21** — Every expanded `FindingsPanel` registers its own `keydown` handler on `window`, so with two runs expanded `j`/`k` move the focus in both and `a`/`d` accept or dismiss a finding in each. Scope the shortcuts to one run, or keep them page-wide? Also, `j` on an empty list sets `focusIdx` to -1. Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:64`.
