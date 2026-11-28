// Pure helpers of the demo-video skill: no I/O, so they are unit-tested (lib.test.mjs).

/** agent-browser's wait timeout when a flow sets none; also a step's when it sets none. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** Commands that must run exactly once: never repeated after a failure. */
const RUN_ONCE = ['open', 'record', 'back', 'forward', 'reload', 'close'];
const MAX_CAPTION = 90;
const HEADING = /^## (Video (\d+)\b.*)$/;
const STATUS = /^\*\*Status:\*\*\s*/;
const PENDING = '⏳ not recorded';

/** Locators of `find` that take one value before the action; `nth` takes two. */
const FIND_ONE_VALUE = ['role', 'text', 'label', 'placeholder', 'alt', 'title', 'testid', 'first', 'last'];
/** Commands whose first argument is the element they act on. */
const DIRECT_ACTIONS = ['click', 'dblclick', 'fill', 'type', 'check', 'uncheck', 'select', 'upload', 'hover', 'focus'];
const FIND_ACTIONS_WITH_TEXT = ['fill'];

/** Substitute `{BASE}` in every argument (same token as the e2e flows). */
export function resolveArgs(cmd, base) {
  const origin = base.replace(/\/+$/, '');
  return cmd.map((arg) => arg.replaceAll('{BASE}', origin));
}

/** Branch name -> scenario name: `feat/x` -> `feat-x`. */
export function scenarioSlug(branch) {
  const slug = (branch ?? '').trim().replaceAll('/', '-');
  if (!slug) throw new Error('cannot derive a scenario name: the branch name is empty');
  return slug;
}

function stepErrors(step, index) {
  const at = `step ${index + 1}:`;
  const kinds = ['cmd', 'caption', 'pause'].filter((kind) => step?.[kind] !== undefined);
  if (kinds.length !== 1) return [`${at} needs exactly one of "cmd", "caption", "pause"`];
  if (step.cmd !== undefined) {
    const isArgv = Array.isArray(step.cmd) && step.cmd.length > 0 && step.cmd.every((arg) => typeof arg === 'string');
    if (!isArgv) return [`${at} "cmd" must be a non-empty array of strings`];
    if (step.cmd[0] === 'chat') return [`${at} the "chat" command calls a model and is not allowed`];
  }
  if (step.caption !== undefined) {
    if (typeof step.caption !== 'string' || !step.caption) return [`${at} "caption" must be a non-empty string`];
    if (step.caption.length > MAX_CAPTION) return [`${at} caption is longer than ${MAX_CAPTION} characters`];
  }
  if (step.pause !== undefined && !(Number.isFinite(step.pause) && step.pause >= 0)) {
    return [`${at} "pause" must be a number of milliseconds`];
  }
  return [];
}

function setupErrors(setup) {
  if (setup === undefined) return [];
  if (!Array.isArray(setup)) return ['flow: "setup" must be an array of commands'];
  return setup.flatMap((cmd, index) =>
    stepErrors({ cmd }, index).map((error) => error.replace(/^step /, 'setup ')),
  );
}

/** Returns a list of problems; an empty list means the flow can be run. */
export function validateFlow(flow) {
  const errors = [];
  if (typeof flow?.name !== 'string' || !flow.name) errors.push('flow: "name" is required');
  errors.push(...setupErrors(flow?.setup));
  if (!Array.isArray(flow?.steps) || flow.steps.length === 0) {
    return [...errors, 'flow: "steps" must be a non-empty array'];
  }
  return [...errors, ...flow.steps.flatMap(stepErrors)];
}

/**
 * Milliseconds to hold the screen after a step. A `wait` command shows nothing
 * new by itself, so it gets no default pause: the next caption follows at once.
 */
export function holdAfter(step, pace) {
  if (step.hold !== undefined) return step.hold;
  if (step.caption !== undefined) return pace.caption;
  return step.cmd?.[0] === 'wait' ? 0 : pace.afterAction;
}

/**
 * How long a step may take. A dry run starts no model run and performs no data
 * change, so a long wait for one could only fail: it is capped at the flow's
 * timeout, and the step is reported as not verified as fast as before.
 */
export function stepTimeout(step, flowTimeout, dry) {
  const own = step.timeout ?? flowTimeout;
  return dry ? Math.min(own, flowTimeout) : own;
}

/**
 * Whether a failed attempt of `cmd` is tried again until the step's deadline.
 * Commands that run exactly once never are. A `wait` gives up at agent-browser's
 * default timeout, which is the flow's `timeout`; it is repeated only when the
 * step allows more than that (a model run), so a normal wait fails as fast as
 * before.
 */
export function retriesUntilDeadline(cmd, stepTimeout, flowTimeout) {
  const name = cmd[0];
  if (RUN_ONCE.includes(name)) return false;
  if (name === 'wait') return stepTimeout > flowTimeout;
  return true;
}

/**
 * Dry-run stand-in for a step that changes data: a command that only checks the
 * target is there. Returns null when the command has no target to check.
 */
export function probeArgs(cmd) {
  const [name, ...rest] = cmd;
  if (name === 'find') {
    const actionAt = rest[0] === 'nth' ? 3 : FIND_ONE_VALUE.includes(rest[0]) ? 2 : -1;
    if (actionAt < 0 || rest.length <= actionAt) return null;
    const hasText = FIND_ACTIONS_WITH_TEXT.includes(rest[actionAt]) && rest.length > actionAt + 1;
    const tail = rest.slice(actionAt + (hasText ? 2 : 1));
    return ['find', ...rest.slice(0, actionAt), 'hover', ...tail];
  }
  // `agent-browser wait <selector>` waits for the element to appear (see `wait --help`).
  if (DIRECT_ACTIONS.includes(name) && rest.length > 0) return ['wait', rest[0]];
  return null;
}

/**
 * The command that moves the pointer onto the target of a click, so a viewer sees
 * where the click is about to land. Returns null for anything that is not a click.
 */
export function hoverArgs(cmd) {
  if (cmd[0] === 'click' && cmd.length > 1) return ['hover', cmd[1]];
  if (cmd[0] !== 'find') return null;
  const probe = probeArgs(cmd);
  const actionAt = probe?.indexOf('hover') ?? -1;
  return actionAt > 0 && cmd[actionAt] === 'click' ? probe : null;
}

/** Every `## Video N` of a scenario with its status text. */
export function listStatuses(markdown) {
  const videos = [];
  for (const line of markdown.split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      videos.push({ n: Number(heading[2]), title: heading[1], status: PENDING, open: true });
    } else if (videos.length > 0 && videos.at(-1).open && (STATUS.test(line) || line.startsWith('## '))) {
      // A status line belongs to the video above it; any other "## " section ends that video.
      const status = STATUS.test(line) ? line.replace(STATUS, '').trim() : videos.at(-1).status;
      videos[videos.length - 1] = { ...videos.at(-1), status, open: false };
    }
  }
  return videos.map(({ n, title, status }) => ({ n, title, status }));
}

/** Returns the scenario with the status line of video `n` replaced or inserted. */
export function setStatus(markdown, n, line) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.match(HEADING)?.[2] === String(n));
  if (start < 0) throw new Error(`no "## Video ${n}" heading in the scenario`);
  const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const end = next < 0 ? lines.length : next;
  const offset = lines.slice(start + 1, end).findIndex((l) => STATUS.test(l));
  if (offset >= 0) return lines.with(start + 1 + offset, line).join('\n');
  return [...lines.slice(0, start + 1), '', line, ...lines.slice(start + 1)].join('\n');
}

export function statusLine(state, { date, name, link, seconds, reason } = {}) {
  if (state === 'pending') return `**Status:** ${PENDING}`;
  if (state === 'recorded') {
    const length = Number.isFinite(seconds) ? ` · ${seconds} s` : '';
    return `**Status:** ✅ recorded ${date} · [${name}](${link})${length}`;
  }
  if (state === 'failed') return `**Status:** ❌ failed ${date}${reason ? ` — ${reason}` : ''}`;
  throw new Error(`unknown state "${state}" (recorded | failed | pending)`);
}

/** Grid for a contact sheet with one frame every `every` seconds. */
export function sheetLayout(durationSeconds, every = 3, maxCols = 4) {
  const frames = Math.max(1, Math.ceil(durationSeconds / every));
  const cols = Math.min(maxCols, frames);
  return { frames, cols, rows: Math.ceil(frames / cols) };
}
