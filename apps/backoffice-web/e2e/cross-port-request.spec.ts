import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A page on another localhost port is the same site as `http://localhost:4300` (the port is not part of the site), so
 * its image and prefetch requests would carry the `SameSite=Strict` cookie. src/proxy.ts refuses them (README §5).
 * The flow spec sends the header itself through a request context; here the real Chromium sends it: the page below is
 * served by this test on a free localhost port and asks the backoffice for an image and a prefetch.
 *
 * The browser blocks the 403 text body of the image (ORB) and drops the prefetch, so Playwright's request API never
 * sees their response or the Fetch Metadata it sent. The Chrome DevTools Protocol reports the headers on the wire and
 * the status of every request, blocked ones included.
 */
const BACKOFFICE = 'http://localhost:4300';
const IMAGE_URL = `${BACKOFFICE}/login`;
const PREFETCH_URL = `${BACKOFFICE}/`;

let server: Server;
let pageUrl: string;

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      `<!doctype html><html lang="ko"><head><title>다른 port page</title>` +
        `<link rel="prefetch" href="${PREFETCH_URL}"></head>` +
        `<body><img alt="" src="${IMAGE_URL}"></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  pageUrl = `http://localhost:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

interface WireRecord {
  url?: string;
  headers?: Record<string, string>;
  status?: number;
}

test('a page on another localhost port gets 403 for its same-site image and prefetch requests', async ({
  page,
}) => {
  const records = new Map<string, WireRecord>();
  const record = (requestId: string) => {
    const found = records.get(requestId) ?? {};
    records.set(requestId, found);
    return found;
  };
  // A redirect keeps the request id and sends each hop again, so only the first hop is kept: the request the page
  // made and the answer it got (a proxy that let it through would answer the session-less `/` with a redirect).
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Network.requestWillBeSent', (event) => {
    record(event.requestId).url ??= event.request.url;
  });
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    record(event.requestId).headers ??= Object.fromEntries(
      Object.entries(event.headers).map(([name, value]) => [name.toLowerCase(), String(value)]),
    );
  });
  cdp.on('Network.responseReceivedExtraInfo', (event) => {
    record(event.requestId).status ??= event.statusCode;
  });
  await cdp.send('Network.enable');

  await page.goto(pageUrl);
  const wire = (url: string) => [...records.values()].find((entry) => entry.url === url);
  await expect
    .poll(() => [IMAGE_URL, PREFETCH_URL].map((url) => wire(url)?.status ?? null))
    .toEqual([403, 403]);

  for (const url of [IMAGE_URL, PREFETCH_URL]) {
    expect(wire(url)?.headers?.['sec-fetch-site'], url).toBe('same-site');
  }
  expect(wire(IMAGE_URL)?.headers?.['sec-fetch-dest']).toBe('image');
  expect(wire(PREFETCH_URL)?.headers?.['sec-purpose']).toContain('prefetch');

  // Control: the same page typed into the address bar (`Sec-Fetch-Site: none`) opens.
  const direct = await page.goto(IMAGE_URL);
  expect(direct?.status()).toBe(200);
});
