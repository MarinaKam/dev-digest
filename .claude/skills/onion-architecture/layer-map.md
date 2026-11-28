# Layer map

How to find or write the ring map of a concrete project: which folder and file
is which ring. The rules in [SKILL.md](SKILL.md) are useless until this map
exists, because "inward" has no meaning without it.

Read this file when the project's instruction file has no ring map, when you
add a new kind of file and do not know its ring, or when you set up the
import-boundary check.

## Classify a file by its imports, not by its name

A file's ring is decided by the most outward thing it imports.

| The file imports | Ring |
|---|---|
| Nothing but the language, pure libraries (a validation library, date math) and other domain files | Domain |
| Domain files and ports; no framework, no ORM, no SDK | Application |
| The ORM, the database client, the table schema, a third-party SDK, `fetch`, the filesystem, the environment | Infrastructure |
| The HTTP framework, or concrete classes from several rings in order to wire them | Edge |

Consequences:

- A file called `helpers.ts` that imports the table schema is infrastructure,
  whatever its name says.
- A file called `service.ts` that imports the ORM has left the application
  ring. Either move the query out or accept that the file is infrastructure and
  that nothing in the core may import it.
- A pure library is not an outer ring. Schemas and types from a validation
  library may be imported anywhere.

## Common layouts

### Feature modules with a file per role

```
src/
  modules/<feature>/
    routes.ts         edge
    service.ts        application
    repository.ts     infrastructure
    helpers.ts        domain, if it stays pure
    constants.ts      domain
    types.ts          domain
  adapters/<system>/  infrastructure
  db/                 infrastructure (schema, client, migrations)
  platform/           infrastructure (config, queue, logger, bus)
  container.ts        edge (composition root)
  app.ts, server.ts   edge
```

Ports go to the module that calls them (`modules/<feature>/ports.ts`), or to a
shared contracts package when more than one module or another package needs the
type.

### A folder per ring

```
src/
  domain/           entities, rules, ports, domain errors
  application/      use cases
  infrastructure/   repositories, adapters, schema
  interface/        routes, controllers
  main.ts           composition root
```

The map is the folder names. The remaining work is rule 4: table ownership is
not visible in this layout, so write down which use-case area owns which
tables.

### A pure core package next to the server

When the business engine is its own package (no database, no HTTP, an injected
port for the one side effect), the whole package is the domain ring. The server
imports it; it never imports the server. An SDK imported inside that package is
an adapter living in the core: record it as a deviation or move it out.

## Shared kernels

Most projects have code every module uses. Classify each shared folder too;
"shared" is not a ring.

| Shared thing | Ring | Watch for |
|---|---|---|
| Contract schemas and types used by client and server | Domain | Must stay free of server-only imports |
| Error base classes | Domain, unless they carry a transport status (then see rule 5) | A status code in the base class is a project decision to record |
| Request context helper that reads the framework request | Edge | Services must receive its result, not call it |
| Row types exported from the schema | Infrastructure | Importing them in a service or a rule is rule 2 |
| Logger, config, queue, event bus | Infrastructure | The core takes them as ports or plain values |

## Writing the map down

Put the map in the project's instruction file, not in this skill. Keep it to
what a reader needs to place a file:

1. A four-row table: ring, and the paths that belong to it.
2. Where a new port is declared.
3. The command that runs the import-boundary check, and where its
   known-violations list is.
4. Accepted deviations, each as one sentence that says what to do in new code.

A deviation that is not written down will be copied by some sessions and
"fixed" by others. Writing it down is what makes the codebase consistent.

## When the existing code does not fit any ring cleanly

Do not redraw the map to make every existing file legal.

- Draw the map as it should be.
- Let the import-boundary check list what does not fit, and record that list as
  the baseline (see [enforcement.md](enforcement.md)).
- New code follows the map. Existing files move when a task touches them for
  another reason, or in a change made for that purpose.
