# Routing: which skill reads which file

Read this in step 3, and in step 0 when the project has no config.

## Buckets

The `scope` command puts every changed file in one bucket.

| Bucket | Meaning | Reviewed |
|---|---|---|
| `frontend` | UI code | Yes |
| `backend` | Server and domain code | Yes |
| `unassigned` | A source file the project map does not place | Against the project's instruction files and by the security reviewer only |
| `docs` | Markdown | No |
| `skip` | Generated or copied files: lock files, generated migrations, the copy side of a mirrored folder | No |

A file marked `test: true` stays in its bucket but is read with the testing
skill only, not with the architecture skills.

`skip` and `docs` files are still part of the fingerprint: changing one after
the review makes the verdict stale.

## Skills per bucket

Load a skill only when its condition holds. A reviewer that loads every skill
for every file reads a lot and finds nothing more.

| Bucket | Skill | When |
|---|---|---|
| frontend | `frontend-architecture` | Always |
| frontend | `react-best-practices` | A component or a hook changed |
| frontend | `next-best-practices` | A route file, a layout, a directive (`'use client'`, `'use server'`) or the framework config changed |
| frontend | `react-testing-library` | Test files only |
| backend | `onion-architecture` | Always |
| backend | `fastify-best-practices` | A route, a plugin, a hook or the server bootstrap changed |
| backend | `drizzle-orm-patterns` | A changed file imports the ORM |
| backend | `postgresql-table-design` | A table definition changed |
| any source file | `security` | Always; it is the security reviewer's only skill |
| any source file | `zod` | A changed file imports the validation library |
| any source file | `typescript-expert` | The change adds generic, conditional or mapped types, or changes compiler options |

Some skills are an index over many reference files. Read the index, then open
only the reference file whose topic a changed line touches; say in the report
which ones were opened.

The project's instruction file may add, replace or remove a skill for a bucket;
follow it. If a skill named here is not installed, skip it and list it under
"Not covered" in the report. Do not replace it with rules from memory.

## The reviewer brief

Give each reviewer exactly this, filled in. It has no other context.

```
You are reviewing one part of a change before it is pushed. Read-only: do not
edit files and do not run commands that change anything.

Files (review these and nothing else):
<paths from the bucket>

See the change with: git diff <mergeBase> -- <paths>
(for target "head": git diff <mergeBase> HEAD -- <paths>)
Judge only added and changed lines. A problem that was already in the file
before this change is not a finding.

Load these skills and apply each to the files it is for: <skills from the table>
Read first: <the instruction file of the package>. Where it disagrees with a
skill, it wins, and a deviation it records as accepted is not a finding.

Severity comes only from this catalogue: <the catalogue section of gate.md for
this bucket, pasted>. Anything outside it is a warning or a note.

A line that carries, or follows, a comment `pr-self-review-ignore: <reason>`
is reported with "suppressed": "<reason>". A suppression with no reason does
not count.

Return a JSON array and nothing else. One object per finding:
{"severity": "critical|warning|note", "file": "...", "line": 0,
 "rule": "the rule broken, in the owner's words", "skill": "owner skill or
 instruction file", "evidence": "the changed line, quoted", "fix": "..."}
An empty array is a valid answer.
```

## Large changes

One reviewer reads about forty files well. For a bigger bucket, split it by
top-level folder and start one reviewer per part. Do not sample: every changed
file in a reviewed bucket is read by someone.

## A project without a config

Without `.claude/pr-self-review.config.json` the script places only files with
a UI extension; every other source file is `unassigned`. Propose a config to
the user and create it only after they agree:

```json
{
  "base": "origin/main",
  "buckets": { "frontend": ["web/**"], "backend": ["api/**"] },
  "skip": ["**/*.lock", "api/migrations/**"],
  "mirrors": [["api/shared", "web/shared"]]
}
```

- `base`: optional; the default is the remote's default branch.
- `buckets`: globs per bucket. `**` crosses folders, `*` stays in one segment.
- `skip`: files nobody reviews.
- `mirrors`: pairs of folders that must hold identical copies. A changed file
  whose copy differs fails the `mirrored copies` check.
