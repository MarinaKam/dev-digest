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
  ['::', 128],
  ['::1', 128],
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

const blocked = new BlockList();
for (const [net, prefix] of BLOCKED_V4) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of BLOCKED_V6) blocked.addSubnet(net, prefix, 'ipv6');

/** The IPv4 address inside an IPv4-mapped or -compatible IPv6 address, if any. */
function embeddedV4(address: string): string | null {
  const m = /^::(?:ffff(?::0{1,4})?:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (m?.[1]) return m[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (!hex?.[1] || !hex[2]) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** True only for a syntactically valid address outside every blocked range. */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const family = isIP(bare);
  if (family === 4) return !blocked.check(bare, 'ipv4');
  if (family !== 6) return false;
  const v4 = embeddedV4(bare);
  if (v4) return isIP(v4) === 4 && !blocked.check(v4, 'ipv4');
  return !blocked.check(bare, 'ipv6');
}
