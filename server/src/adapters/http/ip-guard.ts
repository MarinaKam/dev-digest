import { BlockList, isIP } from 'node:net';

/**
 * Address ranges a server-side download must never reach: this host, private
 * networks, link-local (cloud metadata at 169.254.169.254), carrier-grade NAT,
 * documentation, benchmarking, multicast and reserved ranges.
 */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const BLOCKED_V6: Array<[string, number]> = [
  // IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d,
  // ::ffff:0:a.b.c.d) addresses are refused whole: a resolver answering with
  // one is not a normal public host, and checking the embedded IPv4 would
  // depend on parsing every spelling of the address the same way.
  ['::', 96],
  ['::ffff:0:0', 96],
  ['::ffff:0:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

// Two lists: BlockList also matches an IPv4 address against an IPv6 rule for
// ::ffff:0:0/96, so with one list the mapped range would block every IPv4.
const blockedV4 = new BlockList();
for (const [net, prefix] of BLOCKED_V4) blockedV4.addSubnet(net, prefix, 'ipv4');
const blockedV6 = new BlockList();
for (const [net, prefix] of BLOCKED_V6) blockedV6.addSubnet(net, prefix, 'ipv6');

/** True only for a syntactically valid address outside every blocked range. */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const family = isIP(bare);
  if (family === 4) return !blockedV4.check(bare, 'ipv4');
  if (family !== 6) return false;
  // BlockList parses the address itself, so every spelling of one address
  // (compressed, expanded, dotted tail) is checked the same way.
  return !blockedV6.check(bare, 'ipv6');
}
