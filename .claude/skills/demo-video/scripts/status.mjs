#!/usr/bin/env node
// Reads or writes the status line of a video in a scenario file.
//
//   node status.mjs <scenario.md> --list
//   node status.mjs <scenario.md> <N> recorded <video.mp4>
//   node status.mjs <scenario.md> <N> failed "<short reason>"
//   node status.mjs <scenario.md> <N> pending
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { listStatuses, setStatus, statusLine } from './lib.mjs';

const USAGE =
  'usage: node status.mjs <scenario.md> --list\n' +
  '       node status.mjs <scenario.md> <N> recorded <video.mp4> | failed "<reason>" | pending';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function videoSeconds(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      encoding: 'utf8',
    });
    return Math.round(Number(out));
  } catch {
    return undefined; // ffprobe is missing or cannot read the file: the status line omits the length
  }
}

const [file, target, state, extra] = process.argv.slice(2);
if (!file || !target) fail(USAGE, 2);
if (!existsSync(file)) fail(`scenario not found: ${file}`);

const markdown = readFileSync(file, 'utf8');

if (target === '--list') {
  for (const video of listStatuses(markdown)) process.stdout.write(`${video.title}  ${video.status}\n`);
  process.exit(0);
}

const n = Number(target);
if (!Number.isInteger(n) || n < 1) fail(`video number must be a positive integer, got "${target}"`, 2);
if (!['recorded', 'failed', 'pending'].includes(state)) fail(USAGE, 2);
if (state === 'recorded' && (!extra || !existsSync(extra))) fail(`video file not found: ${extra}`);

const date = new Date().toISOString().slice(0, 10);
const details =
  state === 'recorded'
    ? { date, name: basename(extra), link: relative(dirname(resolve(file)), resolve(extra)), seconds: videoSeconds(extra) }
    : { date, reason: extra };

try {
  const line = statusLine(state, details);
  writeFileSync(file, setStatus(markdown, n, line));
  process.stdout.write(`Video ${n}: ${line.replace('**Status:** ', '')}\n`);
} catch (error) {
  fail(error.message);
}
