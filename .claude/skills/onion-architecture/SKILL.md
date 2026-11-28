---
name: onion-architecture
description: "Use when backend code in a layered TypeScript service (Fastify or another HTTP framework, Drizzle or another ORM, Zod) crosses a layer: a service or business rule needs a type, an error, an interface or a table that belongs to another layer or another module; when adding a port, an adapter for an external service, a repository method, a domain rule, or wiring in the composition root; when an import-boundary check (dependency-cruiser, lint) fails; when reviewing a backend change for dependency direction. Symptoms: a service imports a row type or the ORM, an interface is declared in the adapter file, a rule takes a database row, a service throws an HTTP status, a repository writes another module's tables, a service receives the whole container. Not for route, plugin or schema mechanics (fastify-best-practices), query and transaction syntax (drizzle-orm-patterns), validation schemas (zod), or table design (postgresql-table-design)."
metadata:
  version: "1.0.0"
---

# Onion Architecture

One rule: **source-code dependencies point inward.** Code in an inner ring
never imports, names or types itself against anything in an outer ring. This
includes `import type`: a type-only import is still a dependency.

Putting the query in the repository and the SDK call in the adapter is the easy
half, and most code already does it. The leaks that survive are quieter: types,
interfaces, errors and table ownership pointing the wrong way. This skill is
about those.

## Step 0: project conventions win

1. Read the project's instruction files (`AGENTS.md`, `CLAUDE.md`, the package
   `README`) for its ring map: which folder or file is which ring, and which
   deviations it has accepted.
2. If the project has an import-boundary check (a dependency-cruiser config, a
   lint rule), read its rules. They are the enforced part of this skill.
3. Apply in this order: a written project rule, then this skill. Neighbouring
   code is not an authority here: an existing leak is not a pattern to copy.
   Leave it alone unless the task is to fix it, and do not add a new one next
   to it.

If the project has no ring map, or a file's ring is unclear, read
[layer-map.md](layer-map.md): it classifies a file by its imports, shows the
common layouts, and says how to write the map down. Propose the map to the user
before writing code, and record it in the project's instruction file.

## The rings

From the inside out. A ring may import its own ring and any ring further in.

| Ring | Holds | Knows nothing about |
|---|---|---|
| **Domain** | Entities and value types, pure business rules, domain errors, ports (interfaces the core needs from the outside) | Framework, ORM, SDKs, HTTP, environment, clock or filesystem access |
| **Application** | Use cases: services that load, decide by calling domain rules, and save through ports | Framework request and reply, ORM, SQL, concrete adapters |
| **Infrastructure** | Repositories, adapters for external systems, database schema and client | Routes, the HTTP framework |
| **Edge** | Routes and controllers, the composition root, process bootstrap | — (it may import everything) |

A project does not need a folder per ring. A ring is a rule about imports, and
a file belongs to the ring of its most outward import.

## Where a piece of code goes

Ask what it needs to know, then pick the innermost ring that can hold it.

| The code | Ring | Note |
|---|---|---|
| A rule that decides from values ("may this be deleted?") | Domain | Takes plain values, returns a value. No `await`. |
| An interface the core calls and the outside implements | Domain or application, next to its consumer | Never in the adapter's file. |
| Orchestration: load, check a rule, save, notify | Application | No SQL, no request object. |
| A query, a row lock, a transaction body | Infrastructure (repository) | Returns plain values. |
| A call to a third-party SDK or `fetch` | Infrastructure (adapter) | Implements a port. |
| Parsing the request, choosing the status code, shaping JSON | Edge | Validate once, here. |
| `new` of an adapter or a repository | Edge (composition root) | The only place that names concrete classes. |

## The rules

Each one closes a leak that passes review because the code "is in the right
file".

### 1. A port lives with its consumer

The interface is declared in the ring that calls it. The adapter imports the
port and implements it; the core never imports from the adapter's file, not
even for a type.

```ts
// core: notifications.port.ts
export interface RunNotifier {
  runFinished(run: FinishedRun): Promise<void>;
}

// infrastructure: adapters/slack/webhook.ts
import type { RunNotifier } from '../../core/notifications.port.js';
export class SlackWebhookNotifier implements RunNotifier { /* fetch */ }
```

Name the port after what the core wants (`RunNotifier`), not after the vendor
(`SlackClient`). Its parameters are domain values, not the vendor's payload.

Keep ports in a file that holds only interfaces and plain types (`ports.ts`, or
the name the project uses). The adapter imports that file and writes
`implements`; do not restate the port's types inside the adapter to avoid the
import, because two copies drift. If an import-boundary check blocks the
adapter from importing the port file, the check is missing an exemption: fix
the rule, not the code.

### 2. Domain rules take domain values, not rows

A type inferred from a table (`typeof table.$inferSelect`, a `Row` type
exported by a repository) is an infrastructure type. A rule or a service
signature that names it depends on the schema.

```ts
// leak: the rule changes whenever a column is added
export function canDelete(agent: AgentRow, hasActiveRun: boolean): boolean

// inward: the rule states exactly what it needs
export function canDelete(agent: { isBuiltIn: boolean }, hasActiveRun: boolean): boolean
```

A repository returns domain types. If the row and the domain type have the same
shape today, declare the domain type anyway and let the repository return it;
structural typing makes that free. Map explicitly once the shapes differ.

### 3. The transaction stays in infrastructure; the decision stays in the core

The service owns *that* a set of steps is one unit and *which* rule is checked
inside it. The repository owns *how*: the transaction, the lock, the statements.
The ORM's transaction handle never appears in a service signature.

```ts
// application
await agents.inTransaction(async (tx) => {
  const agent = await tx.findForUpdate(workspaceId, id);
  if (!agent) return 'not_found';
  if (!canDelete(agent, await tx.hasActiveRun(id))) throw new AgentInUse(id);
  await tx.delete(id);
});
```

`tx` here is the same repository interface bound to a transaction, not the ORM
object. Add a wider unit-of-work abstraction only when one use case must commit
through two repositories; not before.

### 4. A module writes only its own tables

A repository reads and writes the tables its module owns. When a use case must
change another module's data, call that module's repository or service through
the composition root, inside the same unit of work if it must be atomic. Do not
add another module's `delete` to your repository because it was the short way.

A read that joins across modules for one screen is a read model. It may live in
the repository of the module that serves the screen, and it must not be reused
for writes.

### 5. The core does not speak the transport

- **Errors.** The core throws an error that names what happened
  (`AgentInUse`, `NotFound`). The edge maps it to a status code in one place.
  An error class that carries a status code in the core is a leak.
- **Shapes.** The service returns domain values. Field renaming for the wire
  (`snake_case`, envelopes, pagination wrappers) happens at the edge.
- **Context.** The service receives `workspaceId`, `userId` as values, never
  the request.

### 6. A service receives what it uses

A constructor or function takes the ports and repositories it calls, not the
whole container, and does not construct them itself.

```ts
// leak: service locator; the service can reach everything and builds its own repo
constructor(container: Container) { this.repo = new StatsRepository(container.db); }

// inward: the composition root builds, the service declares its needs
constructor(private readonly stats: StatsReader) {}
```

### When a project has accepted a deviation

Rules 5 and 6 are the ones existing codebases most often decide against, for
example a shared error base class with a status code, or services that take the
container. If the project's instruction file records that decision, follow the
project in the code you add and do not mix two styles in one module. If nothing
is recorded and the neighbouring code deviates, follow the neighbouring code for
these two rules only, and tell the user so the decision gets written down.
Rules 1 to 4 have no such exception.

## Do not over-build

Onion is a rule about import direction, not a file count.

- No interface for a repository that has one implementation and is replaced in
  tests by a real database. Add the interface when a second implementation or a
  unit test needs it.
- No port around the HTTP framework or the ORM "in case we switch". Keeping
  them out of the inner rings is enough.
- No domain entity for a read that only shapes rows for a screen.
- No dependency-injection library when a hand-written composition root is one
  file.
- No mapper when the two types are structurally identical; declare the inner
  type and return it.

## Check before you finish

1. List the imports of every file you added or changed, `import type`
   included. Does any point to a ring further out?
2. Does a signature in the domain or application ring name a row type, an ORM
   type, a request type or a vendor type?
3. Is every new interface declared on the consumer's side?
4. Does every write go to a table the module owns?
5. Run the project's import-boundary check if it has one. If the project keeps
   a list of known violations, never add to it to make new code pass.

## Red flags

| Thought | What is true |
|---|---|
| "It's only a type import" | A type import is a dependency; the inner file now changes with the outer one. |
| "The interface sits next to its implementation, like the others" | Then every consumer imports the adapter. Declare it with the consumer. |
| "The row already has every field I need" | So will a domain type with those fields, and it will not follow the schema. |
| "It's one fetch call, no framework needed" | One adapter file and one port is not a framework. The call still goes outside. |
| "It's faster to delete their rows from my repository" | Then two modules write one table and neither owns its invariants. |
| "The neighbouring file does it this way" | An existing leak is a known violation, not a convention. |
| "I'll add it to the known-violations list for now" | That list only shrinks. |

## Boundaries with other skills

- **fastify-best-practices** owns routes, plugins, decorators, hooks and error
  handlers. Its repository and service examples take the framework instance as
  an argument; under this skill they take the database client or a port
  instead.
- **drizzle-orm-patterns** owns schema, query, relation and transaction
  syntax. This skill only says which ring may contain them.
- **zod** owns schemas and parsing, including "validate at the boundary".
  A schema that describes a contract may be imported by any ring; a schema is a
  pure value.
- **postgresql-table-design** owns tables, types, indexes and constraints.
- **security** owns authentication, authorization and input handling.

For a ready set of import rules and how to adopt them without fixing the whole
codebase first, read [enforcement.md](enforcement.md). The research behind the
rules, with every source, is in [README.md](README.md); it is for people and is
not needed to apply the skill.
