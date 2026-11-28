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
  secrets are read; the direction of imports between layers or folders. A
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
stores it with the verdict inside the git directory (`pr-self-review/` under
it), so nothing is committed and nothing needs an ignore rule.

- Reviewed with `--target head`: the verdict covers that committed content.
- Reviewed the working tree: the verdict covers that content. Once it is
  committed unchanged, the committed content has the same fingerprint and the
  gate opens.
- Any other content, including one more commit, is unreviewed: the gate closes.

## The hook

The project registers the script as a `PreToolUse` hook on the shell tool:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/skills/pr-self-review/scripts/gate.mjs\" hook"
          }
        ]
      }
    ]
  }
}
```

It reads the command about to run. When the command would publish the change
(a push, opening a pull request, merging one), it compares the committed
change with the recorded verdict and blocks unless that exact content passed.
Every other command goes through untouched. A documentation-only change and an
empty change pass without a review.

The command is recognised wherever it stands in the line: after `cd x &&`,
after assignments, behind `env`, `sudo`, `timeout` or any other prefix, inside
`( )`, `$( )`, backticks, `sh -c "..."`, `eval` and `trap`, with a path in
front of the program, and with quotes around its words. A git command that
could rename a subcommand on the spot (`-c alias.x=...`, `GIT_CONFIG_*`) and
`git send-pack` count as a push. A comment and the body of a here-document are
data, not commands; a `<<WORD` inside quotes or a comment is not a
here-document.

Once such a command is recognised, every doubt closes the gate:

- the folder it would run in is not settled by the text. A folder change is
  believed only as `cd <literal path> &&` at the top level, with nothing but
  `&&` between it and the command. A `cd` inside `( )` or `{ }`, behind `;`,
  `||`, `|` or `&`, under `if` or a loop, with a variable, `~`, `-` or an
  escaped character in the path, a `popd`, a relative `cd` while `CDPATH` is
  set, `GIT_DIR` or `GIT_WORK_TREE`, `--git-dir` or `--work-tree`, and a
  prefix program told to change folder (`env -C`) all leave it unsettled;
- that folder is not a git repository;
- the change, the config or the verdict cannot be read;
- the tool call itself cannot be parsed and its text mentions a push or a
  pull-request command.

A command that targets a different repository than the project is let through:
the gate guards this project. A worktree of the project is the project. `gh`
with `--repo`, `-R` or `GH_REPO` acts on the named repository from any folder,
so it is always judged as the project.

In practice: run the command from the repository, or as `cd <path> && <command>`
with a literal path. The gate's message says so when it refuses for this
reason.

`node scripts/gate.mjs check` prints the same decision for the current folder
without running anything.

### What the hook does not do

- It does not review. It only reads the verdict; the review is this skill.
- It reads the text of the command. It cannot follow what the text does not
  show: an alias, a variable that holds the whole command, a script or a
  `make` target that pushes, a command handed to another program as data
  (`echo "..." | sh`, an interpreter's `-e` or `-c`), or another tool that
  publishes (`gh api`). Using one of these to get past a closed gate is a
  bypass, not a workaround.
- It stops the agent, not a person typing in their own terminal. It is a local
  check, not branch protection.

A git `pre-push` hook that runs `node <skill>/scripts/gate.mjs check` closes
the indirect ways for pushes, because git itself runs it. It lives in the
local git directory, so the user installs it; the skill never does.

### Override

Only the user can open a closed gate, and not through the command: the agent
writes the command, so nothing in its text counts as the user's word. The two
ways are:

- The user runs the command in their own terminal, where the hook does not
  apply.
- The user starts the session with a reason in the environment:

  ```bash
  PR_SELF_REVIEW_OVERRIDE="hotfix, review follows in the PR" claude
  ```

  The hook reads the variable from its own process. Every guarded command it
  then lets through is appended to `overrides.log` next to the verdict.

`PR_SELF_REVIEW_OVERRIDE=... git push` typed into a command does nothing: that
assignment reaches git, not the hook.

A gate with no way out gets deleted after its first wrong block; a logged
override, in the user's hands, keeps it in place.
