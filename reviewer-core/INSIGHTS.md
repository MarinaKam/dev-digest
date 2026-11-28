# reviewer-core — insights

Things learned while working in `reviewer-core/` that the code does not show.

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

## What Doesn't Work
<!-- Failed approaches, dead ends and antipatterns, each with the reason it failed. -->

## Codebase Patterns
<!-- Conventions and architecture decisions specific to this module. -->
- **2026-11-27** — Skills are rules, not data, so they are not wrapped with `wrapUntrusted`: each is its own `<skill name version>` block, every `<skill`/`</skill` in its text is neutralised case- and space-insensitively, and a trusted `SKILL_RULE` is appended to the system message only when a skill is present. An agent with no skill gets a byte-identical prompt. Evidence: `reviewer-core/src/prompt.ts:58`.

## Tool & Library Notes
<!-- Quirks and gotchas of dependencies and tooling. -->
- **2026-11-27** — A model chooses the language of its findings itself unless the prompt fixes it: `openrouter/deepseek/deepseek-v4-flash` returned a whole review of an English diff in Chinese (PR #8 in the fork, 3 findings), after earlier runs of the same agent on the same PR came back in English. The agent's own system prompt is not the place for the rule, because every agent needs it; it is the trusted `OUTPUT_LANGUAGE` block that `assemblePrompt` appends after the injection guard. Evidence: `reviewer-core/src/prompt.ts:32`.
- **2026-11-27** — `test/run.test.ts` imports the server's mock adapters (`../../server/src/adapters/mocks.js`), so every import those files make is resolved by this package's Vitest. When a server adapter imports `@devdigest/reviewer-core` by name, the suite fails with "Failed to load url @devdigest/reviewer-core" until `vitest.config.ts` aliases that name to `src/index.ts`. `npm run typecheck` does not show it: the tsconfig includes only `src/`. Evidence: `reviewer-core/vitest.config.ts:12`.

## Recurring Errors & Fixes
<!-- Errors seen more than once, with the fix. -->
- **2026-11-27** — A change to `assemblePrompt`'s input shape is also consumed by the server's own prompt tests (`server/test/prompt-structured.test.ts`, `prompt-callers.test.ts`), which `npm test` here does not run and the server's `tsconfig` does not type-check. Run the server unit lane after any change to `PromptParts`. Evidence: `server/test/prompt-structured.test.ts:17`.

## Session Notes
<!-- What a session accomplished or decided, one line per point, under a `### YYYY-MM-DD` subheading. -->

## Open Questions
<!-- What was left unresolved or needs more investigation. -->
