# Control experiment: API Contract Reviewer, route change

Demo PR against `server/`. It changes `PUT /settings` in a copy-paste-ready way:
one request body field is renamed and one response field is removed. The API
Contract Reviewer with its linked skills (`route-signature-breaking-change`,
`response-shape-compat`) should flag both as breaking. Apply these changes on a
throwaway branch only when the experiment is run; this document is the
instruction set and does not change the code.

The route is `server/src/modules/settings/routes.ts`, `PUT /settings`. Its body
schema is `SettingsUpdate` (`Settings.partial()` in
`server/src/vendor/shared/contracts/platform.ts`). `Settings` is `passthrough`,
so unknown body keys are accepted without an error.

## Change 1: request body field rename

File: `server/src/vendor/shared/contracts/platform.ts`, inside `SettingsKnown`.

Replace

```ts
  automatic_reviews: z.boolean().default(false),
```

with

```ts
  auto_reviews: z.boolean().default(false),
```

Mirror the same line into `client/src/vendor/shared/contracts/platform.ts`
(the project rule is that both copies match). The reviewer should still see only
the server diff.

## Change 2: response field removed

File: `server/src/modules/settings/routes.ts`, the `PUT /settings` handler.

Replace

```ts
  app.put('/settings', { schema: { body: SettingsUpdate } }, async (req) => {
    const { workspaceId, userId } = await getContext(container, req);
    return service.update(workspaceId, userId, req.body);
  });
```

with

```ts
  app.put('/settings', { schema: { body: SettingsUpdate } }, async (req) => {
    const { workspaceId, userId } = await getContext(container, req);
    const saved = await service.update(workspaceId, userId, req.body);
    const { theme: _theme, ...response } = saved;
    return response;
  });
```

Note: `_theme` is unused. That is intentional for the demo; the linter may warn on it.

## What the API Contract Reviewer with skills should flag

- **Request body rename, `automatic_reviews` to `auto_reviews`**: CRITICAL under
  `route-signature-breaking-change` ("Request body field renamed"). The skill
  should name the old and new field and suggest keeping `automatic_reviews` as an
  alias or making the new field optional beside it.
- **Why the rename is silent**: `Settings` is `passthrough`, so a client that still
  sends `automatic_reviews` gets a 200, the value is stored as an unknown key, and
  the new `auto_reviews` defaults to `false`. A strong review also points this out,
  because the client gets no error. This is an added risk, not a separate rule.
- **Response field removed, `theme`**: CRITICAL under `response-shape-compat`
  ("A response field removed or renamed"). The skill should name the client code
  that reads `theme` when it can see it in the diff, and suggest keeping the field.
- **Shared contract change**: the `platform.ts` change is a shared contract change
  for `reviewer-core` and the client. The reviewer should check that the client
  copy changes in the same PR (`response-shape-compat`, "shared contract type
  changed on the server side without the client copy").
- **Not to flag**: the `_theme` lint warning is a code-quality matter, not an API
  contract matter. The API Contract Reviewer should not report it.

## What a correct run looks like

- Verdict `request_changes`, with at least two CRITICAL findings: the body rename
  and the response removal.
- Each finding cites a real line in the diff and gives the compatible alternative.
