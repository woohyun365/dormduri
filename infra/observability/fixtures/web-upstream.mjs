import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4100);

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'web-upstream'}`);

  if (url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (url.pathname !== '/api/bookmarks') {
    sendJson(response, 404, { code: 'NOT_FOUND' });
    return;
  }

  if (url.searchParams.get('mode') === 'invalid') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('invalid upstream response');
    return;
  }

  if (url.searchParams.get('mode') === 'timeout') {
    setTimeout(() => {
      if (!response.writableEnded) sendJson(response, 200, { items: [] });
    }, 9_000);
    return;
  }

  sendJson(response, 200, { items: [], nextCursor: null });
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`web upstream fixture ready on ${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
