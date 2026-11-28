# Enforcing the dependency direction

Prose does not stop an import. Put the mechanical part of the ring map into a
check that fails the build, and keep the skill for the judgment calls a check
cannot make (rules 2 to 6 are about signatures and ownership, not only paths).

Read this file when a project has no import-boundary check yet, or when you
change an existing one.

## What a check can and cannot see

| Rule | Checkable by import path | Needs a reader |
|---|---|---|
| ORM and schema only in persistence | Yes | |
| HTTP framework only at the edge | Yes | |
| SDKs only in adapters | Yes | |
| Core does not import adapters (covers rule 1) | Yes | |
| No import from a sibling module | Yes | |
| Row type in a domain signature (rule 2) | Partly: only when the type is imported from a persistence path | Yes, when it is re-exported from an inner path |
| Table ownership (rule 4) | No | Yes |
| Transport in the core (rule 5) | Partly: the framework import | Yes, for status codes and wire shapes |
| Service locator (rule 6) | No | Yes |

## dependency-cruiser

Use it when the project already has it or has no boundary tool. It reads the
real import graph, understands TypeScript path aliases, and has a baseline
mode.

Template; replace the paths with the project's ring map.

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'orm-only-in-persistence',
      severity: 'error',
      from: { path: '^src/', pathNot: '(^|/)repository(\\.ts$|/)|^src/db/|^src/composition-root\\.ts$' },
      to: { path: 'node_modules/drizzle-orm|^src/db/' },
    },
    {
      name: 'http-framework-only-at-the-edge',
      severity: 'error',
      from: { path: '^src/', pathNot: 'routes\\.ts$|^src/(app|server)\\.ts$' },
      to: { path: 'node_modules/(fastify|@fastify)' },
    },
    {
      name: 'core-does-not-import-adapters',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'adapters-do-not-import-features',
      severity: 'error',
      from: { path: '^src/adapters/' },
      // The port file is the exception: the adapter imports it to implement it.
      to: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/ports\\.ts$' },
    },
    {
      name: 'no-import-from-a-sibling-module',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/', pathNot: '^src/modules/($1|_shared)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Without this, `import type` is erased before the check and type leaks pass.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

Notes that cost time when missed:

- `tsPreCompilationDeps: true` is what makes a type-only import visible. Most
  of the leaks this skill is about are type-only.
- `$1` in `to.pathNot` refers to the first capture group of `from.path`. That
  is how one rule covers every module.
- A package resolves to `node_modules/<name>/...`; match on that, not on the
  bare specifier.
- "Adapters do not import features" must exempt the file that holds a
  feature's ports. Without the exemption the adapter cannot import the
  interface it implements, and the only way left is to restate the port's types
  in the adapter, which then drift. Keep ports in a dedicated file
  (`ports.ts`) that contains nothing but interfaces and plain types, so the
  exemption cannot be used to reach feature logic.
- The composition root must be exempt from the "only in persistence" and
  "does not import adapters" rules; naming concrete classes is its job.

## Adopting it in a codebase that already has leaks

Do not fix everything first and do not weaken the rules until they pass.

1. Write the rules for the ring map as it should be.
2. Run once without a baseline and read every violation. A violation that
   shows the rule is wrong (the composition root, a legitimate infrastructure
   file) is fixed in the rule. The rest are real.
3. Record the real ones as the baseline:
   `depcruise src --config <config> --output-type baseline`, saved as
   `.dependency-cruiser-known-violations.json`.
4. Run the check with `--ignore-known`. New violations fail; recorded ones do
   not.
5. The baseline only shrinks. Remove an entry in the change that fixes it.
   Never add an entry to make new code pass.

## Other tools

- **Linter import restrictions** (Biome `noRestrictedImports`, ESLint
  `no-restricted-imports`) can ban a package or a path pattern per folder
  through overrides. Good for "no ORM outside persistence"; weak for relations
  between local folders.
- **eslint-plugin-boundaries** models element types with allow-lists and a
  default of "disallow". A fit when the project already runs ESLint.
- **Architecture tests** (ArchUnitTS, ts-archunit) state the same rules as unit
  tests. A fit when the team wants the rules next to the tests.

One tool is enough. Pick the one the project already runs.
