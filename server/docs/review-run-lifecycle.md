# Review run lifecycle

What happens between "Run Review" and a finished run, where each piece of state
lives, and what the PR list derives from it.

## From request to result

1. **`POST /pulls/:id/review`** with `{ agentId }` or `{ all: true }`
   (`src/modules/reviews/routes.ts`). `ReviewService.runReview` resolves the
   agents and creates one `agent_runs` row per agent with status `running`
   (`src/modules/reviews/service.ts:103`). The response returns the run ids at
   once; the work continues in the background of the same process.
2. **Shared pre-work, once per request.** `RunExecutor.executeRuns`
   (`src/modules/reviews/run-executor.ts:55`) loads the PR diff. If that fails,
   every queued run is marked `failed` with the same error.
3. **Agents run one after another**, not in parallel (the `for` loop in
   `executeRuns`). All their rows are `running` from step 1, so three agents
   read as "3 running" and finish one by one.
4. **Per agent** (`runOneAgent`): build the optional context (callers digest,
   repo map), call `reviewPullRequest` from `reviewer-core`, then in order:
   insert the `reviews` row and its `findings`; record the reviewed commit on
   the PR (`markReviewed(pull.id, pull.headSha)`); complete the `agent_runs`
   row (`done`, duration, tokens, cost, findings count, score, blockers); save
   one `run_traces` document; close the run's event stream.
5. **Failure or cancel** of one agent persists that run's status, error text
   and the log so far, and the loop goes on to the next agent.

## Where state lives

| State | Where | Survives a restart |
|---|---|---|
| Run status, cost, tokens, score, blockers | `agent_runs` | yes |
| Review verdict, summary, score | `reviews` | yes |
| Findings | `findings` (by `review_id`) | yes |
| Prompt, raw output, full log | `run_traces` (one JSON document per run) | yes |
| Live progress events | in-memory run bus, streamed by `GET /runs/:id/events` (SSE) | no |
| Cancellation flag | in-memory run bus | no |

Because the bus is in memory and the work runs in the API process, the design
assumes a single API instance.

A run that was `running` when the process died would stay `running` forever.
On boot, before the server accepts requests, `reapStaleRuns` marks every such
row as failed (`src/app.ts:81`).

## What "running" means to the clients

- `GET /pulls/:id/runs/active` — the `running` rows of one PR. The PR page
  polls it every 4 seconds while it is non-empty.
- `GET /repos/:id/pulls` — `active_runs` per PR, for the list
  (`specs/002-pr-list-review-state.md`).

## What the PR list derives

All computed on read in `GET /repos/:id/pulls`
(`src/modules/pulls/routes.ts`), each with one grouped query over the listed PR
ids — never one query per PR.

| Field | Rule |
|---|---|
| `status` | For an open PR: `needs_review` when it was never reviewed or its head moved since the last review; `stale` when the reviewed head is older than 7 days; else `reviewed`. Merged and closed PRs keep their GitHub state (`src/modules/pulls/status.ts`). |
| `score` | Score of the single latest review of the PR. |
| `findings_by_severity` | Findings of each agent's latest review, added up. `null` when the PR has no review. |
| `cost_usd` | Sum over the PR's `done` runs that have a cost. `null` when there is none; `0` is a real cost. |
| `active_runs` | Number of the PR's `running` runs. |

`status` follows from the reviewed commit, so pushing a commit to a reviewed PR
turns it back to `needs_review` until it is reviewed again.

`score` and `findings_by_severity` use different rules and can disagree when
several agents reviewed the PR (listed as a known limit in spec 002).

## Cost

`reviewPullRequest` returns the run's cost. For OpenRouter it is the charge
reported in the response; otherwise tokens × price from the price book, or
`null` when the model is not in it. A failed or cancelled run stores no cost,
even if the model had already answered (`specs/001-run-cost-badge.md`).
