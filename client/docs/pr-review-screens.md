# PR review screens

How the two review screens are put together, where their data comes from, and
the UI patterns a change here is expected to follow. Paths are relative to
`src/app/repos/[repoId]/pulls/`.

## PR list — `page.tsx`

```
page.tsx                       thin entry, renders PullsView
└─ PullsView                   _components/PullsView    (?status, ?sort)
   ├─ FilterBar                _components/FilterBar
   └─ PullsList                _components/PullsList    loading / error / empty / rows
      └─ PRRow                 _components/PRRow
         ├─ CircularScore      score of the latest review
         ├─ FindingsPopover    _components/FindingsPopover   (FINDINGS column)
         │  └─ SeverityTally   _components/SeverityTally
         └─ RunCostBadge       _components/RunCostBadge
```

`constants.ts`, `helpers.ts` and `styles.ts` beside `page.tsx` hold what both
screens share: severity levels and their order, `countBySeverity`,
`visibleFindings`, `filterPulls`, cost and token formatting.

- Data: `usePulls(repoId)` → `GET /repos/:id/pulls`, one request for the whole
  list. It polls every 60 seconds, and every 4 seconds while any listed PR has
  `active_runs > 0` (`pullsRefetchInterval` in `src/lib/hooks/pulls.ts`).
- The list response carries counts, not findings. A row requests its findings
  (`usePrReviews`) the first time its findings list is opened.
- While a review runs, STATUS reads "Reviewing…" and the score and findings of
  the previous review are dimmed.

## PR detail — `[number]/page.tsx`, tab "Agent runs"

```
[number]/page.tsx              thin entry, renders PrDetailView
└─ PrDetailView                [number]/_components/PrDetailView   (?tab, ?trace)
   ├─ PrDetailHeader           title, Run Review, tabs
   ├─ OverviewTab · DiffTab
   ├─ FindingsTab              [number]/_components/FindingsTab
   │  ├─ RunStatus             live log of in-flight runs (SSE)
   │  ├─ RunHistory            Timeline: runs and commits, newest first
   │  │  ├─ RunRow             one run; FindingsPopover with its tally + list
   │  │  └─ CommitRow          one commit
   │  └─ ReviewRunAccordion    one per review, newest first
   │     ├─ VerdictBanner      verdict, summary, score, cost
   │     └─ FindingsPanel
   │        ├─ SeverityCounters   counters; a click filters this run's list
   │        └─ FindingCard        one per finding
   └─ RunTraceDrawer           opened by ?trace=<run id>
```

A tab reads its own data: `FindingsTab` calls the review hooks itself and takes
only the PR id, the in-flight run ids and callbacks as props. Two components
that call the same hook share one cache entry, so this costs no extra request.

Three queries feed the tab, all keyed by the PR's id:

| Hook | Endpoint | Holds |
|---|---|---|
| `usePrReviews` | `GET /pulls/:id/reviews` | Reviews, each with its `findings`. |
| `usePrRuns` | `GET /pulls/:id/runs` | Run metadata: status, cost, tokens, score. No findings. |
| `usePrActiveRuns` | `GET /pulls/:id/runs/active` | Runs still running; polled every 4 s while non-empty. |

A **review** and a **run** are different records joined by `run_id`. Props are
named after what they carry (`reviews`, `prRuns`); mixing the two names has
already misled a reviewer agent once.

Run history and reviews are refreshed whenever the set of in-flight runs
changes, so with several agents each one appears as it finishes. That upkeep is
`useLiveRuns` in `src/lib/hooks/reviews.ts`, called once by `PrDetailView`; query
keys are built by `reviewKeys` there and are not written out in components.

Everything the tab shows about findings — the counters, the filter, the
timeline tally — is derived on the client from `usePrReviews`. Filtering sends
no request.

## Patterns

- **Styles** are co-located style objects (`styles.ts`, or module-level
  `CSSProperties` constants) passed to `style=`. Not Tailwind utility classes.
- **Colours** come from the UI-kit tokens (`var(--crit)`, `var(--text-muted)`,
  …). Severity colour, icon and label come from `SEV` in `@devdigest/ui`.
- **Text** lives in `messages/en/prReview.json` and is read with
  `useTranslations("prReview")`.
- **Severity is never colour alone**: a counter or tally always carries the
  count and a text label, visible or as `aria-label`.
- **A toggle is a real button** with `aria-pressed`; a level that cannot be
  chosen is `disabled`, not hidden.
- **A collapsible header is a real button** with `aria-expanded`
  (`ReviewRunAccordion`, the file header in the diff). An action that sits in
  the same header (delete) is a second button beside it, never inside it.
- **A popover in the list is `position: fixed`**, placed from the trigger's
  `getBoundingClientRect()`. The table card clips anything absolute inside a
  row. A fixed popover closes when the page scrolls.
- **A control inside `PRRow` stops click propagation** on its own root; the row
  itself navigates on click.
- **A rule a hook needs** (for example a polling interval that depends on the
  data) is a pure function exported next to the hook and tested there.

## Specs

- `../specs/001-severity-counters.md` — the counters and the filter.
- `../../server/specs/001-run-cost-badge.md` — run cost.
- `../../server/specs/002-pr-list-review-state.md` — FINDINGS column,
  "Reviewing…", timeline tally and the findings list.
