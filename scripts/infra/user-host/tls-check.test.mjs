import assert from 'node:assert/strict';
import test from 'node:test';

import { MINIMUM_DAYS, certificateProblems } from './tls-check.mjs';

const now = new Date('2026-11-03T00:00:00Z');
const names = 'DNS:dormduri.com, DNS:www.dormduri.com';
const inDays = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toUTCString();

test('a certificate with 21 or more days left that covers apex and www passes', () => {
  const result = certificateProblems({ validTo: inDays(MINIMUM_DAYS), subjectAltName: names }, now);
  assert.deepEqual(result.problems, []);
  assert.equal(result.daysLeft, 21);
});

test('fewer than 21 days left fails', () => {
  const result = certificateProblems({ validTo: inDays(20.5), subjectAltName: names }, now);
  assert.deepEqual(result.problems, ['certificate expires in 20 days']);
});

test('a certificate without www or with an unreadable expiry fails', () => {
  assert.deepEqual(
    certificateProblems({ validTo: inDays(60), subjectAltName: 'DNS:dormduri.com' }, now).problems,
    ['certificate does not cover www.dormduri.com'],
  );
  assert.deepEqual(
    certificateProblems({ validTo: 'not a date', subjectAltName: names }, now).problems,
    ['certificate has no readable expiry'],
  );
});
