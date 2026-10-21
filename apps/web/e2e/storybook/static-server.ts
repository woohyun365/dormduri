import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

// Serves the Storybook static build for playwright.storybook.config.ts.
// Usage: node e2e/storybook/static-server.ts <directory> <port>
const [directory = 'storybook-static', port = '6106'] = process.argv.slice(2);
const root = resolve(directory);

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function filePathFor(url: string | undefined): string | undefined {
  const pathname = decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname);
  const path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) return undefined;
  try {
    const stats = statSync(path);
    if (stats.isFile()) return path;
    if (stats.isDirectory() && statSync(join(path, 'index.html')).isFile())
      return join(path, 'index.html');
  } catch {
    return undefined;
  }
  return undefined;
}

createServer((request, response) => {
  const path = filePathFor(request.url);
  if (!path) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream',
  });
  createReadStream(path).pipe(response);
}).listen(Number(port), '127.0.0.1');
