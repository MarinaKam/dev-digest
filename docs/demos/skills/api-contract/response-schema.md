---
name: response-schema
description: Check every change to the shape of a response — removed or renamed fields, changed types, a field that becomes optional or nullable, a changed status code or error body — and report what existing readers can no longer parse.
---
# Response schema

A response is a promise to every reader of it: the web app, other services,
scripts, and the shared contract types they are generated from.

## Rules
- Find what each changed route returns: the response schema, the serializer or
  DTO mapper, the status codes, the error body. Compare with the previous version.
- **CRITICAL**:
  - a response field removed or renamed;
  - a field's type changed (number → string, object → array, enum values removed);
  - a field that was always present becomes optional or nullable;
  - the success status changed (200 → 201/204) or the error body changed shape;
  - the server-side contract type changed and the client copy was not.
- **WARNING**:
  - a new enum value that readers may not handle;
  - order or pagination of a list changed without a note.
- Not breaking: a new optional field.
- Name the reader that breaks when you can see it in the diff, and give the
  compatible alternative: keep the old field and add the new one beside it.

## Good — field kept while the new one is added

```ts
return {
  automatic_reviews: settings.autoReviews, // still sent for old readers
  auto_reviews: settings.autoReviews,
  theme: settings.theme,
};
```

## Bad — a field silently disappears from the response

```ts
// `theme` was returned before this change
return { auto_reviews: settings.autoReviews };
```
