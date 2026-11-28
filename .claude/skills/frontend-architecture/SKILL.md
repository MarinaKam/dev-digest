---
name: frontend-architecture
description: "Decides where frontend code lives and how it is structured in React and Next.js App Router projects: folder strategy, component folder anatomy, constants, helpers vs utils vs lib, placement of hooks and business logic, import boundaries, route folders. Use when adding, moving, extracting or splitting a file and the right location is not obvious, when asking 'where should this go', when a second screen starts using existing code, when setting up or reviewing a project's folder structure, or when a project has no written structure conventions yet. Not for how a component is written: splitting criteria, state, effects and anti-patterns belong to react-best-practices; Server Components, data fetching and file-convention reference belong to next-best-practices; tests belong to react-testing-library."
metadata:
  version: "1.0.0"
---

# Frontend Architecture

Answers one question: **where does this code live, and what is the file
called?** It does not cover how a component is written; see
[Boundaries with other skills](#boundaries-with-other-skills).

Official React and Next.js documentation takes no position on folder structure,
so there is no single correct layout. What makes a codebase navigable is that
one question always gets the same answer. This skill gives a method for finding
that answer in an existing project, and defaults for a project that has none.

## Step 0: project conventions win

Do this before applying anything below.

1. Read the project's instruction files (`AGENTS.md`, `CLAUDE.md`, the package
   `README`) for rules on structure and naming.
2. Open two neighbouring folders of the same kind as the one you are about to
   create and note what they actually contain.
3. Apply in this order: a written project rule, then the neighbouring code,
   then the defaults in this skill.

If a written rule and the existing code disagree, do not pick one silently.
Follow the written rule for new code and tell the user about the mismatch, so
the rule or the code can be fixed. An agent that sometimes obeys the rule and
sometimes copies the neighbour makes the structure worse than either choice.

## Principles

1. **The structure says what the app does.** Top-level folders under the routes
   are named after screens and business areas, not only after technical kinds.
2. **Colocate.** Code lives next to its only consumer, because things that
   change together are then found and deleted together.
3. **Scope decides the home.** One consumer: stay local. A second real
   consumer: move to the nearest folder both share. Back to one consumer: move
   back down. Never move something up for a consumer that does not exist yet;
   a wrong shared abstraction costs more than a short duplication.
4. **Dependencies point one way.** Routes depend on shared components, shared
   components depend on shared logic. Shared code never imports from a route,
   and one route never imports another route's private files.
5. **Separate what changes for different reasons.** Markup, stateful
   orchestration (hooks), pure logic and fixed values each have a place, so a
   rule can be tested without rendering and a style can change without
   touching logic.
6. **One convention per kind of file.** Consistency matters more than which
   convention it is.

## Where does this go: five steps

1. **Name the kind.** Component, hook, pure function, constant, type, style,
   user-facing text, or a route file.
2. **Count the real consumers today.** Planned consumers do not count.
3. **Find the nearest folder that contains all consumers.** That folder is the
   home:

   | Consumers | Home |
   |---|---|
   | One component | That component's file or folder |
   | Several components of one route | That route's private folder |
   | Routes under the same parent segment | The parent segment's private folder |
   | Unrelated routes | The shared area (next step decides which part) |

   A component that has a meaning on its own (a badge, a filter bar, a card)
   sits flat in the route's private folder, beside the screen that renders
   it. Nest a component inside its parent's folder only when it is a part of
   that parent: it is named after the parent, makes no sense without it, and
   would be deleted with it (`OrderRow` and its `OrderRowActions`).

4. **Pick the shared area by what the code knows.**
   - A component that knows a business area (orders, billing): shared
     components, in a folder for that area.
   - A visual primitive with no business meaning: the UI kit.
   - A data hook: the shared hooks location, grouped by domain.
   - Any other module (a domain rule, a generic utility, an API client,
     config): the shared modules location, one topic per file.
5. **Check the direction.** After the move, list the imports. If anything
   shared now imports from a route, or a route imports another route's private
   folder, the home is wrong: move the code one level up instead.

When a second consumer appears, move the code and its test together, update
every import, and leave no re-export behind at the old path.

## Defaults for a project without conventions

Use these only for decisions the project has not made. State the choice to the
user when you introduce one, so it can be written into the project's
instructions.

| Decision | Default |
|---|---|
| Folder strategy | Hybrid: route-private code inside the route folder, shared code outside the routes folder |
| Route-private code | `src/app/<route>/_components/`, plus `constants.ts` and `helpers.ts` beside `page.tsx` when several of the route's components share them |
| Imports between routes | A route may import from its own and its ancestors' private folders, never from a sibling route's |
| Shared components | `src/components/<area>/<Name>/` for components that know a business area; `src/components/ui/<Name>/` for primitives that do not |
| Shared modules | `src/lib/<topic>.ts`: one folder for domain rules, generic utilities and integrations alike; no separate `utils/` |
| Data hooks | `src/hooks/<domain>.ts`, with the query keys for that domain in the same file |
| UI hooks | `hooks/useThing.ts` inside the folder of the one component that uses it |
| Component | A folder from the start: `Name/Name.tsx` and `Name/index.ts`; other files are added only when they have content |
| Component public surface | The folder's `index` re-exports that one component; no aggregate barrels in app code |
| Constants | In the consumer's file; the folder's `constants` file once a second file there needs them |
| Pure functions | `helpers` file beside the consumer; `src/lib/<topic>.ts` once promoted |
| Types | Props type in the component file; a domain type, its schema and its enums in that domain's shared module, `src/lib/<domain>.ts` |
| File case | PascalCase for a component file and its folder; `useThing.ts` for a file that holds one hook; kebab-case for every other file and folder, including the per-domain data-hook files |

Vocabulary, because these three words are used loosely:

- **helper**: a pure function that knows this project's domain and has
  consumers in one component or route. Lives beside them.
- **util**: a pure function that knows nothing about this project and could be
  copied into another one unchanged.
- **lib**: the shared folder for non-component modules. A promoted helper and
  a util both land here; the difference between them is what the code knows,
  not which folder holds it.

At the shared level, name a module after its topic (`money`, `order-rules`),
not after its kind. A shared `utils` or `helpers` file with unrelated
functions becomes a place nobody can search or delete from.

## Reference files

Read only the one the task needs.

- [folder-structure.md](folder-structure.md): read when choosing or reviewing
  a project-level layout, deciding where shared code goes, or placing
  constants and pure functions. Strategies with trade-offs, the promotion
  ladder with example trees, barrel files, naming case.
- [component-organization.md](component-organization.md): read when a
  component file is crowded and pieces have to move out, or when creating a
  component folder. Folder anatomy, order inside a file, where extracted
  logic, hooks and child components go.
- [nextjs-organization.md](nextjs-organization.md): read when adding or moving
  a route, layout or route-private folder in the App Router. Thin pages,
  private folders, route groups, nested layouts, where the client boundary
  sits in the tree.

`README.md` in this folder is for people (scope, sources, changelog); it adds
no rules.

## Boundaries with other skills

| Question | Owner |
|---|---|
| Where does this file live, what is it called, what may it import | this skill |
| When is a component too big, how to split it, composition, prop count | `react-best-practices` |
| Which kind of state (local, lifted, URL, server cache), effects, memoization | `react-best-practices` |
| Server vs Client Components, data fetching, special-file reference, metadata | `next-best-practices` |
| How and where to test a component or hook | `react-testing-library` |
| Type design, `import type`, module resolution | `typescript-expert` |
| Schema definition and inferred types | `zod` |

This skill names the destination of an extracted piece; the decision to
extract it belongs to the skill that owns the reason.
