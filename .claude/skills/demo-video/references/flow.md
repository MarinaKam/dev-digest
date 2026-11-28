# Flow file: `demo/<scenario>/NN-name.flow.json`

A flow is a JSON list of steps that `scripts/record.mjs` plays top to bottom in one
`agent-browser` session. It follows the e2e flows (`e2e/specs/*.flow.json`): a `cmd` is
passed verbatim to `agent-browser`, and `{BASE}` is replaced by the web origin. Two step
kinds exist only here: `caption` and `pause`.

## File

```json
{
  "name": "Severity filter on the findings panel",
  "viewport": [1440, 900],
  "colorScheme": "dark",
  "start": "/",
  "startWait": ["wait", "--url", "/pulls"],
  "setup": [["find", "role", "button", "click", "--name", "All", "--exact"]],
  "timeout": 15000,
  "pace": { "afterAction": 500, "beforeClick": 300, "caption": 1800 },
  "steps": [
    { "caption": "Findings can be filtered by severity" },
    { "cmd": ["find", "role", "button", "click", "--name", "Agent runs"], "label": "open the Agent runs tab" },
    { "cmd": ["wait", "--text", "2 findings"], "label": "findings are listed" },
    { "pause": 1000 }
  ]
}
```

| Key | Default | Meaning |
|---|---|---|
| `name` | required | title printed by the runner |
| `baseUrl` | `http://localhost:3000` | web origin; the `DEMO_BASE_URL` environment variable wins over it |
| `viewport` | `[1440, 900]` | video size in CSS pixels |
| `scale` | `1` | device pixel ratio. Leave it at 1: with 2, agent-browser 0.45.0 halves the mouse coordinates while recording and every click misses |
| `colorScheme` | app default | `dark` or `light` |
| `start` | `/` | path opened before the recording starts |
| `startWait` | none | a `wait` command that must pass before the first frame |
| `setup` | none | commands run after `startWait` and before the first frame, never filmed: a filter or a scroll that shapes the opening screen. They also run in a dry run, so they must not change data |
| `timeout` | `15000` | ms a step may take to find its target |
| `pace.afterAction` | `500` | ms held after each `cmd` step; a `wait` command gets no default hold |
| `pace.beforeClick` | `300` | ms the pointer rests on a target before a click |
| `pace.caption` | `1800` | ms a caption step holds the screen |

The video is written next to the flow file: `NN-name.mp4`, with `NN-name.sheet.png` (one
small frame every 3 seconds, for a quick check; it is a thumbnail grid, not the video's
quality) and, after a failure, `NN-name.failed.png`.

The pointer and the ring on each click are drawn by `scripts/overlay.js`. Before a click
the runner moves the pointer onto the target and rests there for `pace.beforeClick`.

## Steps

Each step has exactly one of `cmd`, `caption`, `pause`.

| Step | Example | Notes |
|---|---|---|
| `cmd` | `{ "cmd": ["find", "text", "Agents", "click"], "label": "open Agents" }` | any `agent-browser` command except `chat`; retried until `timeout` when it does not wait on its own |
| `caption` | `{ "caption": "Each run keeps its cost" }` | at most 90 characters, aim for 60; stays on screen until the next caption |
| `pause` | `{ "pause": 1000 }` | ms of stillness |

A `cmd` step can also carry:

- `"label"`: the name of the step in the runner's log.
- `"hold"`: ms to wait after this step instead of `pace.afterAction`.
- `"timeout"`: ms this step may take. A `wait` gives up at the flow's `timeout`; when the
  step's own `timeout` is longer (a model run), the wait is repeated until that deadline.
- `"changesData": true`: the step saves, imports, deletes, toggles or starts a run. A dry
  run only checks that its target exists. Steps after it that fail in a dry run are reported
  as `?` (not verified), because they may need the change.
- `"offCamera": true`: the recording stops before this step and starts again after it, so a
  long wait is cut from the video.

## Commands that are used most

| Purpose | Command |
|---|---|
| Open a page | `["open", "{BASE}/agents"]` |
| Click by role and name | `["find", "role", "button", "click", "--name", "Run Review"]` |
| Click by text | `["find", "text", "Agent runs", "click"]`, add `"--exact"` for an exact match |
| Fill a field | `["find", "label", "Name", "fill", "Security reviewer"]` |
| Point at something | `["find", "text", "CRITICAL", "hover"]` |
| Click or hover by CSS selector | `["click", "#save"]`, `["hover", "#save"]` |
| Wait for an element | `["wait", "#save"]` (a bare selector waits for the element to appear) |
| Wait for text | `["wait", "--text", "2 findings"]` |
| Wait for a route | `["wait", "--url", "/pulls/482"]` |
| Scroll | `["scroll", "down", "500"]` |
| Centre an element found by its text | `["eval", "[...document.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent.includes('<text>'))?.scrollIntoView({ block: 'center', behavior: 'smooth' })"]` |
| Press a key | `["press", "Escape"]` |

`find` locators: `role`, `text`, `label`, `placeholder`, `alt`, `title`, `testid`, `first`,
`last`, `nth`. The full syntax is in `agent-browser find --help` and
`agent-browser wait --help`.
