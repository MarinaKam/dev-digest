# Demo: L02 homework — Conventions Extractor

Scenario for the `demo-video` skill, branch `feat/l02-homework`. The homework
asks for one video of 1–3 minutes that follows "How to check" of the task; it
goes first under "Screenshots / Demo" in the pull request. Lines that start
with `Caption:` appear on screen. Files go to `demo/feat-l02-homework/`
(git-ignored).

Setup: stack running (`./scripts/dev.sh`), migration 0012 applied
(`cd server && pnpm db:migrate`), 1440x900, dark theme. The active repo in the
sidebar is a cloned repo (`MarinaKam/dev-digest`). Spec:
`server/specs/004-conventions-extractor.md`.

---

## Video 1 — Conventions → skill → review with the skill

**Status:** ❌ failed 2026-11-28 — step 7: agent-browser wait used the flow timeout (20 s) instead of the step timeout; flow timeout raised to 240 s

**Preconditions:** no scan of the active repo yet (the empty state shows);
the model of the `conventions` feature is the default
(`openrouter` / `deepseek/deepseek-v4-flash`) or another cheap one; no skill
named `<repo>-conventions` yet.
**Changes data:** one extraction run (paid, one model call), three decisions,
one new skill, one link on General Reviewer, one review run (paid).

1. Click **Conventions** in the sidebar (Skills Lab).
   Caption: Conventions of the active repo — never scanned yet
2. Click **Run extraction** **(changes data)**. Wait for the cards.
   Caption: Code picks the files, the model proposes rules once
3. Hover the evidence header of the first card, then click **GitHub**.
   Caption: Every rule cites a real file and lines — click opens them on GitHub
4. Back in the app, hover the line under the header ("The model proposed …").
   Caption: Rules without evidence in the code were dropped by code
5. Click **Accept** on two cards and **Reject** on a third **(changes data)**.
   Caption: Two accepted, one rejected — each marked, the rejected one stays out of the skill
6. Click the rule text of an accepted card, add a word, click **Save**.
   Caption: A rule can be edited before it becomes a skill
7. Click **Create skill**. Scroll the body in the modal.
   Caption: The draft holds the accepted rules and their evidence only
8. Click **Create skill** in the modal **(changes data)**, then **Open skill**.
   Caption: Saved as type convention, source Extracted
9. Open **Agents → General Reviewer → Skills**, switch the new skill on
   **(changes data)**.
   Caption: Linked like any other skill: its switch and its drag handle
10. Click **Run on a PR…**, open PR #3, **Run Review → General Reviewer**
    **(changes data)**. When it finishes, open the run trace,
    **Prompt assembly → Skills (dynamic)**.
    Caption: The trace shows the skill block and the tokens it added
11. Hold on the trace.
    Caption: Code picks the files so the input is bounded and every claim can be checked against a file we sent

**Not filmed:** Re-scan (same flow; accepted and rejected rules are not
proposed again), Accept all, the second skill from the
remaining conventions.

## One sentence for the voice-over

The files are chosen by code, not by the model, so every run reads a bounded,
reproducible set of files, costs one model call, and every rule it returns can
be checked against a file we actually sent.
