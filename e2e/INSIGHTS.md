# e2e — insights

Things learned while working in `e2e/` that the code does not show.

Append-only: add a new entry at the bottom of its section, never rewrite or
delete an old one. If an entry turns out to be wrong, add a new entry that says so.

Entry format, one line per entry:

```
- **YYYY-MM-DD** — <concrete, actionable insight>. Evidence: `path/file.ts:NN`.
```

Write an entry only if a reader can act on it without re-investigating, and
only if it is not obvious from reading the code.

## What Works
<!-- Approaches and solutions that proved effective here. -->

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->
- **2026-11-27** — `agent-browser find <locator> ... <action>` does not wait for its target: on an element that renders a moment later it exits 1 at once ("none match name"), while `wait --text` / `wait --url` do wait. Put a `wait` step before a `find` on content that loads, or retry the command (agent-browser 0.45.0). Evidence: `.claude/skills/demo-video/scripts/record.mjs:98`.
- **2026-11-27** — While `agent-browser record` runs at an emulated device scale of 2 (`set viewport <w> <h> 2`), mouse events land at half their coordinates: a `find text ... hover` on an element centred at 476,300 moved the pointer to 237,149, and the following click missed. Without a recording, or at scale 1, the same command lands on the target. Record at scale 1 (agent-browser 0.45.0). Evidence: `.claude/skills/demo-video/scripts/record.mjs:27`.

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
