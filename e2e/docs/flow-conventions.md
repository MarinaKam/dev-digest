# Flow conventions

Why the browser flows look the way they do, and how to add one. The mechanics
(file format, commands, how to run) are in `../README.md`.

## Why the flows are plain JSON command lists

A flow is a list of `agent-browser` commands with no code around it. The runner
passes each command through unchanged, and a command that exits non-zero fails
the flow. So a `wait --text` or `wait --url` step is the assertion: it times
out when the condition never holds.

This keeps a flow readable as a script of what a person does, and leaves
nothing to debug except the app and the locator.

## Why only deterministic locators

Flows use `--url`, `--text` and `find role|text|label` only. The `chat` command
of `agent-browser` asks a model to find the element; it needs a key, costs
money, and can pick a different element on another day. A suite that runs on
every pull request must give the same answer for the same build.

## Why seeded data only

Every flow reads what `server/src/db/seed.ts` creates: the repo
`acme/payments-api`, PR #482 with one review and two findings, and the seeded
agents. No flow starts a review, so no flow calls a model.

Two consequences:

- **A flow assumes a freshly seeded database.** Flows that follow the home
  redirect land on the first repo. A development database with other repos
  sends them elsewhere and they fail. Use the hermetic runner.
- **A feature that only shows on real review runs has no flow.** The seeded PR
  has no diff text, so a review of it yields nothing.

## The hermetic runner and its ports

`npm run e2e:hermetic` (or `./scripts/e2e.sh`) starts its own stack: Postgres on
`:5433`, API on `:3101`, web on `:3100`, with an empty database that it seeds
and then discards.

Check that those three ports are free before you run it. A machine that already
publishes its development Postgres on `:5433` (through a local Compose override,
for example) collides with it.

## Adding a flow

1. Read the feature's spec (`../../client/specs/` or `../../server/specs/`) and
   pick the one journey worth guarding. Coverage here is typological: one happy
   path per main journey, not every state.
2. Check that the journey is reachable on seeded data. If it needs a model
   call, it does not belong here; cover it with a component or integration test.
3. Name the file `NN-name.flow.json`, with the next free number.
4. Put the reason for the flow and its data assumptions in `description`.
5. Prefer text a user reads over structure: `wait --text "request changes"`
   survives a refactor, a CSS selector does not.
6. Run it on the hermetic stack.

## What is covered, and what is not

| Flow | Journey |
|---|---|
| `01-app-boot` | The app opens and lands on the seeded repo's PR list. |
| `02-repo-pulls-detail` | PR list → PR detail. |
| `03-agents` | The agents screen. |
| `04-pr-findings` | PR detail → "Agent runs": seeded run, verdict, findings. |
| `05-pr-diff` | PR detail → "Files changed". |
| `06-onboarding` | The onboarding screen. |
| `07-settings` | The settings screen. |

Not covered by a flow: the severity counters and their filter, the FINDINGS
column and findings list on the PR list, the "Reviewing…" state. They are
covered by component tests in `client/` and integration tests in `server/`.
