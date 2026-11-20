import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
