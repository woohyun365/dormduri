import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire('/workspace/apps/web/package.json');
const { NextRequest } = require('next/server');
const { forwardBffRequest } = await import('/workspace/apps/web/src/app/api/_bff/forward.ts');
const { forwardAuthRequest } = await import('/workspace/apps/web/src/auth/bff/auth-forward.ts');
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      res.end('fixture-web-ready');
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const request = new NextRequest(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    let response;
    if (req.url === '/fixture/generic-ticket') {
      response = await forwardBffRequest({
        request,
        method: 'POST',
        path: '/api/chat/realtime/tickets',
        authenticated: true,
        operation: 'fixture.ticket',
        bodyMode: 'none',
      });
    } else if (req.url === '/fixture/auth-probe') {
      const result = await forwardAuthRequest(
        'GET',
        '/auth/fixture/probe',
        undefined,
        { headers: { 'X-Forwarded-For': '198.51.100.222', 'X-Forwarded-Proto': 'http' } },
        { requestHeaders: request.headers },
      );
      response = new Response(JSON.stringify(result.json), {
        status: result.response.status,
        headers: { 'content-type': 'application/json' },
      });
    } else {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500).end(JSON.stringify({ fixtureError: error.message }));
  }
});
server.listen(3000, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
