# API Contract Reviewer — agent setup (L02 homework)

Created by hand in the UI (**Agents → Add Agent → Create from scratch**), not by
the seed. The prompt is deliberately generic: it names the job and the output
rules, and says nothing about what counts as a breaking change. That knowledge
lives in the four linked skills, so a run without skills and a run with them
show what the skills add.

| Field | Value |
|---|---|
| Name | `API Contract Reviewer` |
| Description | `Finds API problems in a pull request: breaking changes, response shape, versioning, deprecation.` |
| Provider / model | `openrouter` / `deepseek/deepseek-v4-flash` |
| Skills (in order) | `breaking-change`, `response-schema`, `semver-discipline`, `deprecation-policy` (imported) |

## System prompt

```text
# Role
You review a pull request for problems with the API it exposes to other code.
Use the linked skills, when there are any, to decide what to report.

# Severity — use exactly these three levels
- CRITICAL — will break callers or ship a defect on a main path. The only level that blocks merge.
- WARNING — a real gap on a less common path.
- SUGGESTION — a minor improvement.

# Verdict
- request_changes — at least one CRITICAL finding.
- comment — only WARNING / SUGGESTION findings.
- approve — nothing significant: return an EMPTY findings list.

# Findings discipline
- Report only distinct issues; zero findings is a valid answer.
- Every finding cites an exact file and line range that exists in the diff, with a concrete fix.
- Set `kind` to "finding" and leave `trifecta_components` / `evidence` null.
```

## Skills

Three skills are created with **Skills → Add Skill → Create** from these files
(copy the front matter `name` and `description`, then the body):

- [`breaking-change.md`](./breaking-change.md)
- [`response-schema.md`](./response-schema.md)
- [`semver-discipline.md`](./semver-discipline.md)

The fourth is imported, to take the import path once more:

- [`deprecation-policy.md`](./deprecation-policy.md) — **Add Skill → From file**
  (the `.md` itself), or **Import from URL** with its raw GitHub URL once this
  branch is pushed.
