# Demo skills for import

Skill folders used to demonstrate importing a skill into DevDigest.

## Contents

- `test-naming-clarity/`: a rubric skill (`SKILL.md`) plus `scripts/check.sh`.
- `api-contract/`: the four skills of the API Contract Reviewer (L02 homework,
  spec `server/specs/004-conventions-extractor.md`) and the agent's setup in
  `agent-prompt.md`. Each skill is one `.md` file with `name` and
  `description` in its front matter, so the file itself can be imported.

## Packaging for import

Run this from the repository root to create the zip (run it yourself):

```bash
cd docs/demos/skills && zip -r test-naming-clarity.zip test-naming-clarity
```

## What the import shows

The import reads `SKILL.md` and imports the skill. It shows `scripts/check.sh`
as "skipped, not executed": the importer does not run executable files from a
skill folder, and this script exists to demonstrate that behaviour. Its only
line is an `echo`, and it must never run.
