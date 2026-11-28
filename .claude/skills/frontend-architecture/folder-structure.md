# Folder structure

Project-level layout, the promotion ladder, constants, pure functions, barrel
files and naming case. Examples use a neutral order-management app.

## Contents

- [Strategies](#strategies)
- [The promotion ladder](#the-promotion-ladder)
- [Constants](#constants)
- [helpers, utils, lib](#helpers-utils-lib)
- [Barrel files](#barrel-files)
- [Naming case](#naming-case)
- [Enforcing boundaries](#enforcing-boundaries)

## Strategies

Four layouts are in real use. None is official: the frameworks describe
several and tell you to choose one and stay consistent.

| Strategy | Shape | Fits | Cost |
|---|---|---|---|
| By type | `components/`, `hooks/`, `helpers/` at the top | Small apps, one team | A feature is spread over every folder; deleting one is a search |
| Everything in the routes folder | Each route holds its own components, hooks, logic | Apps where screens share little | Shared code has no obvious home and drifts into a route |
| Routes for routing only | Route files only re-export; all code in feature folders outside | Large apps, several teams, strict layering | Two trees to keep in sync; more indirection for a small app |
| Hybrid | Route-private code inside the route; shared components and logic outside | Most product apps | Needs the promotion rule below to stay tidy |

Default to the hybrid when the project has not chosen. It keeps a screen's
code in one place and still gives shared code a home.

Do not migrate an existing project from one strategy to another as a side
effect of a feature. Follow what is there and raise the question separately.

## The promotion ladder

One component, `OrderStatusBadge`, as its consumers grow:

```
# 1. Used by the orders list only: private to that route
src/app/orders/_components/OrderStatusBadge/OrderStatusBadge.tsx

# 2. The order detail page needs it too. Both routes sit under orders/,
#    so the nearest shared folder is unchanged: nothing moves.
src/app/orders/_components/OrderStatusBadge/OrderStatusBadge.tsx
src/app/orders/[orderId]/page.tsx        -> imports from ../_components

# 3. The customers page needs it. No common route folder below the root:
#    it leaves the routes and goes to the shared area for the orders domain.
src/components/orders/OrderStatusBadge/OrderStatusBadge.tsx
```

At every stage the folder also holds `index.ts`, so the import path of a
consumer names the folder and does not change when the component gains files.
At stage 1 the badge sits flat in the route's `_components/` beside the
screen component that renders it, not nested inside that screen's folder: it
is a component of the route, not a part of the screen.

Wrong moves, and why:

```
# Sideways import: customers reaches into another route's private folder.
src/app/customers/page.tsx  -> import from "../orders/_components/OrderStatusBadge"

# Early promotion: one consumer, already in shared "because it will be reused".
src/components/orders/OrderStatusBadge/   (used by orders list only)

# Copy instead of move: two badges that will drift apart.
src/app/customers/_components/OrderStatusBadge/
```

Demotion is the same ladder downwards. When the customers page stops using the
badge, move it back under `orders/`. A shared folder should contain only code
that is shared today.

Shared does not mean generic. `OrderStatusBadge` knows about orders, so it goes
to the shared home for that domain, not into the UI kit next to `Button`. The
UI kit takes a component only when it has no business meaning left.

## Constants

1. A value used in one place is a named constant at the top of that file. A
   bare number or string inside JSX or a hook hides its meaning and cannot be
   reused.
2. When a second file in the same component or route folder needs it, move it
   to that folder's `constants` file.
3. When unrelated routes need it, promote it with the ladder to a
   topic-named shared module (`order-status`), together with the type derived
   from it.

Do not create one global constants file. It collects unrelated values, every
change touches it, and nothing in it can be safely deleted.

Derive option lists from the source that already defines them (an enum, a
schema, a config object) instead of typing the list again. Where the project
has no rule, that source lives with the domain's type in the domain's shared
module (`src/lib/orders.ts`).

Name constants the way the project does. If the project has no constants yet,
use `UPPER_SNAKE_CASE` for fixed primitive values and lookup tables.

## helpers, utils, lib

The distinction is what the code knows, not what the file is called.

```
src/app/orders/_components/OrderRow/helpers.ts   # isOrderOverdue(order): knows the domain,
                                                 #   one consumer -> helper, colocated
src/lib/order-rules.ts                           # isOrderOverdue once a data hook needs it too:
                                                 #   still domain logic, now shared
src/lib/money.ts                                 # formatMoney(amount, currency): knows nothing
                                                 #   about this app -> a util, kept in lib
src/lib/api.ts                                   # the API client: wires the app to the outside
```

Rules that hold whatever the folders are called:

- A helper or util is pure: no React, no hooks, no network, no reading of
  global state. That is what lets it be tested without rendering.
- A component-level `helpers` file is fine, because its scope is the
  component. A shared catch-all `helpers` or `utils` file is not: split it by
  topic.
- A function does not become a util by being moved. If it still knows about
  orders, it is shared domain logic and is named after its topic.
- A shared module never imports from a route. If a shared hook needs a rule
  that lives in a route's helpers, move the rule next to the hook.

Some projects use only `lib/`, some only `utils/`, some both. Use what the
project has and do not add a second shared folder for the same purpose. In a
project with neither, create `src/lib/` and put every shared module there:
the helper-versus-util distinction tells you whether code can be shared across
projects, and one folder is enough to hold both.

## Barrel files

A barrel is a file that only re-exports from other files. Two different things
get that name:

| Kind | Example | Default |
|---|---|---|
| Component entry point | `OrderRow/index.ts` re-exports `OrderRow` | Allowed: the import reads `./OrderRow`, and the folder's internals stay private |
| Aggregate barrel | `components/index.ts` re-exports forty components | Avoid in app code |

The cost of aggregate barrels is measured, not a matter of taste: importing
one name loads every module the barrel reaches, which slows the dev server,
tests and type checking, and makes circular imports easy to create. A library
or UI-kit entry point is the accepted exception, because it is a real public
API and bundlers can be configured for it.

If the project already uses a barrel as the required entry point of a package
or kit, import through it as the project says. Do not add `export *`, and do
not put anything except re-exports into an entry-point file.

## Naming case

The community is split between PascalCase and kebab-case for files and
folders, and no official source settles it. The decision that matters is that
each kind of file has exactly one case in the project.

- Copy the project's case for the kind of file you are adding. Check the
  neighbours: a project can use one case for component folders and another
  for module folders, on purpose.
- In a project with none: PascalCase for a component file and its folder,
  `useThing` for a hook file, kebab-case for every other module and folder.
- A file is named after what it exports. One component per file, named the
  same as the file.

## Enforcing boundaries

Prose rules about import direction and file case are forgotten; a linter is
not. If the project has a lint setup, the mechanical parts of this document
belong there: restricted import paths between routes and from shared code into
routes, a filename-case rule, and a rule against import cycles. Suggest that
as a separate change rather than repeating the rule in more documentation.
