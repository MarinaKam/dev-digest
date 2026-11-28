# onion-architecture

Human-facing notes for the `onion-architecture` skill: why it exists, what it
covers, how it relates to other skills, its version, and every source used in
the research. The agent does not load this file; the rules are in
[SKILL.md](SKILL.md), [layer-map.md](layer-map.md) and
[enforcement.md](enforcement.md).

## Version

**1.0.0** (2026-11-27). The version is recorded in the `metadata.version`
field of `SKILL.md` and in the changelog below.

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-27 | First version: ring model, six dependency-direction rules, enforcement reference |

## Need

A backend that is already split into routes, services, repositories and
adapters still leaks in ways a file layout does not show: an interface declared
in the adapter's file, a business rule typed against a database row, an HTTP
status inside a service, one module's repository deleting another module's
rows. Each of these makes an inner part of the system change when an outer part
changes, which is what the layering was meant to prevent.

## Focus

The direction of source-code dependencies in a layered TypeScript backend:
**what an inner ring may import, name and type itself against.** Not how a
route, a query or a schema is written.

## What it covers

- A four-ring model (domain, application, infrastructure, edge) defined by
  imports, not by folders, and a table for placing a piece of code.
- Six rules: ports live with the consumer; domain rules take domain values, not
  rows; the transaction stays in infrastructure while the decision stays in the
  core; a module writes only its own tables; the core does not speak the
  transport; a service receives what it uses.
- Which two rules a project may decide against, and how the skill behaves when
  it has.
- What not to build: interfaces, mappers, entities and DI libraries added for
  form.
- A self-check and a red-flags table.
- `layer-map.md`: how to classify a file by its imports, the common project
  layouts, shared kernels, and how to write a project's ring map down.
- `enforcement.md`: what an import check can and cannot see, a
  dependency-cruiser template, and how to adopt it with a baseline.

## What it does not cover

- Fastify routes, plugins, decorators, hooks: `fastify-best-practices`.
- Drizzle schema, queries, relations, transaction syntax:
  `drizzle-orm-patterns`.
- Zod schemas and where to validate: `zod`.
- Table design: `postgresql-table-design`.
- Authentication, authorization, input handling: `security`.
- Tactical DDD (aggregates, domain events, CQRS). The skill uses "domain" for
  pure rules and types only.
- The project's ring map. That is project-specific and lives in the project's
  instruction file.

## Target cases

- Adding an integration with an external service.
- Adding a business rule that needs data from the database.
- A use case that must change several tables atomically, or touch another
  module's data.
- Wiring a new dependency into the composition root.
- Reviewing a backend change, or fixing a failed import-boundary check.

## Related skills

| Skill | Relation |
|---|---|
| `fastify-best-practices` | Owns the edge. Its repository and service examples receive the framework instance; under this skill they receive the database client or a port. This is the one place the two disagree. |
| `drizzle-orm-patterns` | Owns everything inside the repository. |
| `zod` | Owns boundary validation; this skill does not restate it. |
| `postgresql-table-design` | Owns the schema. |
| `frontend-architecture` | The same idea for the client: dependencies point one way. No shared rules. |

## Evidence for the scope

Three baseline runs were made before the skill was written: an agent without
the skill, in a repository whose instruction file already says "routes ->
service -> repository" and "external systems only through the container",
produced a diff for each task. Nothing was applied or executed.

| Task (with pressure) | Got right without the skill | Leaks that remained |
|---|---|---|
| Urgent statistics endpoint ("demo in 20 minutes", the neighbouring route queries the database inline) | Query in a new repository, route delegates | Service takes the whole container and constructs its repository; wire-format shape built in the service |
| Notification to an external webhook ("one fetch call, no framework, merge today") | `fetch` in a new adapter, secret through the container, never fails the caller | Port declared in the adapter file, so the feature code and the composition root type against `adapters/` |
| Atomic delete with two business rules ("two hours already lost") | Rules in the service, SQL and transaction in the repository, transaction handle not exposed | Rule typed against a row type from the repository; error with an HTTP status thrown by the service; repository deletes another module's tables |

Conclusions that shaped the skill:

- "Put the query in the repository" and "put the SDK in the adapter" did not
  fail, so the skill does not restate them as rules. They are one row each in
  the placement table.
- The five leaks in the right column became rules 1, 2, 4, 5 and 6. Rule 3 is
  kept because the atomic-delete run solved it well and the solution is worth
  fixing as the default.
- Limit of this evidence: one run per task, in one repository that already
  documents its layers. A project with no such instructions may fail the easy
  half too; that was not tested.

### The same tasks with the skill

Two of the three tasks were repeated in the same repository with the skill
installed and linked from the instruction file. The agents were not told about
the skill. Again a diff only; nothing was applied or executed.

| Task | Leak without the skill | With the skill |
|---|---|---|
| Atomic delete | Rule typed against a row type | Rule takes `{ isBuiltIn: boolean }` |
| Atomic delete | Repository deletes another module's tables | Each repository touches its own tables; the composition root binds both to one transaction |
| Atomic delete | Error with an HTTP status thrown by the service | Unchanged, as the project records it as an accepted deviation |
| Webhook notification | Port declared in the adapter file | Port declared next to its consumer, named after what the core wants |

The webhook run also exposed a defect in the first version of the import
rules: "adapters do not import features" blocked the adapter from importing
the port, so the agent restated the port's types in the adapter. The rule now
exempts the port file, and rule 1 and `enforcement.md` say so. That fix and
`layer-map.md` were added after these runs and have not been re-run.

The statistics task was not repeated: its two leaks are the accepted
deviations.

## Moving the skill into a plugin

The skill folder is self-contained: no project name, path or command appears in
`SKILL.md` or `enforcement.md`. What stays behind in a project is its ring map
and its accepted deviations (in the instruction file) and its import-check
config.

## Where the sources disagree

- **Is Onion different from Hexagonal and Clean?** Palermo presents Onion as a
  pattern of its own; Seemann argues layers with dependency inversion, ports and
  adapters and onion are the same idea drawn differently; Graça merges them.
  The skill takes the common part, the inward dependency rule, and does not
  argue the names.
- **Interface per repository.** Classic Onion puts every repository behind an
  interface in the core. Normand, Rentea and Jovanović warn that this is where
  over-engineering starts. The skill asks for the interface only when a second
  implementation or a unit test needs it.
- **Where the transaction is opened.** The Sentry article opens it at the
  controller and passes it down; DDD sources use a unit of work owned by the
  application layer. The skill keeps the handle inside infrastructure and gives
  the service a repository bound to the transaction.
- **Queries through the domain.** Strict readings route every read through
  entities; Jovanović and others read straight from the database for screens.
  The skill allows a read model in the repository.

## Sources

Read as search excerpts unless marked otherwise; the full texts were not read
end to end.

### The pattern

- Jeffrey Palermo, The Onion Architecture, part 1:
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Part 2: https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
- The series, including part 4 "After Four Years":
  https://jeffreypalermo.com/tag/onion-architecture
- Mark Seemann, Layers, Onions, Ports, Adapters: it's all the same:
  https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same/
- Herberto Graça, Onion Architecture:
  https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85
- Herberto Graça, DDD, Hexagonal, Onion, Clean, CQRS: How I put it all
  together (Explicit Architecture):
  https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
- Robert C. Martin, The Clean Architecture (the dependency rule):
  https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Matthias Noback, Layers, ports & adapters, part 3:
  https://matthiasnoback.nl/2017/08/layers-ports-adapters-part-3-ports-adapters

### Node.js and TypeScript

- Khalil Stemmler, Clean Node.js Architecture:
  https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/
- Remo Jansen, Implementing the Onion Architecture in Node.js with TypeScript
  and InversifyJS:
  https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad
- marcoturi/fastify-boilerplate (Fastify 5, clean architecture):
  https://raw.githubusercontent.com/marcoturi/fastify-boilerplate/main/README.md
- Sairyss, Domain-Driven Hexagon (TypeScript and NestJS examples):
  https://dev.to/sairyss/domain-driven-hexagon-18g5
- The Software House, Hexagonal architecture overview:
  https://tsh.io/blog/hexagonal-architecture
- Allegro Tech, Onion Architecture:
  https://blog.allegro.tech/2023/02/onion-architecture.html
- AWS Prescriptive Guidance, hexagonal architecture best practices:
  https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html

### Tools in the stack

- Fastify, Encapsulation: https://fastify.dev/docs/latest/Reference/Encapsulation.md
- Fastify, Decorators:
  https://github.com/fastify/fastify/blob/main/docs/Reference/Decorators.md
- Drizzle ORM, Transactions: https://orm.drizzle.team/docs/transactions
- Sentry, Atomic repositories in Clean Architecture and TypeScript:
  https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript

### Enforcement tooling

- dependency-cruiser, rules reference:
  https://raw.githubusercontent.com/sverweij/dependency-cruiser/HEAD/doc/rules-reference.md
- dependency-cruiser, rules tutorial:
  https://raw.githubusercontent.com/sverweij/dependency-cruiser/HEAD/doc/rules-tutorial.md
- lastminute.com, How we enforce architecture boundaries at scale:
  https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/
- Biome, noRestrictedImports:
  https://biomejs.dev/linter/rules/no-restricted-imports/
- eslint-plugin-boundaries:
  https://github.com/javierbrea/eslint-plugin-boundaries
- ArchUnitTS: https://github.com/LukasNiessen/ArchUnitTS

Checked by running, not by reading: dependency-cruiser 17.4.3 supports
`--output-type baseline`, `--ignore-known`, `tsPreCompilationDeps` and `$1`
group references in `to.pathNot`.

### Warnings against over-building

- Eric Normand, Don't overcomplicate the onion architecture:
  https://ericnormand.me/dont-overcomplicate-the-onion-architecture/
- Victor Rentea, Overengineering in Onion/Hexagonal Architectures:
  https://victorrentea.ro/blog/?p=351
- Milan Jovanović, Why Clean Architecture Is Great For Complex Projects:
  https://www.milanjovanovic.tech/blog/why-clean-architecture-is-great-for-complex-projects
- Marco Lenzo, The Clean Architecture Trap:
  https://dev.to/marcolenzo/the-clean-architecture-trap-241k

### Not verified

- Domain-Driven Hexagon, original repository. Only forks appeared in search
  (https://github.com/thecooldrop/domain-driven-hexagon); the original is
  believed to be https://github.com/Sairyss/domain-driven-hexagon and was not
  opened.
- Named in the course material, not found by search, so the links are not
  confirmed: the Palermo example repository
  (https://github.com/Jordiag/Jeffrey-Palermo-Onion-Architecture), dyarleniber
  "Hexagonal Architecture and Clean Architecture (with examples)" on dev.to,
  Saad Hasan "Ports and Adapters explained with two real codebases", Alex
  Rusin "Future-Proof Your Code: Ports & Adapters".
- Whether Biome applies `noRestrictedImports` inside an `overrides` block. The
  rule and the override mechanism are both documented; the combination was not
  found in the docs and was not run.
