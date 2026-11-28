import { describe, it, expect } from 'vitest';
import { isPublicAddress } from '../src/adapters/http/ip-guard.js';
import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { SafeTextFetcher, readCapped } from '../src/adapters/http/safe-text-fetcher.js';

const LIMITS = { maxBytes: 1024, timeoutMs: 2000, maxRedirects: 3 };

const statusOf = async (p: Promise<unknown>): Promise<number | undefined> => {
  try {
    await p;
    return undefined;
  } catch (err) {
    return (err as { statusCode?: number }).statusCode;
  }
};

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '140.82.112.3', '2606:4700:4700::1111', '[2606:4700:4700::1111]'])('allows %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '64:ff9b::a9fe:a9fe',
    '0:0:0:0:0:ffff:7f00:1',
    '0000:0000:0000:0000:0000:ffff:7f00:0001',
    '::ffff:0:7f00:1',
    '::7f00:1',
    '::127.0.0.1',
    '::ffff:8.8.8.8',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});

describe('SafeTextFetcher refuses before it downloads', () => {
  const fetcher = new SafeTextFetcher();

  it.each([
    'http://example.com/skill.md',
    'ftp://example.com/skill.md',
    'https://user:pass@example.com/skill.md',
    'https://example.com:8443/skill.md',
    'https://127.0.0.1/skill.md',
    'https://[::1]/skill.md',
    'https://169.254.169.254/latest/meta-data',
    'not a url',
  ])('refuses %s with 422', async (url) => {
    expect(await statusOf(fetcher.fetchText(url, LIMITS))).toBe(422);
  });

  it('refuses a host name that resolves to a loopback address', async () => {
    expect(await statusOf(fetcher.fetchText('https://localhost/skill.md', LIMITS))).toBe(422);
  });
});

describe('readCapped', () => {
  const stream = () => new PassThrough() as unknown as IncomingMessage & PassThrough;

  it('fails a body that is still trickling in at the deadline, even after the headers arrived', async () => {
    const res = stream();
    res.write('partial');
    const started = Date.now();
    const status = await statusOf(readCapped(res, 1024, started + 50));
    expect(status).toBe(502);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('stops reading past the size limit', async () => {
    const res = stream();
    const read = readCapped(res, 4, Date.now() + 5000);
    res.write('12345');
    expect(await statusOf(read)).toBe(413);
  });

  it('returns a body that ends in time', async () => {
    const res = stream();
    const read = readCapped(res, 1024, Date.now() + 5000);
    res.end('# skill');
    await expect(read).resolves.toBe('# skill');
  });
});
