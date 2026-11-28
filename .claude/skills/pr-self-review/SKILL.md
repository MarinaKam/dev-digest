---
name: pr-self-review
description: "Use when changes are about to leave the machine: before git push, before opening or merging a pull request, when the user asks to self-review, pre-review or check the open changes or the branch before a PR, when asked 'can I open the PR' or 'is this ready to push', or when a push or pull-request command was blocked by the pr-self-review gate. Not for reviewing someone else's pull request, and not for writing the pull-request description."
metadata:
  version: "1.2.0"
---

# PR Self-Review

Reviews the open changes locally, with the project's own skills, before anyone
else sees them. **One critical finding blocks the push and the pull request.**

This skill holds no review rules. Every rule stays with the skill that owns it;
this one decides which skill reads which file, what counts as critical, and
whether the gate opens. It is a fixed procedure: follow the steps in order.

All commands below are relative to this skill's folder.

## Step 0: project conventions win

Read the project's instruction files (`AGENTS.md`, `CLAUDE.md`) for the package
of every changed file: they name the check commands and the written rules, and
where they disagree with a skill, they win. The project maps its folders to
reviewers in `.claude/pr-self-review.config.json`; if that file is missing, read
[routing.md](routing.md) for how to propose one.

## Step 1: scope

```bash
node scripts/gate.mjs scope                  # everything on disk: commits, staged, unstaged, untracked
node scripts/gate.mjs scope --target head    # committed changes only
```

Use `--target head` when the working tree holds changes that are not part of
this work (another session shares the folder). Otherwise use the default.

The output lists every changed file with its bucket, a `fingerprint` of the
exact content, and `mirrorDrift`. Keep the fingerprint for step 5.

- `empty: true`: nothing to review. Say so and stop.
- `docsOnly: true`: the gate opens without a review. Say so and stop.

## Step 2: cheap checks first

Run every check the project's instruction files name for this kind of change,
in every package that owns a changed file: type check, lint, architecture
check, unit tests, and the integration tests when the files say the change
needs them. Look in the root file and in the package's own. Record each as
`pass`, `fail` or `not_run`.

- A failed check is critical. **If any check fails, skip steps 3 and 4**: record
  the verdict with the failed checks, report, and stop. Reviewing code that does
  not build wastes the review.
- `not_run` is only for a check that cannot run here (for example it needs a
  service that is not available), with the reason. Never to save time. A review
  in which no check passed is recorded as `BLOCKED`.

## Step 3: review by bucket

Start one reviewer per non-empty bucket, in parallel, plus one security
reviewer for all source files. A bucket with no changed files gets no reviewer.
[routing.md](routing.md) lists the skills of each bucket, all of which the
reviewer loads, and gives the brief to hand it. Without subagents, do the same
passes yourself, one bucket at a time.

Reviewers judge **changed lines only** and return findings in the fixed format.
Severity comes from the closed catalogue in [gate.md](gate.md), not from the
reviewer's sense of importance and not from the owner skill's own tags.

## Step 4: try to refute every critical

Before a finding blocks, a fresh reviewer that did not produce it tries to
prove it wrong, using the checklist in [gate.md](gate.md). A critical that
fails the checklist becomes a warning. One false block teaches people to
bypass the gate. Without subagents, do it yourself as a separate pass after
all findings are collected, reading each critical against the checklist as if
someone else had written it.

## Step 5: record

Write the review as JSON (format in [gate.md](gate.md)) to a temporary file
outside the repository, then:

```bash
node scripts/gate.mjs record <review.json>
```

The script computes the verdict itself: any failed check, no passed check at
all, any mirrored copy out of sync, or any critical finding gives `BLOCKED`. It refuses the file when
the content changed since step 1; then start again from step 1.

## Step 6: report

The report is exactly this, in this order:

1. The line the script printed: `PR SELF-REVIEW: PASS (...)` or `BLOCKED (...)`.
2. **Critical**: a table of `file:line`, rule and owner skill, quoted evidence,
   fix. Failed checks go here with the failing output.
3. **Warnings**: the same table.
4. **Notes**: one line each.
5. **Suppressed**: every `pr-self-review-ignore` in the diff with its reason.
6. **Not covered**: checks not run, skills not installed, files in no bucket.

## When the verdict is BLOCKED

Do not push, do not open or merge the pull request, and do not give the user
the command to do it. Fix the critical findings, or hand them to the user, then
run the skill again from step 1: a verdict belongs to one exact content and a
fix changes it.

The gate has an escape hatch, described in [gate.md](gate.md). Using it is the
user's decision: never add it to a command on your own, and do not offer it as
the next step. Mention it only when the user asks how to get past the gate.

## Red flags

| Thought | What is true |
|---|---|
| "This one is not really critical here" | The catalogue decides. If the catalogue is wrong, tell the user; do not re-rank silently. |
| "The owner skill tags this CRITICAL, so it blocks" | Only the catalogue blocks. Owner tags differ from skill to skill. |
| "The tests are green, the review is a formality" | Checks are step 2 of 6. The review finds what checks cannot. |
| "I reviewed it a commit ago" | The verdict is bound to the content. New content needs a new review. |
| "The file already looked like that" | Then it is not a finding: changed lines only. |
| "I will record PASS and mention the issue in the text" | The gate reads the record, not the text. |

## Boundaries with other skills

- Every review rule belongs to its owner skill, listed in
  [routing.md](routing.md). This skill never restates one.
- The project's instruction files own the check commands and the written
  project rules.
- A change that passes this skill is not a reviewed pull request: it is a
  change that is ready to be reviewed by someone else.

`README.md` in this folder is for people (need, scope, evidence, changelog).
It adds no rules.
