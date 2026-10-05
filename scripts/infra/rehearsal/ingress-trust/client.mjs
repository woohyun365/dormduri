import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

function options(input) {
  const url = new URL(input.url);
  return {
    headers: input.headers ?? {},
    timeout: 2500,
    ...(url.protocol === 'https:'
      ? {
          servername: input.servername ?? (input.headers?.Host ?? url.hostname).split(':')[0],
          ca: readFileSync(process.env.INGRESS_FIXTURE_CA ?? '/fixture-tls/ca.crt'),
        }
      : {}),
  };
}
export function expectedReset(input, error) {
  return input.expectReset === true && error?.code === 'ECONNRESET';
}
export async function httpCall(input) {
  return new Promise((resolve, reject) => {
    const factory = input.url.startsWith('https:') ? requestHttps : requestHttp;
    const req = factory(input.url, { ...options(input), method: input.method ?? 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) req.destroy(new Error('Oversized fixture response'));
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', (error) => {
      if (expectedReset(input, error)) resolve({ reset: true });
      else reject(error);
    });
    req.on('timeout', () => req.destroy(new Error('Fixture request timeout')));
    req.end(input.body);
  });
}
export async function tcpReachable({ address, port }) {
  return new Promise((resolve) => {
    const socket = connect({ host: address, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
export async function polling(input) {
  const path = `${input.url}/socket.io/?EIO=4&transport=polling`;
  const opened = await httpCall({ ...input, url: path });
  if (opened.status !== 200) return opened;
  const sid = JSON.parse(opened.body.slice(1)).sid;
  const url = `${path}&sid=${encodeURIComponent(sid)}`;
  try {
    await httpCall({
      ...input,
      url,
      method: 'POST',
      headers: { ...input.headers, 'Content-Type': 'text/plain' },
      body: `40/chat,${JSON.stringify({ ticket: input.ticket })}`,
    });
    const packet = await httpCall({ ...input, url });
    return { ...packet, opened: opened.status };
  } finally {
    await httpCall({
      ...input,
      url,
      method: 'POST',
      headers: { ...input.headers, 'Content-Type': 'text/plain' },
      body: '1',
    }).catch(() => {});
  }
}
export async function websocket(input) {
  return new Promise((resolve, reject) => {
    let socket;
    const factory = input.url.startsWith('https:') ? requestHttps : requestHttp;
    const req = factory(`${input.url}/socket.io/?EIO=4&transport=websocket`, {
      ...options(input),
      headers: {
        ...input.headers,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    });
    const timeout = setTimeout(() => finish(new Error('WebSocket namespace timeout')), 3000);
    const finish = (error, result) => {
      clearTimeout(timeout);
      socket?.destroy();
      req.destroy();
      error ? reject(error) : resolve(result);
    };
    req.on('error', (error) => finish(error));
    req.once('response', (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => finish(null, { status: res.statusCode, body }));
    });
    req.once('upgrade', (_res, upgraded, head) => {
      socket = upgraded;
      let buffer = Buffer.alloc(0);
      const send = (text) => {
        const payload = Buffer.from(text),
          mask = randomBytes(4);
        if (payload.length >= 126) throw new Error('Oversized fixture packet');
        socket.write(
          Buffer.concat([
            Buffer.from([0x81, 0x80 | payload.length]),
            mask,
            Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4])),
          ]),
        );
      };
      const receive = (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          const opcode = buffer[0] & 15;
          let length = buffer[1] & 127,
            offset = 2;
          if (length === 126) {
            if (buffer.length < 4) return;
            length = buffer.readUInt16BE(2);
            offset = 4;
          }
          if (length === 127 || buffer[1] & 128)
            return finish(new Error('Unexpected fixture frame'));
          if (buffer.length < offset + length) return;
          const packet = buffer.subarray(offset, offset + length).toString();
          buffer = buffer.subarray(offset + length);
          if (opcode !== 1) continue;
          if (packet.startsWith('0')) send(`40/chat,${JSON.stringify({ ticket: input.ticket })}`);
          if (packet === '2') send('3');
          if (packet.startsWith('40/chat,')) return finish(null, { status: 101, body: packet });
          if (packet.startsWith('44/chat,') || packet.startsWith('42/chat,'))
            return finish(new Error(`Namespace rejected: ${packet}`));
        }
      };
      socket.on('data', receive);
      socket.once('error', (error) => finish(error));
      if (head.length) receive(head);
    });
    req.end();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  const input = JSON.parse(process.argv[2]);
  const methods = {
    http: httpCall,
    tcp: tcpReachable,
    polling,
    websocket,
    routes: () => ({ routes: readFileSync('/proc/net/route', 'utf8') }),
  };
  if (!methods[input.action]) throw new Error('Unknown fixture client action');
  const result = await methods[input.action](input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
