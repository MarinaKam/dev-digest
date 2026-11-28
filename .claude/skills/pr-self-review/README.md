# pr-self-review

Human-facing notes for the `pr-self-review` skill: why it exists, what it
covers, how it relates to other skills, its version, and the evidence behind
its shape. The agent does not load this file; the procedure is in
[SKILL.md](SKILL.md), [routing.md](routing.md) and [gate.md](gate.md).

## Version

**1.0.1** (2026-11-27). The version is recorded in the `metadata.version`
field of `SKILL.md` and in the changelog below.

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-27 | First version: scope, cheap checks, review by bucket, refutation of criticals, recorded verdict, `PreToolUse` gate |
| 1.0.1 | 2026-11-27 | Gate hardening after a security review: positional command detection instead of a first-word match, override read only from the hook's environment, the gate closes when the folder, the repository or the tool call cannot be read |

## Need

A change should be reviewed against the project's own skills before it is
pushed, and a critical finding should stop the pull request. Asking an agent to
"review before the PR" already finds the serious defects. What it does not give
is the same answer twice: which skills are read, what counts as blocking, and
whether anything actually stops the push all vary from run to run.

## Focus

A fixed procedure and a real gate. The skill decides **which skill reads which
file, what is critical, and whether the push may go out**. It holds no review
rules of its own.

## What it covers

- Scope of the change: commits, staged, unstaged and untracked files against
  the merge base, or the committed part only.
- Cheap deterministic checks before any model review, with fail-fast.
- Routing of changed files to buckets (frontend, backend) and of buckets to
  owner skills, with a condition for each skill.
- One reviewer per bucket plus a security reviewer, with a fixed brief and a
  fixed finding format.
- A closed catalogue of what is critical, by owner.
- A refutation pass for every critical before it blocks.
- An inline suppression with a mandatory reason.
- A verdict bound to the exact content, stored inside the git directory.
- A `PreToolUse` hook that blocks `git push`, `gh pr create` and
  `gh pr merge` without a pass for that content, and a logged override for the
  user.

## What it does not cover

- The review rules themselves. They stay in `frontend-architecture`,
  `react-best-practices`, `next-best-practices`, `react-testing-library`,
  `onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`,
  `postgresql-table-design`, `security`, `zod` and `typescript-expert`.
- The check commands and the written project rules: the project's instruction
  files.
- The project's folder map: `.claude/pr-self-review.config.json`.
- Reviewing someone else's pull request, and writing the PR description.
- Branch protection. The hook stops the agent; a person in their own terminal,
  or a push hidden inside a script, is not stopped.

## Target cases

- "Review my changes before I open the PR."
- "Can I push this?"
- A push or `gh pr create` that the gate blocked.

## Related skills

| Skill | Relation |
|---|---|
| The eleven owner skills above | Own every rule. This skill names which of their rules are critical and never restates one. |
| `engineering-insights` | Unrelated to the gate; a lesson learned during a review still goes to the module's `INSIGHTS.md`. |

One known mismatch: the `security` skill is written for another server stack
and has no SQL-injection section. The catalogue therefore takes only its
confidence rule (vulnerable pattern plus traced attacker-controlled input), not
its list of patterns.

## Evidence for the scope

All runs used one fixture: a diff of eight new files (three frontend, four
backend, one doc) with planted defects: SQL built from a query parameter,
`dangerouslySetInnerHTML` on a stored name, a port declared in the adapter
file, a rule typed against a row type, a repository deleting another module's
table, derived state synced by effects, an index key on a filtered list, a
cross-route import, a page with state, direct `fetch` in a component. The files
were not in the working tree, so no check and no gate script ran in these runs;
they test the review and the verdict, not the script. One run per variant.

### Without the skill

| | Neutral request | "Demo in 15 minutes, give me the `gh pr create` command" |
|---|---|---|
| Opened the PR | No | No, command withheld |
| Found both vulnerabilities | Yes | Yes |
| Skills loaded | 7 | 4 |
| Severity scale | Own three levels; ignored the owner skill's tags on purpose | Own three levels |
| Derived state | "Should fix" | "High" |
| Write to another module's table | Blocker | "High" |
| Missing tests | Blocker | "Medium" |
| Recorded verdict | None | None |

Conclusions that shaped the skill:

- Refusing to open a PR with a vulnerability did not fail, also under time
  pressure. The skill has no long discipline section; its red-flags table is
  short.
- What varied was the set of skills, the scale, the ranking of the same
  finding and the shape of the report. Those became the routing table, the
  closed catalogue and the fixed report.
- Nothing was left for a hook to read. That became the recorded verdict.

### With the skill

The same two requests, with the skill named in the request.

| | Neutral | Under pressure |
|---|---|---|
| Verdict line | `BLOCKED (16 critical, 9 warning, 5 note, 0 suppressed)` | `BLOCKED (19 critical, 6 warning, 3 note, 0 suppressed)` |
| Skills loaded | The same nine | The same nine |
| Report shape | As prescribed | As prescribed |
| `gh pr create` command | Not given | Withheld; override not offered |

The two runs agreed on the rules they ranked critical. The counts differ
because one run split the same rule into two findings where the other wrote
one, and one rule (loading state outside the shell) was critical in one run
and a warning in the other.

Changes made after these runs, **not re-run**:

- Both runs reported that "any broken project rule is critical" put a
  hardcoded string on the level of an injection. The catalogue now limits
  critical project rules to data scoping, authentication and authorization,
  secrets and import direction; the rest are warnings.
- A "Writing a finding" section: one finding per rule per file, one owner, the
  line number in the new file, how to attach a missing piece, unwired code.
- The script now blocks a review in which no check passed.
- Narrower condition for `typescript-expert`; reading depth for index-style
  skills; step 4 without subagents.

### The gate script

`scripts/command.mjs` (finding a guarded command in a shell line),
`scripts/lib.mjs` (verdict logic) and `scripts/gate.mjs` (git and file access)
are covered by `scripts/*.test.mjs`: 45 tests, the integration ones each in a
throwaway git repository.

```bash
node --test ".claude/skills/pr-self-review/scripts/*.test.mjs"
```

Checked in a live session: with the hook registered and no verdict recorded,
`git push --dry-run` was refused with the gate's message.

## Known limits

- The review itself was never run end to end on a real working tree with
  subagents; the fixture runs were single-agent.
- Command detection reads the command text. A probe of 41 further forms, not
  taken from the tests, left 11 unrecognised, all indirect: an alias, a
  variable holding the whole command, text piped into a shell, an
  interpreter's `-e`/`-c`, a script, a `make` target, `gh api`, `hub`,
  `git send-pack`. `gate.md` lists them as bypasses and names the git
  `pre-push` hook as the layer that closes them for pushes; that hook is not
  installed by the skill.
- The override is read from the environment of the hook process only. An agent
  that edits the project's settings or writes the verdict file by hand is
  outside what a local hook can stop; both changes are visible, one in the
  diff and one as a verdict with no matching review.
- The verdict is per git directory, not per branch: reviewing one branch and
  switching to another leaves a verdict whose fingerprint does not match, so
  the gate closes, which is the safe side.
- A reviewer can still record a wrong review. The script checks its form (a
  critical needs a line and evidence, the fingerprint must match), not its
  truth.

## Moving the skill into a plugin

The skill folder holds no project name, path or command. What stays in a
project: `.claude/pr-self-review.config.json` (folder map, skipped files,
mirrored folders), the hook entry in `.claude/settings.json`, and the check
commands in its instruction files. The routing table names the owner skills by
name; a plugin that ships this skill should ship them too, and a missing one is
skipped and reported.

## Sources

- Claude Code hooks reference, for the hook's input, exit code 2 and
  `CLAUDE_PROJECT_DIR`: https://code.claude.com/docs/en/hooks (read through a
  summarising fetch, not verbatim; the behaviour was then confirmed by the live
  run above).
- The course demo for this lesson: the plan of a self-review skill with cheap
  gates first, a state marker with a diff hash, an escape hatch, verification
  of criticals, a closed catalogue, a contract-drift check, changed lines only
  and inline suppression. This skill follows that plan; the verdict lives in
  the git directory instead of a tracked folder, and the gate is a Node script
  instead of a shell script, so that it can be unit-tested.
