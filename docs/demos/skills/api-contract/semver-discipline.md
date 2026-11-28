---
name: semver-discipline
description: Decide which version bump a contract change requires — major for any breaking change, minor for a compatible addition, patch for a fix — and flag a pull request whose version bump or changelog does not match its changes.
---
# Semver discipline

The version tells clients whether they can upgrade without reading the diff.

## Rules
- Classify each contract change in the pull request:
  - **major** — anything the `breaking-change` or `response-schema` rules call
    CRITICAL: removed or renamed routes and fields, narrowed types, new required
    inputs, changed status codes;
  - **minor** — a new route, a new optional field, a new enum value;
  - **patch** — a fix that keeps every input and output as it was.
- The required bump is the highest one in the pull request.
- Report as **CRITICAL** a breaking change shipped with a minor or patch bump,
  or with no bump of a published package (`package.json` `version`, API version
  prefix, OpenAPI `info.version`).
- Report as **WARNING** a breaking change without a changelog or migration note.
- When the project has no version for its API, say which bump the change would
  need and suggest a versioned route instead of an in-place break.

## Good

```diff
- "version": "2.3.1",
+ "version": "3.0.0",
```
```md
## 3.0.0 — Breaking
- `PUT /settings`: `automatic_reviews` renamed to `auto_reviews`. Send the new name.
```

## Bad

```diff
- "version": "2.3.1",
+ "version": "2.3.2",
```
A renamed request field shipped as a patch: clients that pin `^2.3.0` upgrade
automatically and break.
