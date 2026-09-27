import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { checkUrlShape, isBlockedIp } from "@/server/security/url-guard";
import { ImportError } from "./types";

/**
 * 상품 페이지를 안전하게 한 번 받아 온다(PROJECT_SPEC.md 12.3).
 * - 접속 직전 DNS 결과의 모든 IP를 검사한다(검사한 IP로만 접속하므로 DNS rebinding이 통하지 않는다).
 * - redirect는 매번 다시 검사하고 최대 3번까지 따라간다.
 * - 압축을 푼 본문 기준 3MB, 전체 10초 제한. HTML/JSON이 아니면 중단한다.
 */

export const FETCH_LIMITS = { maxBytes: 3 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 3 };
export const USER_AGENT = "WardrobeFitBot/1.0 (+personal wardrobe size helper; one request per user action)";

export interface FetchedPage {
  /** redirect를 따라간 뒤의 최종 주소 */
  url: URL;
  status: number;
  contentType: string;
  body: string;
}

export interface FetchOptions {
  accept?: "html" | "json";
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** 테스트에서 DNS를 바꿔 끼울 때만 쓴다. */
  resolve?: (hostname: string) => Promise<LookupAddress[]>;
  /** 테스트에서 차단 규칙을 바꿔 끼울 때만 쓴다. */
  isBlocked?: (ip: string) => boolean;
  /** 테스트 서버 포트를 허용할 때만 쓴다. 기본은 80/443 */
  allowedPorts?: ReadonlySet<string>;
}

const defaultResolve = (hostname: string) =>
  new Promise<LookupAddress[]>((resolve, reject) =>
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => (err ? reject(err) : resolve(addresses))),
  );

export async function safeFetch(input: string | URL, options: FetchOptions = {}): Promise<FetchedPage> {
  const limits = {
    maxBytes: options.maxBytes ?? FETCH_LIMITS.maxBytes,
    timeoutMs: options.timeoutMs ?? FETCH_LIMITS.timeoutMs,
    maxRedirects: options.maxRedirects ?? FETCH_LIMITS.maxRedirects,
  };
  const deadline = Date.now() + limits.timeoutMs;
  let current = typeof input === "string" ? input : input.toString();

  for (let hop = 0; hop <= limits.maxRedirects; hop++) {
    const shape = checkUrlShape(current, options.allowedPorts);
    if (!shape.ok) throw new ImportError(shape.reason, current);
    const res = await requestOnce(shape.url, options, limits.maxBytes, deadline);
    if (res.page) return { ...res.page, url: shape.url };
    current = new URL(res.redirect, shape.url).toString();
  }
  throw new ImportError("too_many_redirects");
}

type OnceResult = { redirect: string; page?: never } | { redirect?: never; page: Omit<FetchedPage, "url"> };

function requestOnce(url: URL, options: FetchOptions, maxBytes: number, deadline: number): Promise<OnceResult> {
  const resolve = options.resolve ?? defaultResolve;
  const isBlocked = options.isBlocked ?? isBlockedIp;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new ImportError("timeout"));

  // 접속할 IP를 여기서 고른다. 하나라도 막힌 대역이면 접속하지 않는다.
  const lookup: LookupFunction = (hostname, lookupOptions, callback) => {
    resolve(hostname).then(
      (addresses) => {
        if (!addresses.length) return callback(new ImportError("dns_failed", hostname), "", 0);
        if (addresses.some((a) => isBlocked(a.address))) return callback(new ImportError("blocked_host", hostname), "", 0);
        if (lookupOptions.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
      },
      (err: Error) => callback(new ImportError("dns_failed", err.message), "", 0),
    );
  };

  const client = url.protocol === "https:" ? https : http;
  const accept = options.accept === "json" ? "application/json" : "text/html,application/xhtml+xml,application/json;q=0.8";

  return new Promise<OnceResult>((resolvePromise, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        lookup,
        // 연결을 재사용하지 않는다. 매 요청(redirect 포함)이 위 lookup의 IP 검사를 거치게 한다.
        agent: false,
        timeout: remaining,
        headers: {
          "user-agent": USER_AGENT,
          accept,
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolvePromise({ redirect: res.headers.location });
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(new ImportError("http_error", String(status)));
          return;
        }
        const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
        if (!/text\/html|application\/xhtml\+xml|application\/(ld\+)?json|text\/plain/.test(contentType)) {
          res.resume();
          reject(new ImportError("unsupported_content", contentType || "unknown"));
          return;
        }
        const declared = Number(res.headers["content-length"]);
        if (declared > maxBytes && !res.headers["content-encoding"]) {
          res.destroy();
          reject(new ImportError("too_large"));
          return;
        }

        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip"
            ? res.pipe(createGunzip())
            : encoding === "br"
              ? res.pipe(createBrotliDecompress())
              : encoding === "deflate"
                ? res.pipe(createInflate())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let aborted = false;
        stream.on("data", (chunk: Buffer) => {
          if (aborted) return;
          size += chunk.length;
          if (size > maxBytes) {
            aborted = true;
            reject(new ImportError("too_large"));
            req.destroy();
            if (stream !== res) stream.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => {
          if (aborted) return;
          const buffer = Buffer.concat(chunks);
          resolvePromise({ page: { status, contentType, body: decode(buffer, contentType) } });
        });
        stream.on("error", (err) => reject(err instanceof ImportError ? err : new ImportError("network_error", err.message)));
      },
    );
    req.on("timeout", () => req.destroy(new ImportError("timeout")));
    req.on("error", (err) => reject(err instanceof ImportError ? err : new ImportError("network_error", err.message)));
    req.end();
  });
}

/** content-type 또는 <meta charset>의 문자 집합으로 읽는다(국내 쇼핑몰 일부는 EUC-KR). */
function decode(buffer: Buffer, contentType: string): string {
  const head = buffer.subarray(0, 2048).toString("latin1");
  const charset =
    contentType.match(/charset=["']?([\w-]+)/)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}
