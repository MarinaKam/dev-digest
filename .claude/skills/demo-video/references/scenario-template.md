<!--
Template for a demo scenario. Copy it to docs/demos/<scenario>.md, replace every <...>
placeholder and delete this comment. The scripts rely on these rules:
- A video starts with "## Video N — <title>", N = 1, 2, 3...
- "**Status:** ⏳ not recorded" sits right under the heading. After that only status.mjs edits it.
- One numbered step is one action on the screen, named by its visible label.
- "Caption:" on the line under a step is the on-screen caption, at most 90 characters.
- "**(changes data)**" follows a step that saves, imports, deletes, toggles or starts a run.
- "*(off camera)*" starts a step whose wait is cut from the video.
- No step opens a field that holds an API key or a token.
-->
# Demo: <what the demo shows>

Scenario for the `demo-video` skill, branch `<branch>`. Each `## Video N` becomes one file in
`demo/<scenario>/` (git-ignored). Lines that start with `Caption:` appear on screen.

Setup for every video: stack running (`./scripts/dev.sh`), 1440x900, dark theme.

---

## Video 1 — <feature>: <what the user gains>

**Status:** ⏳ not recorded

**Preconditions:** <data that must exist, with exact names: repo, pull request, agent>.
**Changes data:** <what the recording leaves in the development database, or "nothing">.

1. Open `<route>`.
   Caption: <what this screen is, in one sentence>
2. Hover <something the viewer should notice>.
   Caption: <why it matters>
3. Click **<button or tab label>**. <What appears.>
   Caption: <what the viewer sees>
4. Click **<Save / Run ...>** **(changes data)**.
   Caption: <what the action does>
5. *(off camera)* Wait until <the run or sync> finishes (up to <N> min).
6. Click **<tab>**. Hold on <the result>.
   Caption: <the outcome>

**Not filmed:** <optional: a step left out on purpose, and why>.
