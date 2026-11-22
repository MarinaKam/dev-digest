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

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-21** — Every place that shows a run's price must take it from `completedRunCost(run)` and print it with `formatCost`. The first returns a cost only for `status === "done"` (a running, failed or cancelled run shows "—" even if a number is present); the second renders `null` as "—" and `0` as "$0.00". Do not format a cost with `toFixed` in a component: real runs cost about $0.00005, which a fixed 2–3 decimals turns into "$0.00". Evidence: `client/src/app/repos/[repoId]/pulls/helpers.ts:46`.
- **2026-11-21** — Styling here is co-located style objects (`styles.ts` or module-level `CSSProperties` constants) passed to `style=`. The `react-best-practices` skill says "Tailwind utilities, no inline `style={}`"; that rule does not match this codebase, so follow the neighbouring files. Evidence: `client/src/app/repos/[repoId]/pulls/styles.ts:5`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
- **2026-11-21** — The same run shows its tokens in two formats: `3.1K→0.4K` next to the cost (Timeline, verdict banner) and `3k→0.4k` in the drawer's TOKENS tile, which uses the older `formatTokens`. Unify them, or keep the tile as is? Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/helpers.ts:26`.
