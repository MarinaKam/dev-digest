import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { isIP, type LookupFunction } from 'node:net';
import type { FetchedText, TextFetcher, TextFetchLimits } from '../../modules/skills/ports.js';
import {
  ExternalServiceError,
  PayloadTooLargeError,
  ValidationError,
} from '../../platform/errors.js';
import { isPublicAddress } from './ip-guard.js';

/** Content types accepted as a markdown skill. HTML is a page, not the raw file. */
const TEXT_TYPE = /^(text\/(?!html)[a-z0-9.+-]+|application\/(markdown|x-markdown|octet-stream))$/i;

/**
 * DNS lookup that resolves every address of the host and fails unless all are
 * public. The socket connects to the address checked here, so a second
 * resolution (DNS rebinding) cannot swap in a private one.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as LookupAddress[];
    const first = list[0];
    if (!first || list.some((a) => !isPublicAddress(a.address))) {
      return callback(blockedHost(hostname), '', 4);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    }
    return callback(null, first.address, first.family);
  });
};

function blockedHost(host: string): ValidationError {
  return new ValidationError(`The host ${host} is not a public address`);
}

/** Validate one URL of the chain: https, no credentials, default port, public literal IP. */
function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError('Enter a valid URL');
  }
  if (url.protocol !== 'https:') throw new ValidationError('Only https:// URLs can be imported');
  if (url.username || url.password) throw new ValidationError('A URL with credentials cannot be imported');
  if (url.port && url.port !== '443') throw new ValidationError('Only the default https port is allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) throw blockedHost(host);
  return url;
}

/** Downloads a skill file over https with the SSRF guard of spec 004. */
export class SafeTextFetcher implements TextFetcher {
  async fetchText(raw: string, limits: TextFetchLimits): Promise<FetchedText> {
    // One deadline for the whole download: every redirect hop and the body.
    const deadline = Date.now() + limits.timeoutMs;
    let url = checkUrl(raw);
    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      const res = await this.open(url, deadline);
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        url = checkUrl(new URL(res.headers.location, url).toString());
        continue;
      }
      if (status !== 200) {
        res.resume();
        throw new ExternalServiceError(`The server answered ${status} for ${url.hostname}`);
      }
      const contentType = (res.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
      if (!TEXT_TYPE.test(contentType)) {
        res.resume();
        throw new ValidationError(
          `The URL returned ${contentType || 'no content type'}, not a text file. Use the raw file URL.`,
        );
      }
      const text = await readCapped(res, limits.maxBytes, deadline);
      return { text, finalUrl: url.toString(), contentType };
    }
    throw new ValidationError(`More than ${limits.maxRedirects} redirects`);
  }

  /** Send the request and resolve with the response headers, before the deadline. */
  private open(url: URL, deadline: number): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const left = Math.max(0, deadline - Date.now());
      const req = request(
        url,
        {
          method: 'GET',
          lookup: guardedLookup,
          headers: { accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1', 'user-agent': 'DevDigest-skill-import' },
          timeout: left,
        },
        resolve,
      );
      // Covers connecting and waiting for headers; the body has its own timer
      // in readCapped against the same deadline.
      const timer = setTimeout(() => req.destroy(timedOut()), left);
      req.on('response', () => clearTimeout(timer));
      req.on('timeout', () => req.destroy(timedOut()));
      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err instanceof ValidationError || err instanceof ExternalServiceError
          ? err
          : new ExternalServiceError(`The download failed: ${err.message}`));
      });
      req.end();
    });
  }
}

function timedOut(): ExternalServiceError {
  return new ExternalServiceError('The download timed out');
}

/**
 * Read the body, failing as soon as it passes `maxBytes` (the size header is
 * not trusted) or when `deadline` (epoch ms) passes before the body ends, so a
 * server that sends headers and then trickles bytes cannot hold the request.
 */
export function readCapped(res: IncomingMessage, maxBytes: number, deadline: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () => finish(() => {
        res.destroy();
        reject(timedOut());
      }),
      Math.max(0, deadline - Date.now()),
    );
    res.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        finish(() => {
          res.destroy();
          reject(new PayloadTooLargeError(`The file is larger than ${maxBytes} bytes`));
        });
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () =>
      finish(() => {
        const buf = Buffer.concat(chunks);
        if (buf.includes(0)) reject(new ValidationError('The file is not text'));
        else resolve(buf.toString('utf8'));
      }),
    );
    res.on('error', (err) => finish(() => reject(new ExternalServiceError(`The download failed: ${err.message}`))));
  });
}
