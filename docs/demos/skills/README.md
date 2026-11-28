# Demo skills for import

Skill folders used to demonstrate importing a skill into DevDigest.

## Contents

- `test-naming-clarity/`: a rubric skill (`SKILL.md`) plus `scripts/check.sh`.

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
