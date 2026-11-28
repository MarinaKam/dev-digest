---
name: deprecation-policy
description: Require that a public route, field or parameter is deprecated before it is removed — marked in code and docs, still working, with a replacement and a removal date — and flag silent removals and renames.
---
# Deprecation policy

Clients need time to move. Removing something they use without warning breaks
them; deprecating it first lets them migrate on their own schedule.

## Rules
- A public route, field, parameter or exported symbol is removed only after it
  was deprecated in an earlier release.
- Deprecating means all of:
  - it still works exactly as before;
  - it is marked: `@deprecated` JSDoc, `.describe('Deprecated: …')` on the Zod
    field, `deprecated: true` in OpenAPI, or a `Deprecation` / `Sunset` response header;
  - the mark names the replacement and the planned removal version or date;
  - the changelog lists it.
- Report as **CRITICAL** a removal or rename with no earlier deprecation visible
  in the diff or its context, and suggest the deprecation step instead.
- Report as **WARNING** a deprecation without a replacement or a removal date.

## Good — old field deprecated, still accepted

```ts
const SettingsBody = z.object({
  /** @deprecated Use `auto_reviews`. Removed in 3.0.0 (2027-03-01). */
  automatic_reviews: z.boolean().optional().describe('Deprecated: use auto_reviews'),
  auto_reviews: z.boolean().optional(),
});
```

## Bad — removed in the same release that introduces the replacement

```ts
const SettingsBody = z.object({
  auto_reviews: z.boolean(),
});
```
