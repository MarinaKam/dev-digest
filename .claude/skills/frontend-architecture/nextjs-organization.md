# Next.js App Router organization

How to use the routes folder as structure. This file covers placement only.
The reference for what each special file does, and everything about Server
Components and data fetching, is owned by `next-best-practices`.

## Contents

- [The routes folder is the map](#the-routes-folder-is-the-map)
- [Three official strategies](#three-official-strategies)
- [Thin route files](#thin-route-files)
- [Route-private folders](#route-private-folders)
- [Route groups](#route-groups)
- [Layouts](#layouts)
- [Special files](#special-files)
- [The client boundary in the tree](#the-client-boundary-in-the-tree)
- [Checklist for a new route](#checklist-for-a-new-route)

## The routes folder is the map

In the App Router a folder is a URL segment and a file with a reserved name is
a piece of UI for that segment. That makes the routes folder the one place
where the structure is enforced by the framework, so use it as the map of the
app: someone who opens it should see the screens the product has.

Name segments after what the user sees (`orders`, `customers`, `settings`),
not after implementation (`table-view`, `forms`).

## Three official strategies

The framework documentation describes three ways to place non-route code and
recommends none over the others:

1. Keep the routes folder for routing only; all other code lives outside it.
2. Put shared code in top-level folders inside the routes folder.
3. Split code by route: shared code at the root, route-specific code inside
   the route segment that uses it.

Find out which one the project uses before adding a file. Where it has not
chosen, use the third: it is the hybrid from
[folder-structure.md](folder-structure.md) and matches the promotion ladder.

## Thin route files

A `page` file is a route entry, not a screen implementation. It reads the
route's inputs and renders one component that lives in the route's private
folder.

```
src/app/orders/
├── page.tsx                     # renders <OrdersView />
└── _components/
    └── OrdersView/
        ├── OrdersView.tsx       # the screen
        └── ...
```

Why: the screen can then be tested and moved without the routing file, the
route file stays readable as a table of contents, and a second route can
render the same view with different inputs.

What never belongs in the route file: the screen's markup, local state and
event handlers. Reading the route's params and passing them to the view does
belong there. Whether the route file also prefetches data or exports metadata
is a rendering decision, not a placement one: follow the project, and where
it has no rule, `next-best-practices` owns that choice.

## Route-private folders

A folder whose name starts with an underscore is excluded from routing, so it
is safe for code that belongs to a route.

```
src/app/orders/
├── page.tsx
├── _components/         # components used by this route and its children
├── constants.ts         # values shared by several of this route's components
├── helpers.ts           # pure functions shared the same way
└── [orderId]/
    ├── page.tsx
    └── _components/     # components used by the detail page only
```

Rules:

- A file placed in a route folder is not routable unless it has a reserved
  name, so `constants.ts` and `helpers.ts` can sit beside `page.tsx`. The
  underscore folder is for clarity and to avoid a clash with a future
  reserved name, not a requirement.
- A route may import from its own private folder and from its ancestors'
  private folders: `orders/[orderId]` may use `orders/_components/`. A few
  projects forbid the second; follow a written rule if there is one.
- A route never imports from a sibling route's private folder, and nothing
  outside the routes folder imports from inside it. The underscore only opts
  the folder out of routing; nothing in the framework stops such an import,
  so this is a rule to hold or to lint.
- When a second, unrelated route needs the code, promote it out of the routes
  folder with the ladder.

## Route groups

A folder in parentheses groups routes without adding a URL segment.

Use one when routes need a shared layout or a shared private folder that the
URL should not show:

```
src/app/
├── (marketing)/
│   ├── layout.tsx       # public header and footer
│   ├── page.tsx         # /
│   └── pricing/page.tsx # /pricing
└── (app)/
    ├── layout.tsx       # signed-in shell
    ├── _components/     # shared by app routes only
    └── orders/page.tsx  # /orders
```

Do not use a group only to tidy a list of folders; a group that carries no
layout and no shared code is an extra level for nothing. Two routes in
different groups must not resolve to the same URL.

## Layouts

A layout wraps a segment and its children and keeps its state while the user
navigates between them.

- Put UI in a layout when it is the same for every child route and should not
  remount: a shell, a sidebar, a tab bar.
- Keep it in the view when it differs per screen or depends on the screen's
  data.
- If the project wraps each screen in a shell component by hand instead of
  using a nested layout, follow that; mixing both gives two sources of chrome.

Place a layout at the highest segment whose children all need it, and no
higher.

## Special files

Reserved files for loading, error and not-found states are scoped to the
segment they sit in and apply to its children. That makes their position a
structural decision:

- Put one at the level whose whole subtree should share that state.
- Before adding one, check whether the project uses them at all. Some apps
  handle loading and error states inside each view from the data hook's flags
  and have none of these files; adding one for a single screen creates a
  second mechanism.

## The client boundary in the tree

The directive that marks client code applies to a module and everything it
imports, not to a component. So where it sits is a folder question.

- Mark the entry of a client subtree, not every file inside it.
- Push the boundary down: an interactive leaf in its own file rather than a
  whole screen, when the project renders on the server.
- A shared module imported from both sides must not pull in client-only or
  server-only code.

If the project is deliberately client-rendered (a single server layout and
client views), the boundary is already fixed at the view. Do not move it per
component.

## Checklist for a new route

1. The segment is named after what the user sees.
2. `page` renders one view from the route's private folder.
3. Components, constants and helpers used only here are inside the route
   folder.
4. Nothing was imported from a sibling route; anything needed from one was
   promoted first.
5. Layout, loading, error and not-found handling follow the mechanism the
   project already uses.
6. If the project keeps a route map in its documentation, it is updated.
