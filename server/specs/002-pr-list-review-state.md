# 002 — Review state on the PR list and the run timeline

Milestone M1. Spans `server/` (list endpoint, shared contract) and `client/`
(PR list, run timeline). Not part of the severity-counters homework
(`client/specs/001-severity-counters.md`); built next to it.

## Why

After starting a review the user goes back to the PR list and cannot tell
whether anything is running. And to learn what a review found, the PR has to be
opened: neither the list nor the run timeline says how many findings of which
severity there are.

## Where it is shown

| Screen | Place | Shows |
|---|---|---|
| PR list | STATUS column | `Reviewing…` with a spinner while a review runs, instead of the review status |
| PR list | new FINDINGS column, between SCORE and STATUS | an icon and a count per severity, e.g. `⊘ 2  ⚠ 1`; hover or click lists the PR's current findings |
| PR detail, Timeline | second line of a settled run | the same icon-and-count tally, then ` · N blockers`; hover or click lists the run's findings |

## Rules

1. **"Reviewing…" means a run is running now.** It is shown while the PR has at
   least one run with status `running`. One run reads `Reviewing…`; several
   read `Reviewing · N agents`.
2. **It replaces the status only while it lasts.** When the last run ends the
   row shows the review status, score, findings and cost again.
3. **The list updates itself.** While any listed PR is being reviewed the list
   is re-read every 4 seconds; otherwise every 60 seconds as before.
4. **No progress percentage.** A review is one model call; the server does not
   know how much is left, so the indicator is indeterminate.
5. **FINDINGS on the list are the PR's current findings**: per severity, summed
   over the latest review of each agent. An older review by the same agent is
   superseded and not counted.
6. **"—" means never reviewed; `0` means reviewed, nothing found.** They are
   never merged.
7. **Only levels that have findings are drawn** in a tally, most severe first.
8. **The timeline tally is the run's own findings**, counted from the review
   loaded for the page. A run whose review is not loaded (for example, the
   review was deleted) keeps the plain `N finding(s)` text.
9. **Colours, icons and level names come from `SEV`.** Each count carries a
   text label (`2 Critical`) for assistive technology.
10. **A tally opens its findings**, on the timeline (the run's findings) and
    on the PR list (the PR's current findings, rule 5). Hovering it previews the
    list ("N findings in this run": severity, title, category, file:line,
    confidence, the start of the rationale, most severe first) and the pointer
    can move into the list. A click pins it open; Escape, a second click or a
    click outside closes it. Scrolling the page closes it, pinned or not;
    scrolling inside the list does not.
11. **The list is navigable, not actionable.** A finding's file opens on GitHub
    at the reviewed commit. Its title jumps to the run's findings below (on the
    timeline) or opens the PR's Agent runs tab (on the PR list). Accept and
    dismiss stay in the run's panel.
12. **On the PR list a click on the tally never opens the PR.** Only a finding's
    title does; the rest of the row still opens the PR as before.
13. **The PR list loads findings on demand.** The list endpoint returns counts
    only; a row's findings are requested (`GET /pulls/:id/reviews`) the first
    time its list is opened, and "Loading findings…" is shown meanwhile.

## API changes

`GET /repos/:id/pulls` only; both fields are optional in `PrMeta`:

- `active_runs: number` — runs of the PR with status `running`. `0` when none.
- `findings_by_severity: { CRITICAL, WARNING, SUGGESTION } | null` — rule 5;
  `null` when the PR has no review.

No schema change, no migration.

## Out of scope

A progress percentage, a live push channel for the list (it
polls), a FINDINGS filter or sort on the list.

## Known limits

- SCORE on the list is still the score of the single latest review, while
  FINDINGS adds up every agent's latest review. With several agents the two can
  disagree (score 100 next to critical findings from another agent).
- A run left `running` by a crashed server shows "Reviewing…" until the server
  starts again; orphaned runs are reaped on boot.
- The list notices a review started elsewhere only at its next poll (up to 60 s).
