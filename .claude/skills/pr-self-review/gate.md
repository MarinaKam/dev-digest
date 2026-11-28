# Gate: what blocks, how a verdict is recorded, how the hook works

Read this in steps 3 to 5.

## What is critical: the closed catalogue

A finding is critical only when it is on this list. The list names the owner of
each rule; the rule itself is in the owner, not here.

### Decided by the script, not by a reviewer

- A failed check: type check, lint, architecture check, tests.
- No check passed at all. A review in which every check is `not_run` cannot
  pass.
- A mirrored copy out of sync with its source (`mirrored copies`). The script
  adds this check itself; do not put it in the review file.

### Any reviewed file

- A vulnerability that is high confidence by the `security` skill's confidence
  rule: the vulnerable pattern is in a changed line **and** the input is traced
  to something an attacker controls. The path may run through unchanged code.
- A secret committed in a changed line.
- A rule written in the project's instruction file for that package, broken by
  a changed line, when the rule is about one of these: which tenant, workspace
  or user may see or change data; authentication or authorization; where
  secrets are read; the direction of imports between layers or folders; a
  package the file declares pure doing I/O (database, network, file system,
  environment). A
  deviation the file records as accepted is not a finding.
- A file the instruction file says not to edit, edited by hand.

Every other written project rule that a changed line breaks (naming, text
placement, where state lives, file layout, a missing test) is a warning.

### Frontend

- `react-best-practices`, the sections on derived state, key props and
  components created during render, and a side effect during render. These
  produce wrong behaviour, not only untidy code.
- `frontend-architecture`, the one-way dependency principle: shared code
  importing from a route, or one route importing another route's private files.

### Backend

- `onion-architecture`, rules 1 to 4. Rules 5 and 6 are warnings, and nothing
  at all where the project records the deviation as accepted.

### Everything else

Warning: a rule from an owner skill that is broken and has a visible cost
(performance, maintainability, a missing test for changed behaviour, a size or
count limit). Note: a suggestion. Neither blocks.

## Writing a finding

- **One finding per rule per file.** The same rule broken on five lines of one
  file is one finding: `line` is the first occurrence, the others go in `fix`.
  Two rules broken by one line are two findings only if they have different
  owners and different fixes; otherwise one.
- **One owner.** When a skill and the project's instruction file both state
  the rule, name the instruction file: it is the one that wins.
- **`line` is the line number in the new file**, not in the diff output.
- **Something missing is attached to the line that needs it.** A route that is
  never registered is a finding on the line that declares the route.
- **Code the change adds but does not wire up is judged as if it were wired.**
  An unregistered handler with an injection is still an injection.
- **No owner, no rule.** An observation that no loaded skill and no
  instruction file states is a note with `"skill": "reviewer"`, never more.

Do not promote a finding because it "feels serious", and do not demote one on
the list because the deadline is close. If the list looks wrong for the
project, say so in the report; the user changes the catalogue, not the review.

## Refuting a critical (step 4)

Give the verifier the finding and the diff, and nothing about who found it.
The finding stays critical only if every answer is yes:

1. Is the quoted evidence at that file and line?
2. Was that line added or changed by this change?
3. Is the rule on the catalogue above, and does the owner skill say what the
   finding claims it says?
4. Does the project's instruction file leave the rule in force (no accepted
   deviation)?
5. For a vulnerability: can the path from attacker-controlled input to the
   dangerous call be followed in the code, step by step? Follow it into
   unchanged code where needed.
6. Is the line free of a `pr-self-review-ignore` with a reason?

A "no" on 1 or 2 drops the finding. A "no" on 3, 4 or 5 makes it a warning. A
"no" on 6 keeps it in the report as suppressed.

## Suppressing one finding

```ts
// pr-self-review-ignore: internal admin tool, input comes from our own config
```

The comment sits on the line or on the line above. The finding is reported
with `"suppressed": "<reason>"`, counted apart, and does not block. A
suppression needs a reason. Reviewers never add one: only the author of the
change does, on purpose, and every suppression in the diff is listed in the
report so the next reviewer sees it.

## The review file (step 5)

```json
{
  "target": "worktree",
  "fingerprint": "<from scope>",
  "skills": ["onion-architecture", "security"],
  "checks": [
    { "name": "server typecheck", "status": "pass" },
    { "name": "server integration tests", "status": "not_run", "detail": "needs Docker, not running" }
  ],
  "findings": [
    {
      "severity": "critical",
      "file": "api/src/usage.repository.ts",
      "line": 14,
      "rule": "SQL built from request input",
      "skill": "security",
      "evidence": "order by ${sortBy} desc",
      "fix": "validate against an enum and map to a column"
    }
  ]
}
```

- `status` is `pass`, `fail` or `not_run`; `not_run` needs `detail`.
- `severity` is `critical`, `warning` or `note`.
- A critical finding needs `file`, an integer `line`, `rule`, `skill` and a
  non-empty `evidence`. The script refuses the file otherwise: a block without
  a quoted line cannot be checked by anyone.
- Add `"suppressed": "<reason>"` to a suppressed finding.

## How a verdict is bound to the change

The script hashes the content of every changed file into a fingerprint and
writes it with the verdict to `.claude/.pr-self-review.json`. That file is
local state: the project keeps it out of version control, and the script never
counts it as part of the change.

- Reviewed with `--target head`: the verdict covers that committed content.
- Reviewed the working tree: the verdict covers that content. Once it is
  committed unchanged, the committed content has the same fingerprint and the
  gate opens.
- Any other content, including one more commit, is unreviewed: the gate closes.

## The hook

The skill runs in two ways: by hand (the user or the agent starts it), and
through a `PreToolUse` hook that the project registers on the shell tool:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/skills/pr-self-review/scripts/check-gate.sh\""
          }
        ]
      }
    ]
  }
}
```

`check-gate.sh` is the hook script. It reads the command the agent is about to
run. For `git push`, `gh pr create` and `gh pr merge` it compares the committed
change with `.claude/.pr-self-review.json` and blocks when there is no verdict,
the change is different from the reviewed one, or the verdict is `BLOCKED`.
Every other command goes through untouched. A documentation-only change and an
empty change pass without a review.

The hook does not review. It tells the agent to run this skill, and the skill
writes the verdict the hook reads next time.

`node scripts/gate.mjs check` prints the same decision without running
anything.

### Limits

The hook is a plain text match on the command, not a shell parser. It is a
reminder that cannot be forgotten, not a security boundary: a push hidden in a
script, an alias or a nested shell is not seen, and neither is anything a
person types in their own terminal.

### Escape hatch

A gate with no way out gets deleted after its first wrong block. Two ways out,
both written to `.claude/.pr-self-review.log` with the command and the commit:

```bash
PR_SELF_REVIEW_OVERRIDE="hotfix, review follows in the PR" git push
git push --no-verify
```

The decision to use one is the user's. The agent never adds either on its own
and never offers one as the next step.
