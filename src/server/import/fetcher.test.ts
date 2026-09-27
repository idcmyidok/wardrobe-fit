import http from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isBlockedIp } from "@/server/security/url-guard";
import { safeFetch, type FetchOptions } from "./fetcher";

/**
 * 로컬 테스트 서버를 "공개 쇼핑몰"(shop.test)처럼 보이게 해서 fetcher의 방어를 확인한다.
 * 127.0.0.1만 예외로 허용하고 나머지 차단 규칙은 실제와 같다.
 */

let server: http.Server;
let port = 0;
const EUC_KR_BODY = Buffer.from([0x3c, 0x70, 0x3e, 0xc7, 0xd1, 0xb1, 0xdb, 0x3c, 0x2f, 0x70, 0x3e]); // <p>한글</p>

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = req.url ?? "/";
    const host = `shop.test:${port}`;
    if (path === "/ok") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<title>상품</title>");
    } else if (path === "/euc-kr") {
      res.writeHead(200, { "content-type": "text/html; charset=euc-kr" });
      res.end(EUC_KR_BODY);
    } else if (path === "/image") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end("png");
    } else if (path === "/huge") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("a".repeat(4 * 1024 * 1024));
    } else if (path === "/bomb") {
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
      res.end(gzipSync(Buffer.alloc(20 * 1024 * 1024, 97)));
    } else if (path === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("late");
      }, 1000);
    } else if (path === "/to-metadata") {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" });
      res.end();
    } else if (path === "/to-private-name") {
      res.writeHead(302, { location: `http://intranet.test:${port}/ok` });
      res.end();
    } else if (path.startsWith("/loop/")) {
      const n = Number(path.split("/")[2]);
      res.writeHead(302, { location: `http://${host}/loop/${n + 1}` });
      res.end();
    } else if (path === "/redirect-ok") {
      res.writeHead(301, { location: "/ok" });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const DNS: Record<string, string> = { "shop.test": "127.0.0.1", "intranet.test": "10.0.0.5" };
const opts = (extra: FetchOptions = {}): FetchOptions => ({
  allowedPorts: new Set(["", "80", "443", String(port)]),
  resolve: async (host) => (DNS[host] ? [{ address: DNS[host], family: 4 }] : []),
  isBlocked: (ip) => ip !== "127.0.0.1" && isBlockedIp(ip),
  ...extra,
});
const url = (path: string) => `http://shop.test:${port}${path}`;

describe("safeFetch", () => {
  it("HTML을 받아 온다", async () => {
    const page = await safeFetch(url("/ok"), opts());
    expect(page.body).toBe("<title>상품</title>");
  });

  it("EUC-KR 페이지를 한글로 읽는다", async () => {
    expect((await safeFetch(url("/euc-kr"), opts())).body).toBe("<p>한글</p>");
  });

  it("같은 사이트 redirect는 따라가고 최종 주소를 알려 준다", async () => {
    const page = await safeFetch(url("/redirect-ok"), opts());
    expect(page.url.pathname).toBe("/ok");
  });

  it("DNS가 사설 IP를 가리키면 막는다", async () => {
    await expect(safeFetch(`http://intranet.test:${port}/ok`, opts())).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("실제 규칙에서는 루프백으로 풀리는 이름도 막는다", async () => {
    await expect(safeFetch(url("/ok"), opts({ isBlocked: isBlockedIp }))).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("메타데이터 주소로 redirect하면 막는다", async () => {
    await expect(safeFetch(url("/to-metadata"), opts())).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("사설 IP 이름으로 redirect하면 막는다", async () => {
    await expect(safeFetch(url("/to-private-name"), opts())).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("redirect는 3번까지만 따라간다", async () => {
    await expect(safeFetch(url("/loop/0"), opts())).rejects.toMatchObject({ code: "too_many_redirects" });
  });

  it("3MB를 넘으면 중단한다", async () => {
    await expect(safeFetch(url("/huge"), opts())).rejects.toMatchObject({ code: "too_large" });
  });

  it("압축을 풀어 3MB를 넘으면 중단한다(gzip bomb)", async () => {
    await expect(safeFetch(url("/bomb"), opts())).rejects.toMatchObject({ code: "too_large" });
  });

  it("HTML/JSON이 아니면 중단한다", async () => {
    await expect(safeFetch(url("/image"), opts())).rejects.toMatchObject({ code: "unsupported_content" });
  });

  it("제한 시간이 지나면 중단한다", async () => {
    await expect(safeFetch(url("/slow"), opts({ timeoutMs: 200 }))).rejects.toMatchObject({ code: "timeout" });
  });

  it("80/443이 아닌 포트는 기본으로 막는다", async () => {
    await expect(safeFetch(url("/ok"), opts({ allowedPorts: undefined }))).rejects.toMatchObject({ code: "blocked_port" });
  });
});
