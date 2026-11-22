# 001 — Severity counters on a review run

Milestone M1. Web only (`client/`). No API, schema or shared-contract change.

## Why

On the PR page, tab "Agent runs", each review run expands into its own list of
finding cards. To learn how many of them are critical the user has to read the
whole list. A row of counters per severity shows the split at once, and a click
on a level narrows the list to that level.

## Where it is shown

| Screen | Place | Shows |
|---|---|---|
| PR detail, Review runs | body of an expanded run, left side of the toolbar above the finding cards, on the line of "Hide low confidence" | `1 CRITICAL` `3 WARNING` `1 SUGGESTION` |

## Rules

1. **Three levels, always.** `CRITICAL`, `WARNING`, `SUGGESTION` are shown in
   this order for every run that has findings, each as `<count> <LEVEL>`.
2. **A level without findings shows `0`.** Its counter is muted and disabled:
   it cannot be clicked.
3. **A run without findings shows no counters.** The existing empty state is
   shown as before.
4. **Counts belong to the run.** They are taken over all findings of the run
   and do not change with "Hide low confidence" or with the active filter, so
   they always add up to "N findings" in the run header.
5. **A click filters the list** of this run to the clicked level. The active
   counter is filled with the severity colour and the other levels are faded.
   The highlight does not depend on hover and stays for as long as the filter
   is on.
6. **One level at a time.** A click on another level moves the filter to it.
7. **A click on the active level clears the filter** and restores the full list.
8. **The filter combines with "Hide low confidence".** A card is shown only if
   it passes both. When nothing passes, the existing "No findings match" empty
   state is shown.
9. **The filter is local to one run** and is not kept in the URL. Other runs on
   the page are not affected; reloading the page clears it.
10. **A filter whose level has no findings is ignored.** If the data changes so
    that the active level drops to zero, the full list is shown.
11. **Changing the filter moves keyboard focus to the first card** (j/k
    navigation starts from the top of the new list).
12. **Nothing is requested.** Counting and filtering use the findings already
    loaded for the page; a click sends no request and starts no run.
13. **Accept and dismiss do not change the counts.** An accepted or dismissed
    finding stays in the list, so it stays in its level's count.
14. **Colours and level names come from `SEV`** (`@devdigest/ui`); the label
    template is `panel.severityCount` in `messages/en/prReview.json`.

## Accessibility

Each counter is a `<button type="button">` with `aria-pressed`. The level is
always written as text; colour is never the only signal.

## Out of scope

The run header (`N findings · N blockers`), the Timeline rows, the FINDINGS
column of the PR list, multi-select of levels, a filter shared across runs, a
URL parameter for the filter.

## Known limits

- With "Hide low confidence" on, a counter can be larger than the number of
  cards shown for that level (rule 4).
- The label of the active counter uses the page background colour, not white:
  white on the dark-theme severity colours is below the 4.5:1 contrast of
  WCAG AA. In the light theme the active WARNING counter is still at 3.19:1,
  because the `--warn` token itself is too light against white; fixing it
  means changing a design token.
- The reference screenshot of the task hides a level that has no findings. The
  acceptance criteria ask for three visible levels and for `0` on an empty one;
  this spec follows the criteria (rule 2).
