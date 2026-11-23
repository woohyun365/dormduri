import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { buildFixtures, forbiddenColumnNames, judgeSlackPayloads } from './alertmanager-render.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const columns = forbiddenColumnNames(
  readFileSync(
    resolve(repoRoot, 'packages/database/prisma/role-grants/column-classes.csv'),
    'utf8',
  ),
);
const { alerts, sentinels } = buildFixtures(columns);

// 실제 Alertmanager 실행은 scripts/infra/check/validate-runtime-configs.mjs가 한다. 여기서는 fixture와 판정을 본다.
const payload = (title, text) => ({
  channel: '#dormduri-alerts',
  attachments: [{ title, fallback: title, text, footer: '돔두리 observability' }],
});
const good = () => [
  payload(
    '[FIRING] critical api/DormduriFixtureCritical',
    '<!channel> • *env*: production\n• *summary*: fixture critical summary\n• *runbook*: infra/runbooks/operations/observability/production-stack.md#경보-대응\n',
  ),
  payload(
    '[FIRING] warning redacted/redacted',
    '• *env*: unknown\n• *summary*: fixture warning summary\n• *runbook*: infra/observability/README.md\n• *labels*: alertname=redacted, service=redacted, severity=warning\n',
  ),
];

test('the fixtures carry the secret, content and identifier column names as label and annotation names', () => {
  assert.ok(columns.length >= 20, 'the column classes still list forbidden columns');
  assert.ok(columns.includes('email') || columns.some((name) => /email/iu.test(name)));
  const [critical, warning] = alerts;
  for (const name of columns) assert.ok(name in critical.labels, `label ${name}`);
  assert.equal(critical.labels.severity, 'critical');
  assert.equal(warning.labels.severity, 'warning');
  assert.ok(sentinels.length > columns.length);
});

// rule의 service label이 template의 닫힌 값 밖이면 Slack에 service=redacted로 나가 경보를 service로 가르지 못한다.
test('every service label in the alert rules passes the Slack template service filter', () => {
  const template = readFileSync(
    resolve(repoRoot, 'infra/observability/alertmanager/templates/slack.tmpl'),
    'utf8',
  );
  const filter = template.match(/define "dormduri\.slack\.service" \}\}\{\{ if match "([^"]+)"/u);
  assert.ok(filter, 'the template defines the service filter');
  const pattern = new RegExp(filter[1], 'u');
  const services = new Set();
  for (const directory of ['prometheus/rules', 'loki/rules']) {
    const root = resolve(repoRoot, 'infra/observability', directory);
    for (const name of readdirSync(root).filter((file) => file.endsWith('.yml'))) {
      const source = readFileSync(resolve(root, name), 'utf8');
      for (const [, service] of source.matchAll(/^\s+service:\s*(\S+)\s*$/gmu))
        services.add(service);
    }
  }
  for (const expected of ['api', 'web', 'host', 'observability', 'backoffice'])
    assert.ok(services.has(expected), `rules use service ${expected}`);
  for (const service of services) assert.match(service, pattern, service);
});

test('the judge passes the redacted payloads and rejects every leak or a wrong mention', () => {
  assert.deepEqual(judgeSlackPayloads(good(), sentinels), []);
  const cases = [
    [
      (list) => (list[0].attachments[0].fallback = `x ${sentinels[0]}`),
      /payload holds dormduri-fixture-sentinel-000/u,
    ],
    [
      (list) => (list[1].attachments[0].text += ' owner@example.com'),
      /payload holds owner@example\.com/u,
    ],
    [
      (list) => (list[0].attachments[0].text = list[0].attachments[0].text.slice(11)),
      /critical payload lacks <!channel>/u,
    ],
    [
      (list) => (list[1].attachments[0].text = `<!channel> ${list[1].attachments[0].text}`),
      /warning payload mentions the channel/u,
    ],
    [
      (list) => (list[1].attachments[0].title = '[FIRING] warning owner/redacted'),
      /expected one redacted warning payload/u,
    ],
    [(list) => list.pop(), /expected two payloads/u],
    [(list) => (list[0].channel = '#general'), /payload channel differs/u],
  ];
  for (const [change, expected] of cases) {
    const list = good();
    change(list);
    assert.match(judgeSlackPayloads(list, sentinels).join('\n'), expected, String(expected));
  }
});
