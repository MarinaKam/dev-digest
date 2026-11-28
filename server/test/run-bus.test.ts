import { describe, it, expect } from 'vitest';
import { RunBus } from '../src/platform/sse.js';

describe('RunBus cancellation', () => {
  it('a cancelled run stays cancelled after its stream is completed', () => {
    // Cancel completes the stream at once (so the UI stops waiting), while the
    // runner is still between two model calls and has yet to look at the flag.
    const bus = new RunBus();

    bus.cancel('run-1');
    bus.complete('run-1');

    expect(bus.isCancelled('run-1')).toBe(true);
  });

  it('a run that was never cancelled is not cancelled after it completes', () => {
    const bus = new RunBus();

    bus.complete('run-2');

    expect(bus.isCancelled('run-2')).toBe(false);
  });
});
