# 001 — Run cost badge

Milestone M1. Spans `server/` (API, schema) and `client/` (web app).

## Why

A reviewer run spends money, and nothing in the product says how much. The
user must see the cost of each completed run, and what a pull request has cost
so far, without leaving the review screens.

Per-run cost existed before and was removed end-to-end in `d45ab0d`. The
computation survived in `reviewer-core` (`runReview` still returns `costUsd`);
this feature persists it again and surfaces it. It makes no extra model calls.

## Where the cost is shown

| Screen | Place | Shows |
|---|---|---|
| PR list | COST column, between STATUS and UPDATED | sum for the PR, e.g. `$0.014` |
| PR detail, Timeline | run row, under the time | `$0.014 · 8.2K→1.3K` |
| PR detail, Review runs | bottom line of the verdict banner | `$0.014 · 8.2K→1.3K` |
| Run drawer, Stats | COST tile between TOKENS and FINDINGS | `$0.014` |

## Rules

1. **Cost belongs to the run, not to the PR status.** A Stale PR that has
   completed runs shows its real cost.
2. **"—" means no cost data.** It is shown when there is no completed run with
   cost data: the run is still running, it failed or was cancelled, the model's
   price is unknown, or the run predates this feature. Old runs are not
   backfilled.
3. **`null` and `0` are different.** A free model costs `0` and renders
   `$0.00`. Unknown is `null` and renders "—". `$0.00` is never used for
   "unknown".
4. **PR list column is a sum**: `cost_usd` over all completed runs of the PR.
   Runs without cost data are skipped. No completed run with cost data → `null`.
5. **The cost appears only when the run completes.** While a run is running
   every place shows "—".
6. **One formatter everywhere** (`formatCost`).

## Format

At least 3 significant digits; at least 3 decimals below $1.

| Input | Output |
|---|---|
| `null` / `undefined` | `—` |
| `0` | `$0.00` |
| `0.0004` | `$0.0004` |
| `0.000412` | `$0.000412` |
| `0.014` | `$0.014` |
| `0.01234` | `$0.0123` |
| `0.06` | `$0.060` |
| `1.5` | `$1.50` |
| `12.345` | `$12.35` |

Rule: `>= 1` → 2 decimals. `< 1` → round to 3 significant digits, drop trailing
zeros, keep at least 3 decimals.

Tokens next to the cost: `in→out` in thousands with one decimal, `8.2K→1.3K`.

## Where the number comes from

`runReview` returns `costUsd` for the whole run. For OpenRouter it is the real
cost from the response (`usage.cost`); otherwise it is tokens × price from the
price book, or `null` when the model is not in it. The run executor stores it
on the run when the run completes and writes one line to the run log:
`usage: in=<n> out=<n> cost=<$usd|unknown>`.

## API changes

- `agent_runs.cost_usd` — `double precision`, nullable (new migration).
- `RunSummary.cost_usd: number | null` — `GET /pulls/:id/runs`.
- `RunStats.cost_usd: number | null` — `GET /runs/:id/trace`. Traces stored
  before this feature have no such key; it is read as `null`.
- `PrMeta.cost_usd?: number | null` — `GET /repos/:id/pulls` only.

## Out of scope

The FINDINGS column and Run Review button of the list mockup, a cost badge in
the Review-runs accordion header, the "this review cost" line of the Post
review dialog, cost totals or analytics, backfill of old runs, eval and CI cost.

## Known limits

- A run that fails after the model already answered stores no cost.
- For providers other than OpenRouter the cost is an estimate from a static
  price table.
