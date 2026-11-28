# repo-intel — insights

Things learned while working on the indexer that the code does not show.

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
- **2026-11-28** — For a sample of a repo's style, spread ranked files across folders: on `MarinaKam/dev-digest` the top 12 by rank came from 6 folders (schema files and the PR list) and the model returned 20 one-folder rules, all at confidence 1.0; 24 files spread across folders came from 16 folders and gave architecture-level rules with calibrated confidence. Before the first index there is no rank, so `getConventionSamples` walks the clone. Evidence: `server/src/modules/repo-intel/service.ts:646`.

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
