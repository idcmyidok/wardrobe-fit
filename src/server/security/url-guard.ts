import { BlockList, isIP } from "node:net";

/**
 * 서버가 사용자가 준 URL에 접속하기 전 검사(PROJECT_SPEC.md 12.3, SSRF 방어).
 * - http/https만, 포트는 80/443만
 * - 사설·루프백·링크로컬·메타데이터·예약 대역 IP는 막는다(DNS 결과와 IP 직접 입력 모두).
 * 실제 접속 IP 검사는 fetcher의 lookup에서 한 번 더 한다(DNS rebinding 방지).
 */

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // 링크로컬, 클라우드 메타데이터(169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // 멀티캐스트
  ["240.0.0.0", 4], // 예약·브로드캐스트
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // ULA
  ["fe80::", 10], // 링크로컬
  ["ff00::", 8], // 멀티캐스트
  ["2001:db8::", 32], // 문서용
  ["100::", 64], // discard
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** IPv6 안에 IPv4가 들어 있는 형태(::ffff:a.b.c.d, 64:ff9b::a.b.c.d 등)에서 IPv4를 꺼낸다. */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = lower.match(/^(?:::ffff:|::ffff:0:|64:ff9b::|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** 접속하면 안 되는 IP인지. 형식이 IP가 아니면 막는다. */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return blocked.check(ip, "ipv4");
  if (version === 6) {
    const v4 = embeddedIpv4(ip);
    if (v4) return blocked.check(v4, "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true;
}

export const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "invalid_url" | "blocked_host" | "blocked_port" };

/** DNS 조회 전에 할 수 있는 검사: 스킴, 포트, 계정 정보, IP 직접 입력, localhost 이름 */
export function checkUrlShape(input: string | URL, allowedPorts: ReadonlySet<string> = ALLOWED_PORTS): UrlCheck {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "invalid_url" };
  if (url.username || url.password) return { ok: false, reason: "invalid_url" };
  if (!allowedPorts.has(url.port)) return { ok: false, reason: "blocked_port" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "blocked_host" };
  }
  if (isIP(host) && isBlockedIp(host)) return { ok: false, reason: "blocked_host" };
  return { ok: true, url };
}
