import { afterEach, describe, expect, it } from 'vitest';
import { Controller, Get, Param, Req, type INestApplication } from '@nestjs/common';
import { NodeAdapter, type NodeRequest, type NodeTrustProxy } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHttpAdapter, HTTP_MAX_PARAM_LENGTH, toNodeTrustProxy } from './http-adapter.js';
import type { HttpTrustProxy } from './http.config.js';

@Controller('adapter-probe')
class AdapterProbeController {
  @Get('client')
  client(@Req() req: NodeRequest) {
    return { ip: req.ip, ips: req.ips, protocol: req.protocol };
  }

  @Get('items/:id')
  item(@Param('id') id: string) {
    return { length: id.length };
  }
}

const SOCKET_PEER = '127.0.0.1';
const CLIENT = '203.0.113.10';
const FORWARDING_PROXY = '10.0.0.1';

describe('toNodeTrustProxy', () => {
  it('keeps trust off and copies CIDR lists', () => {
    const cidrs = ['loopback', '10.0.0.0/8'];
    expect(toNodeTrustProxy(false)).toBe(false);
    expect(toNodeTrustProxy(cidrs)).toEqual(cidrs);
    expect(toNodeTrustProxy(cidrs)).not.toBe(cidrs);
  });

  it.each([1, 2])('turns %i hops into a per-hop function, never a bare number', (hops) => {
    const trust = toNodeTrustProxy(hops);
    expect(typeof trust).toBe('function');
    const decide = trust as (address: string, hop: number) => boolean;
    expect(Array.from({ length: hops + 1 }, (_, hop) => decide(CLIENT, hop))).toEqual([
      ...Array.from({ length: hops }, () => true),
      false,
    ]);
  });
});

describe('createHttpAdapter', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function listen(adapter: NodeAdapter): Promise<string> {
    const module = await Test.createTestingModule({
      controllers: [AdapterProbeController],
    }).compile();
    app = module.createNestApplication(adapter, { logger: false });
    await app.listen(0, SOCKET_PEER);
    return app.getUrl();
  }

  async function client(trustProxy: HttpTrustProxy, forwardedFor: string) {
    const url = await listen(createHttpAdapter(trustProxy));
    const response = await request(url)
      .get('/adapter-probe/client')
      .set('x-forwarded-for', forwardedFor)
      .set('x-forwarded-proto', 'https');
    expect(response.status).toBe(200);
    return response.body as { ip: string; ips: string[]; protocol: string };
  }

  // Expected values are what Express derived from the same "trust proxy" setting.
  it.each<[HttpTrustProxy, string, string, string]>([
    [false, `${CLIENT}, ${FORWARDING_PROXY}`, SOCKET_PEER, 'http'],
    [1, `${CLIENT}, ${FORWARDING_PROXY}`, FORWARDING_PROXY, 'https'],
    [2, `${CLIENT}, ${FORWARDING_PROXY}`, CLIENT, 'https'],
    [2, CLIENT, CLIENT, 'https'],
    [['loopback'], CLIENT, CLIENT, 'https'],
    [['loopback'], `${CLIENT}, ${FORWARDING_PROXY}`, FORWARDING_PROXY, 'https'],
    [[SOCKET_PEER, '10.0.0.0/8'], `${CLIENT}, ${FORWARDING_PROXY}`, CLIENT, 'https'],
  ])(
    'trust %j with X-Forwarded-For "%s" resolves the client to %s',
    async (trustProxy, forwardedFor, ip, protocol) => {
      const body = await client(trustProxy, forwardedFor);
      expect(body.ip).toBe(ip);
      expect(body.protocol).toBe(protocol);
    },
  );

  // The option's type has no number, but a number still reaches it from an untyped caller and
  // then trusts no proxy, unlike Express. The env hop count must go through toNodeTrustProxy.
  it('documents why hop counts are converted: a bare number trusts no proxy', async () => {
    const url = await listen(new NodeAdapter({ trustProxy: 2 as unknown as NodeTrustProxy }));
    const response = await request(url)
      .get('/adapter-probe/client')
      .set('x-forwarded-for', `${CLIENT}, ${FORWARDING_PROXY}`);
    expect(response.body).toMatchObject({ ip: SOCKET_PEER });
  });

  it('routes parameters up to the configured length and leaves larger request lines to Node', async () => {
    const url = await listen(createHttpAdapter(false));
    const accepted = await request(url).get(`/adapter-probe/items/${'a'.repeat(8_000)}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ length: 8_000 });

    // Node's own maxHeaderSize check answers before the adapter, as it did under Express.
    const oversized = await request(url).get(
      `/adapter-probe/items/${'a'.repeat(HTTP_MAX_PARAM_LENGTH + 1)}`,
    );
    expect(oversized.status).toBe(431);
    expect(oversized.text).toBe('');
  });
});
