# Demo: a tour of a reviewed pull request

Scenario for the `demo-video` skill, branch `feat/demo-video-skill`. Each `## Video N` becomes
one file in `demo/feat-demo-video-skill/` (git-ignored). Lines that start with `Caption:`
appear on screen.

Setup for every video: stack running (`./scripts/dev.sh`), 1440x900, dark theme.

This is the skill's worked example: it only reads seeded data, so it can be recorded on any
freshly seeded database.

---

## Video 1 — From the PR list to a finding

**Status:** ✅ recorded 2026-11-27 · [01-pr-tour.mp4](../../demo/feat-demo-video-skill/01-pr-tour.mp4) · 29 s

**Preconditions:** the seeded repo `acme/payments-api` is the first repo, with PR #482
"Add rate limiting to public API endpoints" and its seeded review run (verdict
"request changes", 2 findings).
**Changes data:** nothing.

1. Open `/` with the **All** filter already selected (set before the recording starts, so
   the first frame shows the seeded pull request).
   Caption: DevDigest reviews pull requests with AI agents, on your own machine
2. Hold on the list.
   Caption: Every imported pull request, with its score, findings and review cost
3. Click the row **Add rate limiting to public API endpoints**. The PR page opens.
   Caption: One page per pull request: description, agent runs and the diff
4. Click the **Agent runs** tab. The timeline and the review runs appear.
   Caption: Each reviewer agent leaves a run with a verdict, a score and its cost
5. Click the run **2 findings · 1 blocker**. Its findings open and scroll to the middle
   of the screen.
   Caption: A run opens into findings, each tied to a file and a line of the diff
6. Click the **Files changed** tab. Hold on the list of files.
   Caption: Files changed lists every file the pull request touches

**Not filmed:** **Run Review** (starts a paid model call) and the **Delete** buttons next to
each run.
