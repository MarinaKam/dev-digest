---
name: breaking-change
description: Flag every change that breaks an existing client of a public contract — a removed or renamed route, method, parameter or field, a new required input, or tightened validation — as CRITICAL, and name the compatible alternative.
---
# Breaking change

A public contract is anything a client outside this change already calls or
reads: HTTP routes, request and response bodies, query and path parameters,
status codes, shared contract types (Zod schemas, DTOs), exported functions of
a published package, CLI flags, events.

## Rules
- Compare every changed contract with its previous version in the diff.
- Report as **CRITICAL** when an existing client stops working without a change on its side:
  - a route removed, or its path or HTTP method changed;
  - a path, query or body field renamed, removed, or its type narrowed;
  - a new **required** request field, header or parameter;
  - validation tightened, so a request that was accepted is now rejected;
  - an exported function, type or CLI flag removed or its signature changed.
- For each finding write the old and the new signature, and the compatible
  alternative: keep the old name as an alias, make the new input optional with
  a default, or add a versioned route next to the old one.
- Not breaking: a new optional field with a default, a new route, looser validation.

## Good — compatible

```ts
// v1 kept, v2 added beside it
app.put('/settings', { schema: { body: z.object({
  automatic_reviews: z.boolean().optional(), // old name still accepted
  auto_reviews: z.boolean().optional(),
}) } }, handler);
```

## Bad — breaks every client that sends the old field

```ts
app.put('/settings', { schema: { body: z.object({
  auto_reviews: z.boolean(), // was `automatic_reviews`; old requests now fail with 422
}) } }, handler);
```
