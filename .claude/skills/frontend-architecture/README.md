# frontend-architecture

Human-facing notes for the `frontend-architecture` skill: why it exists, what
it covers, how it relates to other skills, its version, and every source used
in the research. The agent does not load this file; the rules are in
[SKILL.md](SKILL.md) and the three reference files.

## Version

**1.0.0** (2026-11-27). The version is recorded in the `metadata.version`
field of `SKILL.md` and in the changelog below.

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-27 | First version: decision method, defaults for projects without conventions, three reference files |

`metadata.version` is used instead of a top-level `version` key because the
Agent Skills specification defines `metadata` as the place for it. Claude Code
ignores an unknown top-level key, while skill upload and packaging reject it.
`metadata` is a label only: no tool acts on it.

## Need

Questions such as "where does this component go", "is this a helper or a
util", "does this hook belong to the component or to the shared hooks" come up
on almost every frontend change. The official documentation deliberately does
not answer them, and well-known community sources give different answers. An
agent left alone picks a reasonable layout, but not necessarily the same one
twice, and not necessarily the one the project already uses.

## Focus

Structure and organization of code only: **where a file lives, what it is
called, and what it may import.** Nothing about how a component is written.

## What it covers

- A fixed order of authority: written project rules, then neighbouring code,
  then the skill's defaults; and what to do when the first two disagree.
- A five-step method for placing any piece of code by its kind and its real
  consumers (the Scope Rule: local for one consumer, nearest shared folder for
  two, back down when one is left).
- Defaults for a project that has no conventions: folder strategy, component
  folder anatomy, constants, pure functions, hooks, types, file case.
- A definition of helper, util and lib by what the code knows.
- Barrel files: component entry points versus aggregate barrels.
- Component folders: what each sibling file may contain, the order inside a
  file, where extracted pieces go.
- Next.js App Router as structure: thin route files, route-private folders,
  route groups, layouts, placement of special files and of the client
  boundary.

## What it does not cover

Deliberately left to the skill that owns the topic, so no rule exists twice:

- When a component is too large, how to split it, composition, prop count.
- Which kind of state to use, effects, memoization, performance.
- Server versus Client Components as a rendering choice, data fetching,
  caching, the reference for what each special file does.
- Testing, accessibility, styling approach, type design, schema design.

## Target cases

- Adding a component, hook, constant, pure function or type and deciding its
  folder and file name.
- A second screen starts using code that was private to the first.
- A crowded component file whose pieces have to move out.
- Adding or moving a route, layout or route-private folder.
- Setting up the structure of a new project, or reviewing an existing one.
- A project whose written rules and actual code disagree.

## Related skills

| Skill | Owns | Relation |
|---|---|---|
| `react-best-practices` | Component design, splitting criteria, state, effects, memoization, anti-patterns | Decides *that* something is extracted; this skill decides *where* it goes |
| `next-best-practices` | Server and Client Components, data patterns, file-convention reference, metadata | Explains what a route file does; this skill decides where route code is placed |
| `react-testing-library` | How to test components and hooks | This skill only says a test sits beside its subject |
| `typescript-expert` | Type design, `import type`, module configuration | This skill only places type declarations |
| `zod` | Schemas and inferred types | This skill only places schema modules by the same ladder |

Project instruction files (`AGENTS.md`, `CLAUDE.md`) rank above this skill.
Decisions specific to one project belong there, not here.

## Evidence for the scope

Before the skill was written, four placement tasks were given to fresh agents
without it: three in a project with written structure rules, one in an
imagined project with none. All four answers were sound. In the project with
rules, every decision was justified by those rules and by neighbouring
folders. In the project without rules, the agent applied the same
promote-on-second-consumer logic on its own, and made three arbitrary choices
(a `features/` folder, no `index` files, its own meaning for "helpers").

Conclusion that shaped version 1.0.0: the skill does not need to teach the
ladder at length. Its value is the order of authority, the reaction to a
rule-versus-code mismatch, and one fixed set of defaults where a project is
silent.

Three of the tasks were then repeated with the skill available:

- In the project with rules, the skill was picked up without being named and
  the placements did not change; project rules were applied ahead of the
  skill's defaults. The skill added the topic name for the shared module (a
  kind-named `format` file was rejected), no re-export at the old path, and
  moving the test with the code.
- In the project without rules, the answers followed the defaults table. That
  run also exposed nine places where a default was missing or two files
  disagreed (file or folder for a new component, `lib` or `utils`, no path for
  data hooks or shared components). They were fixed, and a second run
  confirmed it and found four smaller ones (nested versus flat child
  components, hook file naming, the home of a domain type, what stays in a
  route file), which were fixed as well. That last round was not re-run.

Limits of this evidence: each task was run once per condition, so stability
between runs was not measured, and the with-skill gain in the project with
rules is small.

## Moving the skill into a plugin

The folder is self-contained: relative links only, one level deep, no project
names or paths. To ship it in a Claude Code plugin, copy the folder to the
plugin's `skills/` directory; the command becomes `/<plugin>:frontend-architecture`.
Version the plugin in its `plugin.json` and keep `metadata.version` here in
step with it.

## Where the sources disagree

The skill takes a default on each of these; the project's own choice always
overrides it.

| Topic | Positions | Skill default |
|---|---|---|
| Folder strategy | Everything under the routes folder (Scope Rule agent, Next.js Learn dashboard) · routes for routing only (Next.js Commerce, Feature-Sliced Design) · hybrid (bulletproof-react) · by type (Comeau) | Hybrid, kept tidy by the promotion ladder |
| Barrel files | A slice's public API (Feature-Sliced Design, Wieruch) vs avoid them (TkDodo, Hagemeister, Atlassian, Vercel) | A component folder's entry point is fine; aggregate barrels are avoided |
| utils vs helpers | Generic vs project-specific (Comeau; Wieruch reports it as what "some teams" do); no official definition | That distinction, plus `lib` for modules that wire the app to the outside |
| Constants | One app-wide file (Comeau) vs module-level beside the consumer (Kondov) | Beside the consumer, promoted by the ladder |
| Query abstraction | Custom hooks as the home for logic vs `queryOptions` first (TkDodo, 2024 and 2026) | Not decided here; follow the project |
| File case | PascalCase files (Airbnb) vs kebab-case (bulletproof-react, Wieruch, Comeau) | Copy the project; one case per kind of file |
| Component size | No threshold, split on real problems (Dodds) vs responsibility test (react-philosophies) vs prop count (Kondov) | Out of scope |

Statements checked word for word against the page (2026-11-27):

- React, legacy FAQ: "React doesn’t have opinions on how you put files into
  folders."
- Next.js 15, project structure: "Next.js is unopinionated about how you
  organize and colocate your project files." and "The simplest takeaway is to
  choose a strategy that works for you and your team and be consistent across
  the project."
- Kent C. Dodds: "Place code as close to where it's relevant as possible"
- Josh W. Comeau: "A helper is something specific to a given project." and "A
  utility is a generic function that accomplishes an abstract task."
- TkDodo: "A barrel is a file that does nothing but re-export things from
  other files." He reports pages "loading over 11k modules" reduced to "about
  3.5k modules - a reduction of 68%" after removing internal barrels.
- Atlassian: "Overall build time per commit saw a 75% reduction in build
  minutes consumed". This is CI minutes per commit, driven largely by fewer
  tests being selected, not bundler speed.
- Marvin Hagemeister: barrel files "are one of the key reasons why JavaScript
  tooling is slow in bigger projects."
- bulletproof-react: "the features can only import from shared parts and the
  app can import from features and shared parts."
- Robert C. Martin: "so should the architecture of a software application
  scream about the use cases of the application."
- "prefer duplication over the wrong abstraction" appears in Kent C. Dodds's
  AHA Programming post, where he attributes it to Sandi Metz.

No source measured one folder strategy against another; every comparison of
strategies found is an argument, not a measurement.

## Sources

All links collected during the research. A link listed here was opened unless
it is in the "Not verified" block.

### Official: React

- Thinking in React: https://react.dev/learn/thinking-in-react
- Keeping Components Pure: https://react.dev/learn/keeping-components-pure
- Reusing Logic with Custom Hooks: https://react.dev/learn/reusing-logic-with-custom-hooks
- You Might Not Need an Effect: https://react.dev/learn/you-might-not-need-an-effect
- Choosing the State Structure: https://react.dev/learn/choosing-the-state-structure
- Sharing State Between Components: https://react.dev/learn/sharing-state-between-components
- Importing and Exporting Components: https://react.dev/learn/importing-and-exporting-components
- Rules of React: https://react.dev/reference/rules
- `'use client'` reference: https://react.dev/reference/rsc/use-client
- Legacy FAQ, File Structure (no longer updated): https://legacy.reactjs.org/docs/faq-structure.html

### Official: Next.js

Unversioned links point to the current documentation; `/docs/15/` links to
version 15.

- Project structure: https://nextjs.org/docs/app/getting-started/project-structure · https://nextjs.org/docs/15/app/getting-started/project-structure
- File-system conventions: https://nextjs.org/docs/app/api-reference/file-conventions · https://nextjs.org/docs/15/app/api-reference/file-conventions
- src folder: https://nextjs.org/docs/app/api-reference/file-conventions/src-folder
- Layouts and Pages: https://nextjs.org/docs/15/app/getting-started/layouts-and-pages
- Route Groups: https://nextjs.org/docs/15/app/api-reference/file-conventions/route-groups
- Dynamic Routes: https://nextjs.org/docs/15/app/api-reference/file-conventions/dynamic-routes
- Parallel Routes: https://nextjs.org/docs/15/app/api-reference/file-conventions/parallel-routes
- Intercepting Routes: https://nextjs.org/docs/15/app/api-reference/file-conventions/intercepting-routes
- loading: https://nextjs.org/docs/15/app/api-reference/file-conventions/loading
- error: https://nextjs.org/docs/15/app/api-reference/file-conventions/error
- not-found: https://nextjs.org/docs/15/app/api-reference/file-conventions/not-found
- template: https://nextjs.org/docs/15/app/api-reference/file-conventions/template
- Error Handling: https://nextjs.org/docs/15/app/getting-started/error-handling
- Production checklist: https://nextjs.org/docs/15/app/guides/production-checklist
- Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components · https://nextjs.org/docs/15/app/getting-started/server-and-client-components
- The Server and Client Boundary: https://nextjs.org/docs/app/guides/server-and-client-boundary
- Fetching Data: https://nextjs.org/docs/app/getting-started/fetching-data
- Data Security: https://nextjs.org/docs/app/guides/data-security
- Client-side data fetching: https://nextjs.org/docs/app/guides/client-side-data-fetching
- TanStack Query guide: https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query
- optimizePackageImports: https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- Architecture (no page on code organization): https://nextjs.org/docs/architecture
- AI coding agents: https://nextjs.org/docs/app/guides/ai-agents
- Learn, Adding Search and Pagination: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination

### Official: other

- TanStack Query, Query Keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- TanStack Query, Query Options: https://tanstack.com/query/latest/docs/framework/react/guides/query-options
- TanStack Query, Does this replace client state: https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state
- TanStack Query, Advanced Server Rendering: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- Redux Style Guide: https://redux.js.org/style-guide/
- TypeScript Handbook, Modules: https://www.typescriptlang.org/docs/handbook/2/modules.html
- Tailwind, Styling with utility classes: https://tailwindcss.com/docs/styling-with-utility-classes
- Vercel, How we optimized package imports in Next.js: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- Vercel, Introducing React Best Practices: https://vercel.com/blog/introducing-react-best-practices

### Named concepts

- Screaming Architecture, Robert C. Martin: https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
- Vertical Slice Architecture, Jimmy Bogard: https://www.jimmybogard.com/vertical-slice-architecture/
- Colocation, Kent C. Dodds: https://kentcdodds.com/blog/colocation
- Scope Rule for Next.js, Gentleman Programming: https://github.com/Gentleman-Programming/gentleman-architecture-agents · https://github.com/Gentleman-Programming/gentleman-architecture-agents/blob/main/.claude/agents/scope-rule-architect-NextJS.md

### Methodologies and reference repositories

- Feature-Sliced Design, overview: https://feature-sliced.design/docs/get-started/overview
- Feature-Sliced Design, layers: https://feature-sliced.design/docs/reference/layers
- Feature-Sliced Design, public API: https://feature-sliced.design/docs/reference/public-api
- Feature-Sliced Design, Next.js: https://feature-sliced.design/docs/guides/tech/with-nextjs
- Feature-Sliced Design, excessive entities: https://feature-sliced.design/docs/guides/issues/excessive-entities
- bulletproof-react, project structure: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- bulletproof-react, project standards: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md
- bulletproof-react, Next.js app (Next 14, React 18): https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app/src
- next-forge, structure: https://www.next-forge.com/docs/structure
- nextgram (parallel and intercepting routes): https://github.com/vercel-labs/nextgram
- Next.js Learn examples (tree read through the API): https://github.com/vercel/next-learn

### Articles

- Kent C. Dodds, AHA Programming: https://kentcdodds.com/blog/aha-programming
- Kent C. Dodds, When to break up a component: https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components
- Kent C. Dodds, State Colocation: https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster
- Dan Abramov, Writing Resilient Components: https://overreacted.io/writing-resilient-components/
- Dan Abramov, Impossible Components: https://overreacted.io/impossible-components/
- Dan Abramov, The Two Reacts: https://overreacted.io/the-two-reacts/
- Josh W. Comeau, Delightful React File/Directory Structure: https://www.joshwcomeau.com/react/file-structure/
- Robin Wieruch, React Folder Structure: https://www.robinwieruch.de/react-folder-structure/
- Robin Wieruch, JavaScript Naming Conventions: https://www.robinwieruch.de/javascript-naming-conventions/
- TkDodo, Please Stop Using Barrel Files: https://tkdodo.eu/blog/please-stop-using-barrel-files
- TkDodo, Effective React Query Keys: https://tkdodo.eu/blog/effective-react-query-keys
- TkDodo, The Query Options API: https://tkdodo.eu/blog/the-query-options-api
- TkDodo, Creating Query Abstractions: https://tkdodo.eu/blog/creating-query-abstractions
- Juntao Qiu, Modularizing React Applications with Established UI Patterns: https://martinfowler.com/articles/modularizing-react-apps.html
- Alex Kondov, Tao of React: https://alexkondov.com/tao-of-react/
- mithi, react-philosophies: https://github.com/mithi/react-philosophies
- Airbnb React/JSX Style Guide (class-component era): https://github.com/airbnb/javascript/tree/master/react
- Makerkit, Next.js App Router Project Structure: https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure
- Abisoye Alli-Balogun, Reusable Architecture for Large Next.js Applications: https://www.freecodecamp.org/news/reusable-architecture-for-large-nextjs-applications/
- Darian Vance, feature-driven folder isolation in large Next.js apps: https://dev.to/techresolve/solved-how-do-you-handle-feature-driven-folder-isolation-in-large-nextjs-apps-25b7

### Barrel-file measurements

- Marvin Hagemeister, The barrel file debacle: https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
- Atlassian, 75% Faster Builds by Removing Barrel Files: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files

### Enforcement tooling

Listed for the idea of linting structure, not as a recommendation to install.

- eslint-plugin-boundaries: https://github.com/javierbrea/eslint-plugin-boundaries · https://www.jsboundaries.dev/docs/quick-start/
- eslint-plugin-import, no-restricted-paths: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
- Steiger: https://github.com/feature-sliced/steiger
- eslint-plugin-unicorn, filename-case: https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md

### Prior art: agent skills

Read as prior art. No text was copied from them.

- vercel-labs/agent-skills: https://github.com/vercel-labs/agent-skills
- react-best-practices: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices · https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md · https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/rules/bundle-barrel-imports.md
- composition-patterns: https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns · https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/composition-patterns/rules/architecture-avoid-boolean-props.md
- vercel-labs/next-skills (skill retired upstream): https://github.com/vercel-labs/next-skills · https://github.com/vercel/next.js/tree/canary/skills

### Skill and plugin authoring

- Agent Skills specification: https://agentskills.io/specification
- Agent Skills, best practices: https://agentskills.io/skill-creation/best-practices
- Agent Skills, optimizing descriptions: https://agentskills.io/skill-creation/optimizing-descriptions
- Agent Skills, evaluating skills: https://agentskills.io/skill-creation/evaluating-skills
- Claude platform, Agent Skills overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Claude platform, skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Claude Code, skills: https://code.claude.com/docs/en/skills
- Claude Code, plugins reference: https://code.claude.com/docs/en/plugins-reference
- Claude Code, create a plugin: https://code.claude.com/docs/en/plugins/create
- Claude Code, install a plugin: https://code.claude.com/docs/en/plugins/install
- Claude Code, plugin loading: https://code.claude.com/docs/en/plugins/loading
- Claude Code, host a marketplace: https://code.claude.com/docs/en/plugins/host-marketplace
- Claude Code, marketplace reference: https://code.claude.com/docs/en/plugins/marketplace-reference
- Claude Code, create a marketplace: https://code.claude.com/docs/en/plugins/create-marketplace
- skill-creator: https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

### Not verified

Could not be opened during the research. No rule in the skill rests on them.

- Dan Abramov, Presentational and Container Components (HTTP 403): https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
- patterns.dev (name did not resolve): https://www.patterns.dev/react/hooks-pattern · https://www.patterns.dev/react/compound-pattern · https://www.patterns.dev/react/presentational-container-pattern
- Mark Erikson, project structure links (not opened): https://raw.githubusercontent.com/markerikson/react-redux-links/master/project-structure.md
- Vercel Conformance rule (search result only): https://vercel.com/docs/conformance/rules/NEXTJS_MISSING_OPTIMIZE_PACKAGE_IMPORTS
- Hireable docs, frontend architecture (search result only): https://hireable-docs.vercel.app/docs/frontend/architecture
- Yuki Onishi, App Router architecture playbook (search result only): https://dev.to/yukionishi1129/building-a-production-ready-nextjs-app-router-architecture-a-complete-playbook-3f3h
