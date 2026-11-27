---
name: demo-video
description: Use when the user asks for a demo video, screencast, walkthrough or screen recording of the DevDigest web app, wants a demo scenario drafted for a branch or a homework pull request, or points at a docs/demos/*.md scenario to record.
---

# demo-video

Records a demo of the web app from a written scenario. The scenario is the source; the video
is rebuilt from it.

```
docs/demos/<scenario>.md          scenario, tracked, English          (you write, user reviews)
  -> demo/<scenario>/NN-name.flow.json   steps for the runner, git-ignored  (you compile)
  -> dry run -> recording -> demo/<scenario>/NN-name.mp4 + NN-name.sheet.png
  -> you look at the sheet -> status line written back into the scenario
```

Scripts, run from the repo root (`S=.claude/skills/demo-video/scripts`):

| Command | Does |
|---|---|
| `node $S/record.mjs <flow.json> --dry-run` | plays the flow fast, records nothing, only checks steps that change data |
| `node $S/record.mjs <flow.json>` | records the video (`--headed` shows the window, `--keep-open` keeps the session after a failure) |
| `node $S/status.mjs <scenario.md> --list` | prints every video and its status |
| `node $S/status.mjs <scenario.md> <N> recorded <mp4>` | writes the status line (also `failed "<reason>"`, `pending`) |

Flow file format: [references/flow.md](references/flow.md). Scenario template:
[references/scenario-template.md](references/scenario-template.md).

## 1. Name the scenario

- `<scenario>` is the current branch with `/` replaced by `-`:
  `git branch --show-current | tr '/' '-'`. Branch `feat/severity-filter` gives
  `docs/demos/feat-severity-filter.md` and `demo/feat-severity-filter/`.
- A scenario file named by the user wins over the branch; its basename is `<scenario>`.
- Each `## Video N` gets a two-digit number and a short slug: `demo/<scenario>/01-severity-filter.flow.json`.

## 2. Draft the scenario, then stop for review

Skip this section when the scenario file exists and the user asked to record it.

1. Copy [references/scenario-template.md](references/scenario-template.md) to
   `docs/demos/<scenario>.md`. If the file exists, add new `## Video N` sections after the
   last one. Leave existing videos and their status lines as they are.
2. Decide what to show: the user's description, or, without one, what the branch changed
   (`git log --oneline main..HEAD`, `git diff --stat main...HEAD`, the specs it touched). One
   user-visible feature is one video of 6 to 12 steps, one to two minutes.
3. Take every route, label and name from the real app: routes from
   `client/src/app/**/page.tsx`, button and tab labels from a snapshot of the running page
   (section 4) or from `client/messages/en/*.json`, data names from the API (`GET /repos`,
   `/agents`).
4. Mark each step that saves, imports, deletes, toggles or starts a run with
   **(changes data)**, and total them under **Changes data:**. Put a long wait in its own
   *(off camera)* step.
5. Write captions of at most 90 characters that say why the step matters. Captions and the
   scenario are in English unless the user asks for another caption language.
6. Report the file path, one line per video (title, number of steps, what it changes) and any
   precondition the current data does not meet. Wait for the user's go-ahead before recording.

## 3. Preflight

- Find the web origin. The default is `http://localhost:3000`, but another project can hold
  that port: confirm the page is DevDigest (`curl -s <origin> | grep -c DevDigest`). For any
  other origin, export `DEMO_BASE_URL=<origin>` for every `record.mjs` call.
- The API must answer (`curl -s http://localhost:3001/repos`) and must allow that origin: its
  CORS origin comes from `WEB_PORT`.
- Starting, stopping or restarting the stack is the user's action. If it is down or on the
  wrong port, give them the command (`./scripts/dev.sh`) and wait.
- `agent-browser`, `ffmpeg` and `ffprobe` must be on `PATH`; `record.mjs` checks and names
  the missing one. Installing them is the user's action.
- Check each video's **Preconditions** against the API. Data that has to be created, reset
  or deleted first is the user's decision: report it and ask.

## 4. Compile a video into its flow file

- Resolve ids now (repo ids from `GET /repos`); a PR page is `/repos/<repoId>/pulls/<number>`.
- Read the labels from the real page, never from memory:
  `AGENT_BROWSER_SESSION=demo-video agent-browser open <url>`, then
  `AGENT_BROWSER_SESSION=demo-video agent-browser snapshot -i`. Close it with
  `AGENT_BROWSER_SESSION=demo-video agent-browser close` before running `record.mjs`.
- Prefer `find role <role> click --name "<name>"`, then `find text "<text>" click`. When a
  label appears twice (a sidebar link and a tab), add `--exact` or use the role that differs.
- `start` plus `startWait` put a ready page on screen before the first frame. The first step
  is a caption with the video's title.
- After a click that loads data, add a `wait --text` or `wait --url` step.
- Copy every **(changes data)** marker into `"changesData": true`. A missed marker makes the
  dry run perform the change, and the recording performs it a second time.
- Copy every *(off camera)* marker into `"offCamera": true` with a long enough `"timeout"`,
  and follow it with a caption that explains the jump.
- Give a screen the viewer has to read a `"hold"` of 3000 to 5000.

## 5. Dry run, record, check, mark

1. `node $S/record.mjs demo/<scenario>/NN-name.flow.json --dry-run`
   - `✗` is a real failure: fix the locator (rerun with `--keep-open`, then `snapshot -i`).
   - `~` is a data-changing step that was checked and left alone.
   - `?` is a step after a `~` that could not be verified, because it needs the change.
2. If the flow has `changesData` steps, list them to the user and get a yes before recording.
3. `node $S/record.mjs demo/<scenario>/NN-name.flow.json`
   On failure, open `NN-name.failed.png`, fix the flow, tell the user which changes the
   attempt already made (the runner lists them), and run
   `node $S/status.mjs docs/demos/<scenario>.md N failed "step K: <what>"`.
4. Open `NN-name.sheet.png` (one frame every 3 seconds). The video is done only if no frame
   shows an error page, an empty list where data was expected, a caption covering the thing
   it describes, or a secret.
5. `node $S/status.mjs docs/demos/<scenario>.md N recorded demo/<scenario>/NN-name.mp4`
6. Tell the user the file path, length and size, and what the recording changed in the app.

## 6. Rules

- A recording acts on the user's development database. Every data-changing step needs the
  user's yes for this recording; a yes for the draft is a yes for the draft.
- A step that starts a review or any other model call costs money. Record it only when the
  user asked for that step, and say so before the recording starts.
- Do not open or film Settings fields that hold API keys or tokens, `.env` files, or a
  terminal that shows them.
- The scenario's status line is written only by `status.mjs`, only after step 5.4.
- `demo/` is git-ignored: flows, videos, sheets and screenshots stay local. The scenario in
  `docs/demos/` is committed with the feature.
- The runner uses one browser session named `demo-video` and closes it. Do not touch other
  agent-browser sessions.

## For a homework pull request

- The video is attached by the user: they drag the `.mp4` into the pull-request description
  on GitHub. Its link goes first under "Screenshots / Demo", on its own line.
- Say the file size when you hand the video over; GitHub rejects attachments above its size
  limit. To shrink a video, lower the viewport or shorten the holds and record again.
- Link the scenario (`docs/demos/<scenario>.md`) in the description, so the mentor can see
  what the video covers.
