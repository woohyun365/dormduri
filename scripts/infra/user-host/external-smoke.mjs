#!/usr/bin/env node
// CD deploy job이 SendCommand 성공 뒤 밖에서 공개 host를 요청해 D-WB10 경로별 응답을 본다. 경로 표와 판정은 local ingress
// smoke(ingress-smoke.mjs)와 같다. 이 host로 가는 경로만 고르고(모르는 host·ACME 시험 token 제외), 인증서를 검증한다.
// 출력에는 method·path·status·title만 쓴다. 연결 주소(IP)와 header 원문을 찍지 않는다(D-WB7).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANONICAL_HOST, INGRESS_SMOKE_CASES, checkResponse, request } from './ingress-smoke.mjs';

export const EXTERNAL_MODES = Object.freeze(['serving', 'maintenance']);

export function externalSmokeCases(mode) {
  if (!EXTERNAL_MODES.includes(mode)) throw new Error(`unknown external smoke mode: ${mode}`);
  return INGRESS_SMOKE_CASES.filter(
    (testCase) =>
      testCase.mode === mode &&
      [CANONICAL_HOST, `www.${CANONICAL_HOST}`].includes(testCase.host ?? CANONICAL_HOST) &&
      !testCase.path.startsWith('/.well-known/') &&
      !testCase.stubOnly,
  );
}

export async function runExternalSmoke({ mode, send = request }) {
  const rows = [];
  for (const testCase of externalSmokeCases(mode)) {
    const host = testCase.host ?? CANONICAL_HOST;
    const response = await send({
      ...testCase,
      host,
      address: host,
      ports: { http: 80, https: 443 },
      verify: true,
    });
    const problems = checkResponse(testCase, response);
    rows.push({
      method: testCase.method ?? 'GET',
      scheme: testCase.scheme ?? 'https',
      host,
      path: testCase.path,
      status: response.closed ? 'closed' : response.status,
      title: response.title ?? null,
      problems,
    });
  }
  return rows;
}

const isDirectExecution = () =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution()) {
  const mode = process.argv.find((value) => value.startsWith('--mode='))?.slice(7) ?? 'serving';
  const rows = await runExternalSmoke({ mode });
  for (const row of rows) {
    const verdict = row.problems.length ? `FAIL ${row.problems.join('; ')}` : 'PASS';
    console.log(
      `${row.method} ${row.scheme}://${row.host}${row.path} ${row.status} ${row.title ?? '—'} ${verdict}`,
    );
  }
  const failed = rows.filter((row) => row.problems.length).length;
  console.log(`external smoke (${mode}): ${rows.length - failed}/${rows.length} passed`);
  process.exit(failed ? 1 : 0);
}
