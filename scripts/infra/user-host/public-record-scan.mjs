#!/usr/bin/env node
// 공개 기록(workflow log·run 요약·Release 본문·attestation 내용을 내려받은 text)에 D-WB7 기록 금지 값이 있는지 본다.
// 종류마다 pattern 하나를 두고, 걸린 값은 출력하지 않고 종류·파일·줄만 적는다.
// 허용 값(image digest, document 해시 같은 접두 없는 sha256 hex, commit SHA, workflow run·job URL, image·git 배포 tag(web·api),
// timestamp, GitHub runner 임시 경로(regexp escape 형태 포함)·worker UUID, script 원문의 registry host template)은 먼저 지운 뒤 검사한다. 그래서
// run·job URL의 긴 숫자 ID와 digest 안의 숫자열은 account ID로 걸리지 않는다. GitHub 소유자·저장소 숫자 ID는 종류가 아니다
// (숫자만으로는 다른 값과 구분할 수 없어 template placeholder test와 리뷰가 지킨다).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_KINDS = Object.freeze([
  ['AWS account ID', /(?<![0-9])[0-9]{12}(?![0-9])/u],
  ['ARN', /\barn:aws[a-z-]*:/u],
  // IAM role·user·access key의 unique ID. 앞부분이 account ID를 담는다(role ID는 configure-aws-credentials가 찍는다).
  ['AWS unique ID', /\b(?:AROA|AIDA|AKIA|ASIA|AGPA|ANPA|ANVA|AIPA|APKA|ABIA|ACCA)[A-Z2-7]{16,}\b/u],
  ['registry host', /\.dkr\.ecr\./u],
  ['managed node or instance ID', /\b(?:mi-[0-9a-f]{17}|i-[0-9a-f]{8}(?:[0-9a-f]{9})?)\b/u],
  [
    'IPv4 address',
    /(?<![0-9.])(?!(?:127\.0\.0\.1|0\.0\.0\.0)(?![0-9.]))(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(?![0-9.])/u,
  ],
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/u],
  ['ACME account URI', /\/acme\/acct\//u],
  ['activation ID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu],
]);

// 지우고 검사하는 허용 값. 순서대로 지운다(긴 것 먼저).
export const ALLOWED_VALUES = Object.freeze([
  [
    'GitHub run or job URL',
    /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/[0-9]+(?:\/(?:job|attempts)\/[0-9]+)*/gu,
  ],
  ['image digest', /\bsha256:[0-9a-f]{64}\b/gu],
  ['sha256 hex hash', /\b[0-9a-f]{64}\b/gu],
  ['commit SHA', /\b[0-9a-f]{40}\b/gu],
  ['image deploy tag', /\bdeploy-[0-9]{8}T[0-9]{4}-[0-9]+\b/gu],
  // Release tag of each stage(release-record.mjs STAGES: web-cd, api-cd).
  ['git deploy tag', /\bdeploy-(?:web|api)-[0-9]{8}-[0-9]+\b/gu],
  ['timestamp', /\b[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z\b/gu],
  // GitHub runner가 job마다 새로 만드는 임시 경로·worker UUID. activation ID와 형식이 같아 이 경로·문맥에 든 UUID만 지운다.
  [
    'GitHub runner temp path',
    /(?:\/home\/runner\/work\/_temp|\/github\/runner_temp)\/(?:git-credentials-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu,
  ],
  // actions/checkout은 credential 정리(`git config --unset`)의 값 인자를 regexp escape(영문·숫자·_ 밖 문자 앞에 \)해 찍는다.
  // escape된 UUID는 activation ID로는 안 걸리지만 숫자만인 마지막 부분이 account ID로 걸리므로 같은 경로만 지운다.
  [
    'GitHub runner temp path (regexp-escaped)',
    /(?:\\\/home\\\/runner\\\/work\\\/_temp|\\\/github\\\/runner_temp)\\\/(?:git\\-credentials\\-)?[0-9a-f]{8}\\-[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{12}\b/gu,
  ],
  [
    'GitHub runner worker ID',
    /\bWorker ID: \{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/gu,
  ],
  // workflow script 원문의 registry host template(account와 Region이 shell 변수). 값이 든 host는 그대로 걸린다.
  [
    'registry host template',
    /\$\{?[A-Za-z_]+\}?\.dkr\.ecr\.\$\{?[A-Za-z_]+\}?\.amazonaws\.com\b/gu,
  ],
]);

export function scanText(text, source = 'input') {
  const findings = [];
  text.split('\n').forEach((line, index) => {
    let cleaned = line;
    for (const [, pattern] of ALLOWED_VALUES) cleaned = cleaned.replace(pattern, ' ');
    for (const [kind, pattern] of FORBIDDEN_KINDS) {
      if (pattern.test(cleaned)) findings.push({ kind, source, line: index + 1 });
    }
  });
  return findings;
}

const isDirectExecution = () =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution()) {
  const files = process.argv.slice(2);
  const inputs = files.length
    ? files.map((file) => [file, readFileSync(file, 'utf8')])
    : [['stdin', readFileSync(0, 'utf8')]];
  const findings = inputs.flatMap(([source, text]) => scanText(text, source));
  for (const finding of findings)
    console.error(`${finding.kind}: ${finding.source}:${finding.line}`);
  console.log(`public record scan: ${inputs.length} inputs, ${findings.length} findings`);
  process.exit(findings.length ? 1 : 0);
}
