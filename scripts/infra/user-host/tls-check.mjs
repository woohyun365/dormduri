#!/usr/bin/env node
// web-tls-check workflow가 매일 공개 host의 인증서를 본다(D-WB6). 남은 기간이 21일 미만이거나 apex·www를 함께 담지
// 않으면 실패한다. 출력에는 host 이름·남은 일수·만료 시각만 쓴다(연결 주소를 찍지 않는다, D-WB7).
import { resolve } from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

export const TLS_HOST = 'dormduri.com';
export const REQUIRED_NAMES = Object.freeze([TLS_HOST, `www.${TLS_HOST}`]);
export const MINIMUM_DAYS = 21;
const DAY = 24 * 60 * 60 * 1000;

export function certificateProblems({ validTo, subjectAltName }, now = new Date()) {
  const problems = [];
  const expiresAt = new Date(validTo);
  if (Number.isNaN(expiresAt.getTime())) {
    return { daysLeft: null, expiresAt: null, problems: ['certificate has no readable expiry'] };
  }
  const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / DAY);
  if (daysLeft < MINIMUM_DAYS) problems.push(`certificate expires in ${daysLeft} days`);
  const names = (subjectAltName ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('DNS:'))
    .map((entry) => entry.slice(4));
  for (const name of REQUIRED_NAMES) {
    if (!names.includes(name)) problems.push(`certificate does not cover ${name}`);
  }
  return { daysLeft, expiresAt: expiresAt.toISOString(), problems };
}

export function readCertificate(host = TLS_HOST) {
  return new Promise((resolvePromise, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      resolvePromise({ validTo: certificate.valid_to, subjectAltName: certificate.subjectaltname });
    });
    socket.once('timeout', () => socket.destroy(new Error('TLS connection timed out')));
    socket.once('error', (error) => reject(new Error(error.code ?? 'TLS connection failed')));
  });
}

const isDirectExecution = () =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution()) {
  try {
    const result = certificateProblems(await readCertificate());
    console.log(`${TLS_HOST}: ${result.daysLeft} days left (expires ${result.expiresAt})`);
    for (const problem of result.problems) console.error(problem);
    process.exit(result.problems.length ? 1 : 0);
  } catch (error) {
    console.error(`${TLS_HOST}: ${error.message}`);
    process.exit(1);
  }
}
