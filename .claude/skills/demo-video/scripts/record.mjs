#!/usr/bin/env node
// Demo video runner: plays a flow file with agent-browser in its own browser session and
// records it to an .mp4, with a visible cursor, captions and paced pauses.
//
//   node record.mjs <NN-name.flow.json> [--dry-run] [--headed] [--keep-open]
//
//   --dry-run    play every step fast, record nothing, and only check (never perform) the
//                steps marked "changesData"
//   --headed     show the browser window while it runs
//   --keep-open  leave the browser session open at the end, to inspect a failed step
//
// Env: DEMO_BASE_URL (web origin; wins over the flow's "baseUrl", default
//      http://localhost:3000), AGENT_BROWSER_BIN (default "agent-browser").
// Output, next to the flow file: NN-name.mp4, NN-name.sheet.png, NN-name.failed.png.
// Flow format: ../references/flow.md. Exit code 1 on a failed step, 2 on bad usage.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { holdAfter, hoverArgs, probeArgs, resolveArgs, sheetLayout, validateFlow } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = process.env.AGENT_BROWSER_BIN ?? 'agent-browser';
const SESSION = 'demo-video';
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_VIEWPORT = [1440, 900];
// 2 would record twice the pixels, but agent-browser 0.45.0 halves the mouse coordinates
// while it records at an emulated scale, so every click misses. Keep 1 until that is fixed.
const DEFAULT_SCALE = 1;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_PACE = { afterAction: 1200, beforeClick: 600, caption: 2500 };
const DRY_RUN_PAUSE_MS = 100;
const RETRY_EVERY_MS = 400;
const SHEET_EVERY_SECONDS = 3;
const SHEET_FRAME_WIDTH = 720;
const SHEET_COLUMNS = 3;
const SIZE_WARNING_MB = 10;
/** Commands that already wait on their own, or must run exactly once. */
const NO_RETRY = ['open', 'wait', 'record', 'back', 'forward', 'reload', 'close'];
const FLAGS = ['--dry-run', '--headed', '--keep-open'];

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg.startsWith('--') && !FLAGS.includes(arg));
const flowPath = args.find((arg) => !arg.startsWith('--'));
if (!flowPath || unknown.length > 0) {
  process.stderr.write(`usage: node record.mjs <NN-name.flow.json> [${FLAGS.join('] [')}]\n`);
  process.exit(2);
}
const DRY = args.includes('--dry-run');
const KEEP_OPEN = args.includes('--keep-open');

const say = (line) => process.stdout.write(`${line}\n`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const pause = (ms) => sleep(DRY ? Math.min(ms, DRY_RUN_PAUSE_MS) : ms);

function loadFlow(path) {
  if (!existsSync(path)) throw new Error(`flow file not found: ${path}`);
  let flow;
  try {
    flow = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`flow file is not valid JSON: ${error.message}`);
  }
  const errors = validateFlow(flow);
  if (errors.length > 0) throw new Error(`invalid flow:\n  ${errors.join('\n  ')}`);
  return flow;
}

function run(command, commandArgs, { env = process.env, timeout = 120_000 } = {}) {
  const result = spawnSync(command, commandArgs, { env, encoding: 'utf8', timeout });
  if (result.error || result.status !== 0) {
    const output = `${result.stderr ?? ''} ${result.stdout ?? ''}`.trim();
    throw new Error(output || result.error?.message || `${command} exited with ${result.status}`);
  }
  return result.stdout ?? '';
}

function requireTools(tools) {
  const missing = tools.filter((tool) => spawnSync('which', [tool]).status !== 0);
  if (missing.length > 0) throw new Error(`not found on PATH: ${missing.join(', ')}`);
}

async function requireApp(baseUrl) {
  try {
    const response = await fetch(baseUrl);
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`the web app is not reachable at ${baseUrl} (${error.message}); start it or set DEMO_BASE_URL`);
  }
}

function createBrowser(flow) {
  const env = {
    ...process.env,
    AGENT_BROWSER_SESSION: SESSION,
    AGENT_BROWSER_INIT_SCRIPTS: join(HERE, 'overlay.js'),
    // Let agent-browser's own waits give up first, so a failed step reports its reason.
    AGENT_BROWSER_DEFAULT_TIMEOUT: String(flow.timeout ?? DEFAULT_TIMEOUT_MS),
    ...(flow.colorScheme ? { AGENT_BROWSER_COLOR_SCHEME: flow.colorScheme } : {}),
    ...(args.includes('--headed') ? { AGENT_BROWSER_HEADED: '1' } : {}),
  };
  const ab = (commandArgs, timeout) => run(BIN, commandArgs, { env, timeout });
  /** `find` and the direct actions do not wait for their target, so retry until the timeout. */
  const abRetry = async (commandArgs, timeout) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      try {
        return ab(commandArgs, timeout + 5000);
      } catch (error) {
        if (NO_RETRY.includes(commandArgs[0]) || Date.now() > deadline) throw error;
        await sleep(RETRY_EVERY_MS);
      }
    }
  };
  const script = (code) => ab(['eval', '-b', Buffer.from(code).toString('base64')]);
  return { ab, abRetry, script };
}

function createRecorder(browser, output) {
  const segmentsDir = join(dirname(output), `.segments-${basename(output, '.mp4')}`);
  const segments = [];
  let recording = false;
  return {
    prepare() {
      rmSync(segmentsDir, { recursive: true, force: true });
      mkdirSync(segmentsDir, { recursive: true });
    },
    start() {
      if (DRY || recording) return;
      const segment = join(segmentsDir, `segment-${String(segments.length).padStart(3, '0')}.mp4`);
      // No --cursor: overlay.js draws the pointer, with a glide between targets.
      browser.ab(['record', 'start', segment]);
      segments.push(segment);
      recording = true;
    },
    stop() {
      if (DRY || !recording) return;
      browser.ab(['record', 'stop']);
      recording = false;
    },
    /** Joins the segments into the output file; off-camera steps are the gaps between them. */
    finish() {
      if (segments.length === 1) {
        renameSync(segments[0], output);
      } else {
        const list = join(segmentsDir, 'segments.txt');
        writeFileSync(list, segments.map((segment) => `file '${segment.replaceAll("'", "'\\''")}'`).join('\n'));
        run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', output]);
      }
      rmSync(segmentsDir, { recursive: true, force: true });
    },
    /** Removes the partial segments of a failed run. */
    discard() {
      rmSync(segmentsDir, { recursive: true, force: true });
    },
  };
}

async function playStep(step, context) {
  const { browser, flow, baseUrl, pace } = context;
  const timeout = step.timeout ?? flow.timeout ?? DEFAULT_TIMEOUT_MS;
  if (step.caption !== undefined) {
    browser.script(`window.__demoVideo && window.__demoVideo.caption(${JSON.stringify(step.caption)})`);
    await pause(holdAfter(step, pace));
    return 'played';
  }
  if (step.pause !== undefined) {
    await pause(step.pause);
    return 'played';
  }
  const command = resolveArgs(step.cmd, baseUrl);
  if (DRY && step.changesData) {
    const probe = probeArgs(command);
    if (probe) await browser.abRetry(probe, timeout);
    return probe ? 'probed' : 'skipped';
  }
  const hover = hoverArgs(command);
  if (hover) {
    // Rest the pointer on the target first, so the viewer sees where the click lands.
    await browser.abRetry(hover, timeout);
    await pause(pace.beforeClick);
  }
  await browser.abRetry(command, timeout);
  await pause(holdAfter(step, pace));
  return 'played';
}

const describe = (step) => step.label ?? step.caption ?? JSON.stringify(step.cmd ?? step).slice(0, 100);

async function playSteps(context, recorder) {
  const { steps } = context.flow;
  const report = { changed: [], unverified: [], firstSkipped: 0 };
  for (const [index, step] of steps.entries()) {
    const label = `${String(index + 1).padStart(2)}/${steps.length} ${describe(step)}`;
    try {
      if (step.offCamera) recorder.stop();
      const outcome = await playStep(step, context);
      if (step.offCamera) recorder.start();
      if (outcome === 'played') {
        if (step.changesData) report.changed.push(describe(step));
        say(`  ✓ ${label}`);
      } else {
        report.firstSkipped ||= index + 1;
        say(`  ~ ${label}  (changes data: ${outcome === 'probed' ? 'target found' : 'no target to check'}, not performed)`);
      }
    } catch (error) {
      // In a dry run a later step may depend on a data change that was not performed.
      if (!(DRY && report.firstSkipped)) throw Object.assign(error, { stepNumber: index + 1, label, report });
      report.unverified.push(index + 1);
      say(`  ? ${label}  (not verified: depends on step ${report.firstSkipped}?)`);
    }
  }
  return report;
}

function writeSheet(video) {
  const duration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]));
  const { cols, rows } = sheetLayout(duration, SHEET_EVERY_SECONDS, SHEET_COLUMNS);
  const sheet = video.replace(/\.mp4$/, '.sheet.png');
  const filter = `fps=1/${SHEET_EVERY_SECONDS},scale=${SHEET_FRAME_WIDTH}:-1,tile=${cols}x${rows}`;
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf', filter, '-frames:v', '1', sheet]);
  return { duration, sheet };
}

function reportVideo(output) {
  const { duration, sheet } = writeSheet(output);
  const megabytes = statSync(output).size / 1024 / 1024;
  say(`\nsaved  ${output}  (${Math.round(duration)} s, ${megabytes.toFixed(1)} MB)`);
  say(`sheet  ${sheet}  (one frame every ${SHEET_EVERY_SECONDS} s: look at it before calling the video done)`);
  if (megabytes > SIZE_WARNING_MB) say(`note   larger than ${SIZE_WARNING_MB} MB: check the upload limit of where it goes`);
}

function listChanges(changed) {
  if (changed.length > 0) say(`\nchanged data in the app:\n  - ${changed.join('\n  - ')}`);
}

async function main() {
  const flow = loadFlow(flowPath);
  const baseUrl = (process.env.DEMO_BASE_URL ?? flow.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const output = join(dirname(resolve(flowPath)), `${basename(flowPath).replace(/(\.flow)?\.json$/, '')}.mp4`);
  const failedShot = output.replace(/\.mp4$/, '.failed.png');
  requireTools(DRY ? [BIN] : [BIN, 'ffmpeg', 'ffprobe']);
  await requireApp(baseUrl);

  const browser = createBrowser(flow);
  const recorder = createRecorder(browser, output);
  const context = { browser, flow, baseUrl, pace: { ...DEFAULT_PACE, ...flow.pace } };
  const [width, height] = flow.viewport ?? DEFAULT_VIEWPORT;

  try {
    browser.ab(['close']);
  } catch {
    // No earlier demo-video session was open: nothing to close.
  }
  if (!DRY) recorder.prepare();
  rmSync(failedShot, { force: true });

  let failed = false;
  try {
    browser.ab(['set', 'viewport', String(width), String(height), String(flow.scale ?? DEFAULT_SCALE)]);
    browser.ab(['open', `${baseUrl}${flow.start ?? '/'}`]);
    const timeout = flow.timeout ?? DEFAULT_TIMEOUT_MS;
    if (flow.startWait) await browser.abRetry(resolveArgs(flow.startWait, baseUrl), timeout);
    // Setup commands shape the first frame (a filter, a scroll) and are never filmed.
    for (const command of flow.setup ?? []) await browser.abRetry(resolveArgs(command, baseUrl), timeout);
    say(`${DRY ? 'DRY RUN' : 'RECORDING'}  ${flow.name}  (${baseUrl})`);
    recorder.start();
    const report = await playSteps(context, recorder);
    recorder.stop();
    if (DRY) {
      const open = report.unverified.length > 0 ? `; not verified: steps ${report.unverified.join(', ')}` : '';
      say(`\ndry run finished, nothing recorded${open}`);
    } else {
      recorder.finish();
      reportVideo(output);
      listChanges(report.changed);
    }
  } catch (error) {
    failed = true;
    process.stderr.write(`  ✗ ${error.label ?? 'setup'}\n    ${error.message}\n`);
    try {
      browser.ab(['screenshot', failedShot]);
      process.stderr.write(`    screenshot: ${failedShot}\n`);
    } catch {
      // The browser is not in a state to take a screenshot; the error above is the report.
    }
    try {
      recorder.stop();
    } catch {
      // The recording was already stopped or never started.
    }
    if (!DRY) recorder.discard();
    listChanges(error.report?.changed ?? []);
  } finally {
    if (!KEEP_OPEN) {
      try {
        browser.ab(['close']);
      } catch {
        // The session is already closed.
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`demo-video: ${error.message}\n`);
  process.exit(1);
});
