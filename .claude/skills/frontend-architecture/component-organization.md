# Component organization

What a component folder contains and where the pieces of a crowded component
go. Whether a component should be split at all is decided by
`react-best-practices`; this file starts once that decision is made.

## Contents

- [From file to folder](#from-file-to-folder)
- [Folder anatomy](#folder-anatomy)
- [Order inside a file](#order-inside-a-file)
- [Where each extracted piece goes](#where-each-extracted-piece-goes)
- [Hooks](#hooks)
- [Business logic](#business-logic)
- [Child components](#child-components)
- [Worked example](#worked-example)

## From file to folder

Follow the project: some keep a small component as a single file, some make
every component a folder. Where the project has no rule, a component with its
own name in a `_components/` or shared folder is a folder from the start,
`Name/Name.tsx` plus `Name/index.ts`, so its import path stays the same when
it gains a test or helpers. A small piece used once inside another component
stays an unexported function in that component's file and gets no folder.

Create the other sibling files only when they have content; an empty
`constants` file is noise.

## Folder anatomy

Use the project's file names. Where the project has none, these:

```
OrderRow/
├── OrderRow.tsx        # the component and its props type
├── OrderRow.test.tsx   # its test, beside it
├── index.ts            # re-exports OrderRow (and its props type if callers need it)
├── constants.ts        # fixed values used by more than one file in this folder
├── helpers.ts          # pure functions private to this component
├── helpers.test.ts     # their tests
├── styles.ts           # style objects, if the project styles this way
├── hooks/
│   └── useRowMenu.ts   # a hook only this component uses, one hook per file
└── _components/        # child components only this component uses
    └── OrderRowActions/
```

Every file except the component itself is optional and appears only when it
has content. What each file may contain:

| File | Contains | Never contains |
|---|---|---|
| `Name.tsx` | The component, its props type, small unexported pieces used once | Data-access code, domain rules, long lookup tables |
| `index` | Re-exports of this folder's public names | Logic, `export *`, names from other folders |
| `constants` | Fixed values, lookup tables, derived option lists | Functions, anything that reads state |
| `helpers` | Pure functions and the types they return | React, hooks, network calls |
| `styles` | Style objects or class maps | Conditions that depend on business rules |
| `hooks/` | Stateful logic private to this component | Data hooks shared by other screens |

The folder's `index` is its public surface. Other folders import the component
through it and do not reach into `helpers` or `constants` of a component they
do not own. If another component needs one of those, it is no longer private:
promote it with the ladder.

## Order inside a file

Imports, then constants, then unexported helper functions, then the component,
then exports. A reader meets the names before the code that uses them, and a
constant or helper that has grown is easy to spot and move out.

## Where each extracted piece goes

| Piece in the component file | Destination |
|---|---|
| A literal array or object used in JSX | Named constant above the component; `constants` once another file in the folder uses it |
| A calculation on props or data | `helpers` as a pure function |
| The type that calculation returns | Beside the function, in `helpers` |
| State plus the handlers that change it, reusable as a unit | `hooks/useThing.ts` in this folder |
| A fetch or other data access | The project's data-hook location, never the component folder |
| A block of markup used once | An unexported component in the same file, or `_components/` once it needs its own file |
| A block of markup another screen needs | Promote with the ladder |
| A user-facing string | The project's messages files, if it has them |

## Hooks

Two kinds, with different homes:

- **Data hooks** load or change server data. They live in one shared place,
  grouped by domain (`src/hooks/orders.ts` where the project has no rule),
  because several screens read the same data and cache keys must have a
  single source.
- **UI hooks** hold view state: open or closed, selection, keyboard handling,
  reading and writing a URL parameter. A UI hook used by one component lives
  in that component's folder. It is promoted like any other code when a second
  component uses it.

A function is a hook only if it calls a hook. A function that calls none is a
helper and takes no `use` prefix, wherever it lives.

Do not wrap a single `useState` in a custom hook to tidy a file. Extract a
hook when the state and its handlers form one unit with a name.

## Business logic

A rule about the domain (is this order overdue, what does a run cost, which
filter is effective) is a pure function. It does not live in the component
body and it does not live inside a hook.

- One consumer: `helpers` in the component folder.
- A hook and a component both need it: move it to a topic-named shared
  module and test it there. Follow the project if it keeps such rules beside
  its hooks instead. Both the hook and the component import it from the
  shared module. The hook must not import it from a component or route
  folder, because that points the dependency the wrong way.
- The hook orchestrates: it calls the rule, holds state, talks to the data
  layer. The component renders the result.

This split is what makes a rule testable in a plain unit test and reusable by
the next screen without rendering anything.

## Child components

A child that is a part of its parent lives inside the parent's folder
(`_components/` or the project's equivalent) with the same anatomy. The test:
it is named after the parent, makes no sense without it, and is deleted with
it. `OrderRowActions` belongs inside `OrderRow/`.

A component with a meaning of its own stays flat in the route's private
folder even while only one screen renders it. `OrderStatusBadge` rendered by
`OrdersView` is a component of the orders route, not a part of the view, so
it sits beside `OrdersView/`, not inside it.

Keep nesting shallow. If a child needs its own children three levels down, the
parent is probably a screen section that deserves to sit one level up in the
route's private folder.

A component may import from its own folder and from shared code. It imports
from a sibling component's folder only through that sibling's `index`. If it
needs a sibling's private helper, that helper has two consumers: move it up to
the folder both share.

## Worked example

`OrderFilters.tsx` holds a status option list, a function that filters orders,
a dropdown's open state, and the markup.

Before:

```
src/app/orders/_components/OrderFilters.tsx      # everything in one file
```

After:

```
src/app/orders/_components/OrderFilters/
├── OrderFilters.tsx        # markup; props type OrderFiltersProps
├── OrderFilters.test.tsx
├── index.ts                # export { OrderFilters } from "./OrderFilters"
├── constants.ts            # STATUS_OPTIONS, derived from the order status enum
├── helpers.ts              # filterOrders(orders, filters), type OrderFilterValues
├── helpers.test.ts
└── hooks/
    └── useOrderFilters.ts  # reads and writes the filters in the URL
```

The orders data hook was not created here and stays in the shared data-hook
location. `filterOrders` stays private until a second screen filters orders
the same way.
