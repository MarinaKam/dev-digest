// Run: node --test ".claude/skills/demo-video/scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  holdAfter,
  listStatuses,
  probeArgs,
  resolveArgs,
  scenarioSlug,
  setStatus,
  sheetLayout,
  statusLine,
  validateFlow,
} from './lib.mjs';

test('resolveArgs substitutes {BASE} and trims its trailing slash', () => {
  assert.deepEqual(resolveArgs(['open', '{BASE}/agents'], 'http://localhost:3002/'), [
    'open',
    'http://localhost:3002/agents',
  ]);
});

test('scenarioSlug turns a branch name into a file-safe slug', () => {
  assert.equal(scenarioSlug('feat/demo-video-skill'), 'feat-demo-video-skill');
  assert.throws(() => scenarioSlug(''), /branch/);
});

test('validateFlow accepts a well-formed flow', () => {
  const flow = {
    name: 'Tour',
    start: '/',
    steps: [
      { caption: 'Hello' },
      { cmd: ['find', 'text', 'Agents', 'click'], label: 'open agents' },
      { pause: 1000 },
    ],
  };
  assert.deepEqual(validateFlow(flow), []);
});

test('validateFlow reports every malformed step with its number', () => {
  const errors = validateFlow({
    name: 'Bad',
    steps: [{ cmd: [] }, { caption: 'x', pause: 5 }, {}, { cmd: ['open', 3] }, { caption: 'y'.repeat(91) }],
  });
  assert.equal(errors.length, 5);
  assert.match(errors[0], /^step 1:/);
  assert.match(errors[1], /^step 2:.*exactly one/);
  assert.match(errors[4], /^step 5:.*90/);
});

test('validateFlow rejects a flow without a name or steps', () => {
  assert.deepEqual(validateFlow({}), ['flow: "name" is required', 'flow: "steps" must be a non-empty array']);
});

test('validateFlow rejects the chat command, which calls a model', () => {
  assert.match(validateFlow({ name: 'n', steps: [{ cmd: ['chat', 'do it'] }] })[0], /chat/);
});

test('probeArgs turns a find action into a hover on the same target', () => {
  assert.deepEqual(probeArgs(['find', 'role', 'button', 'click', '--name', 'Save']), [
    'find',
    'role',
    'button',
    'hover',
    '--name',
    'Save',
  ]);
  assert.deepEqual(probeArgs(['find', 'label', 'Name', 'fill', 'My agent', '--exact']), [
    'find',
    'label',
    'Name',
    'hover',
    '--exact',
  ]);
  assert.deepEqual(probeArgs(['find', 'nth', '2', '.card', 'click']), ['find', 'nth', '2', '.card', 'hover']);
});

test('probeArgs waits for the selector of a direct action', () => {
  assert.deepEqual(probeArgs(['click', '#save']), ['wait', '#save']);
  assert.deepEqual(probeArgs(['fill', 'input[name=q]', 'text']), ['wait', 'input[name=q]']);
});

test('probeArgs returns null when there is no target to check', () => {
  assert.equal(probeArgs(['press', 'Enter']), null);
  assert.equal(probeArgs(['keyboard', 'type', 'abc']), null);
});

const SCENARIO = [
  '# Demo',
  '',
  '## Video 1 — Tour',
  '',
  '**Status:** ⏳ not recorded',
  '',
  '1. Open `/`.',
  '',
  '## Video 2 — Agents',
  '',
  '1. Open `/agents`.',
  '',
].join('\n');

test('listStatuses reads every video, with a default for a missing line', () => {
  assert.deepEqual(listStatuses(SCENARIO), [
    { n: 1, title: 'Video 1 — Tour', status: '⏳ not recorded' },
    { n: 2, title: 'Video 2 — Agents', status: '⏳ not recorded' },
  ]);
});

test('setStatus replaces an existing status line and leaves the rest alone', () => {
  const out = setStatus(SCENARIO, 1, '**Status:** ✅ recorded 2026-11-27');
  assert.equal(listStatuses(out)[0].status, '✅ recorded 2026-11-27');
  assert.equal(out.split('\n').length, SCENARIO.split('\n').length);
  assert.ok(out.includes('1. Open `/`.'));
});

test('setStatus inserts a status line under a heading that has none', () => {
  const out = setStatus(SCENARIO, 2, '**Status:** ❌ failed 2026-11-27 — step 3');
  assert.equal(listStatuses(out)[1].status, '❌ failed 2026-11-27 — step 3');
  assert.equal(listStatuses(out)[0].status, '⏳ not recorded');
});

test('setStatus does not mutate its input and rejects an unknown video', () => {
  const before = SCENARIO;
  setStatus(SCENARIO, 1, '**Status:** x');
  assert.equal(SCENARIO, before);
  assert.throws(() => setStatus(SCENARIO, 9, '**Status:** x'), /Video 9/);
});

test('statusLine formats each state', () => {
  assert.equal(statusLine('pending'), '**Status:** ⏳ not recorded');
  assert.equal(
    statusLine('recorded', { date: '2026-11-27', name: '01-tour.mp4', link: '../../demo/x/01-tour.mp4', seconds: 47 }),
    '**Status:** ✅ recorded 2026-11-27 · [01-tour.mp4](../../demo/x/01-tour.mp4) · 47 s',
  );
  assert.equal(statusLine('failed', { date: '2026-11-27', reason: 'step 3' }), '**Status:** ❌ failed 2026-11-27 — step 3');
  assert.throws(() => statusLine('done'), /unknown state/);
});

test('sheetLayout sizes the contact sheet from the video length', () => {
  assert.deepEqual(sheetLayout(47), { frames: 16, cols: 4, rows: 4 });
  assert.deepEqual(sheetLayout(2), { frames: 1, cols: 1, rows: 1 });
});

test('validateFlow checks the optional setup commands', () => {
  const steps = [{ pause: 1 }];
  assert.deepEqual(validateFlow({ name: 'n', setup: [['find', 'text', 'All', 'click']], steps }), []);
  assert.match(validateFlow({ name: 'n', setup: [['chat', 'x']], steps })[0], /^setup 1:.*chat/);
  assert.match(validateFlow({ name: 'n', setup: 'open', steps })[0], /"setup" must be an array/);
});

test('holdAfter gives no default pause to a command that only waits', () => {
  const pace = { afterAction: 1200, caption: 2500 };
  assert.equal(holdAfter({ cmd: ['wait', '--text', 'x'] }, pace), 0);
  assert.equal(holdAfter({ cmd: ['find', 'text', 'x', 'click'] }, pace), 1200);
  assert.equal(holdAfter({ cmd: ['wait', '--text', 'x'], hold: 3000 }, pace), 3000);
  assert.equal(holdAfter({ caption: 'c' }, pace), 2500);
});
