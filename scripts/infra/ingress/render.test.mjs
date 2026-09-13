import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
const fixture = () => ({
  mode: 'fixture-http',
  apiAuthority: 'api.s1.test',
  webAuthority: 'web.s1.test',
  publicAddress: '172.30.247.2',
  privateAddress: '172.30.249.2',
  apiSourceAddress: '172.30.248.2',
  observerAddress: '172.30.250.2',
  apiAddress: '172.30.248.3',
  apiPort: 4000,
  webAddress: '172.30.249.3',
  webPort: 3000,
  webPeers: ['172.30.249.3'],
  nginxPeers: ['172.30.248.2'],
  collectorPeers: ['172.30.250.3'],
  networks: {
    public: '172.30.247.0/28',
    api: '172.30.248.0/28',
    web: '172.30.249.0/28',
    observer: '172.30.250.0/28',
  },
});
const renderer = () => import('./render.mjs');

function locations(source) {
  return [...source.matchAll(/location ([^{]+)\{([^}]+)\}/gu)]
    .filter((match) => match[2].includes('proxy_pass'))
    .map((match) => ({ path: match[1].trim(), body: match[2] }));
}

test('base public ingress overwrites caller identity and clears alternate headers', () => {
  const common = readFileSync(
    resolve(repoRoot, 'infra/deploy/nginx/snippets/proxy-common.conf'),
    'utf8',
  );
  assert.match(common, /proxy_set_header X-Forwarded-For \$remote_addr;/u);
  assert.doesNotMatch(common, /proxy_add_x_forwarded_for/u);
  assert.match(common, /proxy_set_header Forwarded "";/u);
  assert.match(common, /proxy_set_header X-Real-IP "";/u);
});

test('public API locations preserve route parity and normalize every final proxy location', async () => {
  const { renderIngressConfig } = await renderer();
  const { files } = renderIngressConfig(fixture());
  const actual = locations(files['public-api.conf']);
  const base = locations(
    readFileSync(resolve(repoRoot, 'infra/deploy/nginx/conf.d/api.conf'), 'utf8'),
  );
  const tls = locations(
    readFileSync(resolve(repoRoot, 'infra/deploy/nginx/examples/api.tls.conf'), 'utf8'),
  );
  assert.deepEqual(
    actual.map(({ path }) => path),
    base.map(({ path }) => path),
  );
  assert.deepEqual(
    actual.map(({ path }) => path),
    tls.map(({ path }) => path),
  );
  for (const { body } of actual) {
    assert.match(body, /X-Forwarded-For \$remote_addr;/u);
    assert.match(body, /proxy_bind 172\.30\.248\.2;/u);
    assert.match(body, /proxy_set_header Host api\.s1\.test;/u);
    assert.match(body, /X-Forwarded-Host api\.s1\.test;/u);
    assert.match(body, /X-Forwarded-Proto http;/u);
    assert.match(body, /Forwarded "";/u);
  }
  assert.match(files['public-api.conf'], /listen 172\.30\.247\.2:80 default_server;/u);
  assert.match(files['public-api.conf'], /internal-metrics-allowlist\.conf/u);
  assert.match(files['public-api.conf'], /proxy_set_header Upgrade \$http_upgrade;/u);
});

test('Web host keeps browser BFF paths on Web and blocks metrics; private entry gates every path by Web peer', async () => {
  const { files } = (await renderer()).renderIngressConfig(fixture());
  assert.deepEqual(
    locations(files['public-web.conf']).map(({ path }) => path),
    ['/'],
  );
  assert.match(files['public-web.conf'], /location = \/internal\/metrics \{ return 404; \}/u);
  assert.match(files['public-web.conf'], /proxy_pass http:\/\/172\.30\.249\.3:3000;/u);
  assert.match(files['public-web.conf'], /proxy_bind 172\.30\.249\.2;/u);
  const privateLocations = locations(files['private-bff.conf']);
  assert.deepEqual(
    privateLocations.map(({ path }) => path),
    ['/api/', '/auth/'],
  );
  assert.match(files['private-bff.conf'], /listen 172\.30\.249\.2:8081/u);
  for (const { body } of privateLocations) {
    assert.match(body, /allow 172\.30\.249\.3;\s+deny all;/u);
    assert.match(body, /X-Forwarded-For \$http_x_forwarded_for;/u);
    assert.match(body, /proxy_bind 172\.30\.248\.2;/u);
    assert.match(body, /X-Forwarded-Proto http;/u);
    assert.doesNotMatch(body, /proxy_add_x_forwarded_for/u);
  }
  for (const source of Object.values(files)) {
    assert.doesNotMatch(
      source,
      /__\w+__|real_ip_header|set_real_ip_from|proxy_protocol|satisfy any|transparent/u,
    );
  }
});

test('observer serves only token-preserving metrics to exact collector peers without forwarding identity', async () => {
  const { files } = (await renderer()).renderIngressConfig(fixture());
  const source = files['internal-metrics.conf'];
  assert.match(source, /listen 172\.30\.250\.2:9091/u);
  assert.deepEqual(
    locations(source).map(({ path }) => path),
    ['= /internal/metrics'],
  );
  assert.match(source, /allow 172\.30\.250\.3;\s+deny all;/u);
  assert.match(source, /proxy_set_header Authorization \$http_authorization;/u);
  assert.match(source, /X-Forwarded-For "";/u);
  assert.match(source, /location \/ \{ return 404; \}/u);
});

test('HTTPS target uses container certificate paths and fixed HTTPS on private re-entry', async () => {
  const input = fixture();
  input.mode = 'production-https';
  input.tls = {
    api: {
      certificatePath: '/etc/nginx/ingress-tls/api.pem',
      keyPath: '/etc/nginx/ingress-tls/api.key',
    },
    web: {
      certificatePath: '/etc/nginx/ingress-tls/web.pem',
      keyPath: '/etc/nginx/ingress-tls/web.key',
    },
  };
  const { files, composeEnvironment } = (await renderer()).renderIngressConfig(input);
  assert.match(files['public-api.conf'], /listen 172\.30\.247\.2:443 ssl/u);
  assert.match(files['public-api.conf'], /ssl_certificate \/etc\/nginx\/ingress-tls\/api.pem;/u);
  assert.match(files['public-web.conf'], /ssl_certificate \/etc\/nginx\/ingress-tls\/web.pem;/u);
  assert.match(files['private-bff.conf'], /X-Forwarded-Proto https;/u);
  assert.doesNotMatch(files['private-bff.conf'], /\$scheme/u);
  assert.equal(composeEnvironment.INGRESS_WEB_APP_URL, 'https://web.s1.test');
  assert.equal(composeEnvironment.INGRESS_API_URL, 'http://172.30.249.2:8081');
  assert.equal(composeEnvironment.INGRESS_HTTP_TRUST_PROXY_CIDRS, '172.30.248.2/32');
});

for (const [description, mutate] of [
  [
    'unknown key',
    (v) => {
      v.trustAll = true;
    },
  ],
  [
    'directive injection',
    (v) => {
      v.apiAuthority = 'api.test; return 200';
    },
  ],
  [
    'newline injection',
    (v) => {
      v.webAuthority = 'web.test\nlisten 80';
    },
  ],
  [
    'unresolved template',
    (v) => {
      v.apiAuthority = '__HOST__';
    },
  ],
  [
    'same authority',
    (v) => {
      v.webAuthority = v.apiAuthority;
    },
  ],
  [
    'wildcard listener',
    (v) => {
      v.privateAddress = '0.0.0.0';
    },
  ],
  [
    'port string',
    (v) => {
      v.apiPort = '4000';
    },
  ],
  [
    'port out of range',
    (v) => {
      v.webPort = 65536;
    },
  ],
  [
    'unknown Web peer',
    (v) => {
      v.webPeers.push('172.30.249.4');
    },
  ],
  [
    'unknown Nginx peer',
    (v) => {
      v.nginxPeers = ['172.30.248.4'];
    },
  ],
  [
    'CIDR peer',
    (v) => {
      v.webPeers = ['172.30.249.0/28'];
    },
  ],
  [
    'duplicate collector',
    (v) => {
      v.collectorPeers.push(v.collectorPeers[0]);
    },
  ],
  [
    'collector outside observer',
    (v) => {
      v.collectorPeers = [v.webAddress];
    },
  ],
  [
    'overlapping networks',
    (v) => {
      v.networks.web = v.networks.api;
    },
  ],
  [
    'host CIDR',
    (v) => {
      v.networks.web = '172.30.249.2/28';
    },
  ],
  [
    'unknown network',
    (v) => {
      v.networks.other = '10.0.0.0/24';
    },
  ],
  [
    'unknown endpoint',
    (v) => {
      v.apiAddress = '172.30.249.3';
    },
  ],
  [
    'gateway endpoint',
    (v) => {
      v.apiAddress = '172.30.248.1';
    },
  ],
  [
    'HTTPS without certificates',
    (v) => {
      v.mode = 'production-https';
    },
  ],
  [
    'HTTP with TLS settings',
    (v) => {
      v.tls = {};
    },
  ],
  [
    'partial IPv6',
    (v) => {
      v.publicIpv6Address = 'fd42:448::2';
    },
  ],
  [
    'IPv6 zone',
    (v) => {
      v.publicIpv6Address = 'fe80::2%eth0';
      v.networks.publicIpv6 = 'fe80::/64';
    },
  ],
]) {
  test(`strict renderer rejects ${description}`, async () => {
    const input = fixture();
    mutate(input);
    const { renderIngressConfig } = await renderer();
    assert.throws(() => renderIngressConfig(input));
  });
}

test('writer owns only artifact output and produces usable Compose environment', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-ingress-render-'));
  try {
    const { writeIngressConfig } = await renderer();
    const result = writeIngressConfig(fixture(), {
      environment: { KNU_ARTIFACTS_DIR: root },
      outputName: 'fixture',
    });
    assert.ok(result.directory.startsWith(root));
    assert.equal(result.composeEnvironment.INGRESS_CONFIG_DIRECTORY, result.directory);
    assert.match(
      readFileSync(resolve(result.directory, 'private-bff.conf'), 'utf8'),
      /172\.30\.249\.3/u,
    );
    assert.throws(() => writeIngressConfig(fixture(), { outputName: '../escape' }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('public IPv6 adds only the explicitly configured subnet, address and public listeners', async () => {
  const { renderIngressConfig } = await renderer();
  const v4 = renderIngressConfig(fixture());
  assert.deepEqual(v4.networkOverlay.networks['ingress-public'].ipam.config, [
    { subnet: '172.30.247.0/28' },
  ]);
  assert.equal(v4.networkOverlay.networks['ingress-public'].enable_ipv6, false);
  const input = fixture();
  input.publicIpv6Address = 'fd45:448:247::2';
  input.networks.publicIpv6 = 'fd45:448:247::/64';
  const v6 = renderIngressConfig(input);
  assert.deepEqual(v6.networkOverlay.networks['ingress-public'].ipam.config, [
    { subnet: '172.30.247.0/28' },
    { subnet: 'fd45:448:247::/64' },
  ]);
  assert.equal(v6.networkOverlay.networks['ingress-public'].enable_ipv6, true);
  assert.equal(
    v6.networkOverlay.services.nginx.networks['ingress-public'].ipv6_address,
    input.publicIpv6Address,
  );
  assert.match(v6.files['public-api.conf'], /listen \[fd45:448:247::2\]:80 default_server;/u);
  assert.match(v6.files['public-web.conf'], /listen \[fd45:448:247::2\]:80;/u);
  for (const bad of ['fd45:448:248::2', '::', 'fd45:448:247::1']) {
    assert.throws(() => renderIngressConfig({ ...input, publicIpv6Address: bad }));
  }
});

test('Compose helper requires generated networks before the sole allowed fixture overlay', async () => {
  const { buildIngressComposeArgs, validateIngressTrustProfile } = await renderer();
  const generated = '/tmp/rendered/compose.networks.yml';
  const args = buildIngressComposeArgs(generated, ['config'], {
    repoRoot,
    projectName: 'knu-fixture',
    fixture: true,
  });
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === '-f'),
    [
      'infra/deploy/compose.api.yml',
      'infra/rehearsal/compose.web.yml',
      'infra/deploy/compose.ingress-trust.yml',
      generated,
      'infra/rehearsal/compose.ingress-trust.fixture.yml',
    ],
  );
  assert.throws(() => buildIngressComposeArgs(undefined));
  for (const arg of ['-f', '-fother.yml', '--file=other.yml', '--file']) {
    assert.throws(() => buildIngressComposeArgs(generated, ['config', arg]));
  }
  const profile = JSON.parse(readFileSync(resolve(repoRoot, 'infra/compose-profiles.json'), 'utf8'))
    .profiles['ingress-trust'];
  validateIngressTrustProfile(profile);
  for (const extra of [
    'infra/rehearsal/compose.postgres.yml',
    'infra/rehearsal/compose.api.runtime.yml',
    'apps/api/test/stress/docker/compose.stress.yml',
  ]) {
    assert.throws(() =>
      validateIngressTrustProfile({ ...profile, files: [...profile.files, extra] }),
    );
  }
  assert.throws(() =>
    validateIngressTrustProfile({ ...profile, files: [...profile.files].reverse() }),
  );
});

test('TLS paths reject traversal, directive injection and unresolved variables', async () => {
  const { renderIngressConfig } = await renderer();
  const input = fixture();
  input.mode = 'production-https';
  const valid = {
    certificatePath: '/etc/nginx/ingress-tls/fullchain.pem',
    keyPath: '/etc/nginx/ingress-tls/key.pem',
  };
  for (const bad of [
    '/etc/nginx/ingress-tls/../key',
    '/etc/nginx/ingress-tls/cert;return 200',
    '/tmp/cert',
    '/etc/nginx/ingress-tls/$CERT',
    '/etc/nginx/ingress-tls//cert',
  ]) {
    input.tls = { api: { ...valid, certificatePath: bad }, web: valid };
    assert.throws(() => renderIngressConfig(input));
  }
});

test('target healthcheck follows the rendered nondefault Web port', () => {
  const target = readFileSync(resolve(repoRoot, 'infra/deploy/compose.ingress-trust.yml'), 'utf8');
  assert.match(target, /healthcheck:/u);
  assert.match(target, /process\.env\.PORT/u);
});
