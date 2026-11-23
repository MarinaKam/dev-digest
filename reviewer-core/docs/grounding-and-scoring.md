# Grounding and scoring

Why a review's findings and score can differ from what the model returned, and
what that means when you write or change a reviewer prompt.

## The model's answer is not the result

`reviewPullRequest` (`src/review/run.ts`) treats the model output as a draft.
Two deterministic steps run after it, in this order, for every strategy:

1. **Grounding** drops findings that do not point at the diff.
2. **Scoring** recomputes the score from the findings that are left.

The `Review` the caller gets is `{ ...merged, findings: kept, score:
scoreFromFindings(kept) }` (`src/review/run.ts:208`). The model's own `score`
is never returned.

## Grounding: a finding must cite the diff

`groundFindings` (`src/grounding.ts:52`) keeps a finding only when:

- its `file` is one of the files in the diff, and
- its `[start_line, end_line]` range intersects at least one new-side line of a
  hunk of that file.

Anything else is dropped and reported in `ReviewOutcome.dropped` with a reason
(`file '…' not present in diff`, or `lines A-B do not intersect any diff hunk`).
The run log and the grounding summary (`"3/4 passed"`) come from the same
result, so a dropped finding is visible, never silent.

One exception: findings whose `kind` is `secret_leak`, `lethal_trifecta`,
`phantom` or `hook` are full-file findings. They only need their file to be in
the diff (`src/grounding.ts:16`).

Why this exists: a model can describe a real-looking problem at a line that is
not part of the change, or in a file the PR does not touch. Without the gate
such a finding would be shown next to code it does not describe.

What it does **not** check: whether the finding is true. A finding that cites a
changed line and is wrong about it passes. Grounding is a location check, not a
correctness check.

## Scoring: computed from severities

`scoreFromFindings` (`src/review/reduce.ts:27`):

```
score = clamp(100 - (35 × CRITICAL + 12 × WARNING + 3 × SUGGESTION), 0, 100)
```

| Findings | Score |
|---|---|
| none | 100 |
| 1 WARNING | 88 |
| 2 WARNING | 76 |
| 1 CRITICAL | 65 |
| 2 CRITICAL + 1 WARNING | 18 |
| 3 CRITICAL | 0 |

Why not the model's number: it has no anchor and differs wildly between models
(a model can report no findings and still return a low score). Computing it
from severities means the number on screen cannot contradict the list under it.

Consequence: **severity inflation is the main way a reviewer distorts a
score.** One false CRITICAL costs 35 points. That is why the reviewer prompts in
`docs/agent-prompts/` spend so much text on when CRITICAL is allowed.

## One call or one call per file

`selectMode` (`src/review/run.ts:115`):

| `strategy` | What runs |
|---|---|
| `single-pass` | one call with the whole diff |
| `map-reduce` | one call per file, if the diff has more than one file; else one call |
| `auto` (default) | one call per file only when the diff is over 400 lines **and** has more than one file |

The per-file results are merged by `reduceReviews` (`src/review/reduce.ts`):
findings are concatenated and the worst verdict wins
(`request_changes` > `comment` > `approve`). The score of the merge is then
replaced by the recomputed one, as above. Grounding runs once, on the merged
list.

A structured-output failure is retried; the default budget is 2 retries
(`DEFAULT_REVIEW_MAX_RETRIES`).

## What this means for a prompt

- Ask for an exact file and line range that exists in the diff. A finding
  without one is dropped before anyone sees it.
- The engine cannot tell a guess from a fact. The prompt has to: the model sees
  only what the caller passed in (the diff, and the repo map or callers digest
  when the server sends them), not the types and files around the change.
- Do not ask the model for a score or tune it through the prompt. Change the
  severities it assigns.
