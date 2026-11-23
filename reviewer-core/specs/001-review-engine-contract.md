# 001 — Review engine contract

Milestone M1. `reviewer-core/` only. This spec was written after the code: it
records the contract the starter engine already has, so that a later change to
it starts from a written baseline.

## Why

The server, and later CI, call one function to review a pull request. What goes
in, what comes out and which rules always hold must not depend on reading
`run.ts`.

## Entry point

`reviewPullRequest(input: ReviewInput): Promise<ReviewOutcome>`, exported from
`src/index.ts`.

## Input

| Field | Required | Meaning |
|---|---|---|
| `systemPrompt` | yes | The agent's system prompt. Trusted. |
| `model` | yes | Model id for the injected provider. |
| `diff` | yes | The PR's parsed unified diff; hunks carry new-side line numbers. |
| `llm` | yes | The `LLMProvider` to call. The engine's only side effect. |
| `strategy` | no | `auto` (default), `single-pass` or `map-reduce`. |
| `prDescription` | no | PR body. Untrusted. |
| `repoMap` | no | Repo skeleton. Untrusted. |
| `callers` | no | Callers-of-changed-symbols digest. Untrusted. |
| `skills`, `memory`, `specs` | no | Prompt slots for later milestones. |
| `task` | no | Task framing line. |
| `maxRetries` | no | Structured-output retry budget (default 2). |
| `mapThresholdLines` | no | Line threshold for `auto` (default 400). |
| `sessionId` | no | Forwarded to the provider to group the calls of one review. |
| `onEvent` | no | Progress sink. |
| `checkCancelled` | no | Called before each model call; throws to abort. |

## Output

| Field | Meaning |
|---|---|
| `review` | `{ verdict, summary, score, findings }` after grounding. |
| `grounding` | Summary such as `"3/4 passed"`. |
| `dropped` | Findings removed by grounding, each with a reason. |
| `mode` | Which path ran: `single-pass` or `map-reduce`. |
| `assembly` | The assembled prompt, for the run trace. |
| `chunks` | One label per model call. |
| `tokensIn`, `tokensOut` | Token usage over all calls. |
| `costUsd` | Cost of the run, or `null` when it is unknown. `0` is a real cost. |
| `raw` | The raw model output(s), joined. |

## Rules

1. **No I/O.** The engine does not touch a database, GitHub, the filesystem or
   the environment. Everything arrives in `ReviewInput`.
2. **Untrusted content is fenced.** The diff, PR description, repo map, callers
   and specs are wrapped with `wrapUntrusted` and the injection-guard rule is
   appended to the system prompt on every run.
3. **An optional slot that is empty is left out** of the prompt. With only the
   required fields the prompt is the diff-only prompt.
4. **Every finding cites the diff** or is dropped (see
   `docs/grounding-and-scoring.md`).
5. **The score is computed from the surviving findings**: 100 minus 35 per
   CRITICAL, 12 per WARNING, 3 per SUGGESTION, clamped to 0..100. The model's
   own score is never returned.
6. **Severity has exactly three levels**: `CRITICAL`, `WARNING`, `SUGGESTION`
   (the `Severity` contract in `@devdigest/shared`).
7. **`auto` makes one model call** unless the diff is over the threshold and has
   more than one file; then it makes one call per file.
8. **A cancelled run throws** whatever `checkCancelled` throws; the engine does
   not define the error type.
9. **`costUsd` is `null`, never `0`, when the price is unknown.**

## Out of scope

Deciding which agents run, persisting anything, posting to GitHub, building the
repo map or the callers digest. Those belong to the caller.

## Known limits

- Grounding checks where a finding points, not whether it is true.
- The verdict comes from the model (worst verdict wins across per-file calls);
  only the score is recomputed.
