/**
 * Ports of the skills module. The adapter implements them; the service gets
 * them from the container and never imports an adapter.
 */

/** Limits one download must stay within. */
export interface TextFetchLimits {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
}

/** A downloaded text file and where it finally came from (after redirects). */
export interface FetchedText {
  text: string;
  finalUrl: string;
  contentType: string;
}

/**
 * Downloads a text file from a public https URL for the skill import. Refuses
 * hosts that resolve to a private, loopback or link-local address, at every
 * redirect, and stops reading past `maxBytes`.
 */
export interface TextFetcher {
  fetchText(url: string, limits: TextFetchLimits): Promise<FetchedText>;
}
