# Demo: skills for review agents

Scenario for the `demo-video` skill, branch `feat/review-agent-skills`. Each `## Video N` becomes one file in
`demo/feat-review-agent-skills/` (git-ignored). Lines that start with `Caption:` appear on screen.

Setup for every video: stack running (`./scripts/dev.sh`), 1440x900, dark theme.
Spec: `server/specs/003-review-agent-skills.md`.

---

## Video 1 — Skills page: one rule, written once, versioned

**Status:** ⏳ not recorded

**Preconditions:** seeded skills exist (`edge-case-coverage` at v1, linked to Test Quality Reviewer).
**Changes data:** `edge-case-coverage` gets a new body line and becomes v2.

1. Open `/skills`.
   Caption: Skills are reusable review rules, shared by agents
2. Hover the `edge-case-coverage` card.
   Caption: Type, source and how many agents use each skill
3. Click into **Skill body** and add the line `- dates at month and year boundaries`.
   Caption: The body is the only text the model receives
4. Click **Save** **(changes data)**.
   Caption: Changing the body saves a new version: v2
5. Click the **Preview** tab.
   Caption: Rendered as the reviewing agent receives it
6. Click the **Versions** tab, then **Diff** on v1.
   Caption: Every save keeps the exact text it replaced
7. Click the **Stats** tab. Hold on "Used by".
   Caption: Which agents pick this skill up

**Not filmed:** Restore (same mechanism as Save), Delete.

## Video 2 — Import: preview first, nothing runs

**Status:** ⏳ not recorded

**Preconditions:** `docs/demos/skills/test-naming-clarity.zip` exists (the user runs
`cd docs/demos/skills && zip -r test-naming-clarity.zip test-naming-clarity`); no skill named
`test-naming-clarity` yet.
**Changes data:** creates the skill `test-naming-clarity` (source Imported).

1. Open `/skills`.
   Caption: Skills can come from outside: a .md or a .zip
2. Click **Add Skill**, then **Import from file**.
   Caption: Import reads text only; nothing is saved yet
3. Choose `docs/demos/skills/test-naming-clarity.zip`.
   Caption: The archive's SKILL.md becomes a draft
4. Hover the skipped `scripts/check.sh` line.
   Caption: Scripts in the archive are listed, never executed
5. Hover the yellow warning.
   Caption: A foreign skill is foreign instructions in your prompt
6. Click **Save skill** **(changes data)**.
   Caption: Saved only after you read and confirm it

## Video 3 — Agent editor: link, order, switch off

**Status:** ⏳ not recorded

**Preconditions:** Video 2 recorded (`test-naming-clarity` exists, not linked).
**Changes data:** links `test-naming-clarity` to Test Quality Reviewer, moves it to the top,
switches `flaky-test-patterns` off and back on.

1. Open `/agents`, click **Test Quality Reviewer**, then the **Skills** tab.
   Caption: An agent links skills; order sets the prompt order
2. Tick `test-naming-clarity` **(changes data)**.
   Caption: The imported skill joins this agent's prompt
3. Drag `test-naming-clarity` above `uncovered-branch-detector` **(changes data)**.
   Caption: Earlier skills come earlier in the prompt
4. Open `/skills`, switch `flaky-test-patterns` off on its card **(changes data)**.
   Caption: The global switch turns a skill off for every agent
5. Back on the agent's **Skills** tab, hover the dimmed row.
   Caption: Still linked, but "off globally": not sent
6. Switch `flaky-test-patterns` back on **(changes data)**.
   Caption: Back on: the agent sends it again

## Video 4 — Control experiment: Test Quality Reviewer

**Status:** ⏳ not recorded

**Preconditions:** a pull request in `MarinaKam/dev-digest` built from
`docs/demos/skills-experiment/test-quality-happy-path.md` (a helper with a throw and a clamp
branch, one happy-path test), synced into the app. Its number is filled in when compiling.
**Changes data:** two or more review runs of Test Quality Reviewer (model calls, paid), and the
agent's skill links removed and restored.

1. On the agent's **Skills** tab, untick all of its skills **(changes data)**.
   Caption: Variant A: the same agent with no skills linked
2. Open the demo pull request, click **Run Review** for Test Quality Reviewer **(changes data)**.
   Caption: Same PR, same model, no skills
3. *(off camera)* Wait until the run finishes (up to 2 min).
4. Open the run's trace, the prompt section. Hold on it.
   Caption: No skills block in the prompt; the gap is missed
5. Tick the four skills again, in their order **(changes data)**.
   Caption: Variant B: the skills linked back
6. Run the review again **(changes data)**.
   Caption: Same PR, now with skills
7. *(off camera)* Wait until the run finishes (up to 2 min).
8. Open the trace's prompt section. Hold on the skills block.
   Caption: Skills block, its tokens, each skill as name@vN
9. Open the findings.
   Caption: The untested branch and the boundary are flagged

**Not filmed:** the second and third run of each variant (the spec asks for two or three; they
are run off camera and only the first of each is shown).

## Video 5 — Control experiment: API Contract Reviewer

**Status:** ⏳ not recorded

**Preconditions:** a pull request built from
`docs/demos/skills-experiment/api-contract-route-change.md` (a renamed request field and a
removed response field), synced into the app.
**Changes data:** two or more review runs of API Contract Reviewer (paid), links removed and
restored.

1. On API Contract Reviewer's **Skills** tab, untick both skills **(changes data)**.
   Caption: Variant A: API Contract Reviewer without skills
2. Open the demo pull request and run the review **(changes data)**.
   Caption: A route signature changed in this PR
3. *(off camera)* Wait until the run finishes (up to 2 min).
4. Open the trace's prompt section.
   Caption: No skills in the prompt; the break goes unflagged
5. Tick both skills again **(changes data)** and run the review again **(changes data)**.
   Caption: Variant B: the contract skills linked back
6. *(off camera)* Wait until the run finishes (up to 2 min).
7. Open the findings, then the trace's skills block.
   Caption: The breaking change is caught, and the trace shows why

## Not in these videos

- `/pr-self-review` is run in Claude Code, not in the web app. Record it as a terminal clip:
  type `/pr-self-review` on this branch and hold on the routing lines that load the frontend
  skills for `client/` and the backend skills for `server/` and `reviewer-core/`.
