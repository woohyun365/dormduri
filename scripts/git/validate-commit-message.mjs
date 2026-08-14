#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED_TYPES = new Set([
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
]);

const GENERATED_TITLE_PATTERNS = [/^Merge /u, /^Revert "/u, /^(?:amend|fixup|squash)! /u];
const TITLE_PATTERN = /^([a-z]+)\(([a-z0-9][a-z0-9-]*)\): (.+)$/u;

export function validateCommitMessage(message) {
  const errors = [];
  const normalizedMessage = message.replace(/^\uFEFF/u, '');
  const [title = ''] = normalizedMessage.split(/\r?\n/u);

  if (/\\n/u.test(normalizedMessage)) {
    errors.push('literal \\n 문자열 대신 실제 줄바꿈과 `git commit -F <file>`을 사용해 주세요.');
  }

  if (!title) {
    errors.push('커밋 제목이 비어 있어요.');
    return errors;
  }

  if (GENERATED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return errors;
  }

  const match = TITLE_PATTERN.exec(title);
  if (!match) {
    errors.push('제목은 `type(scope): 한글 설명 #이슈번호` 형식을 사용해 주세요.');
    return errors;
  }

  const [, type, , description] = match;
  if (!ALLOWED_TYPES.has(type)) {
    errors.push(`지원하지 않는 type이에요: ${type}`);
  }

  if (!/[가-힣]/u.test(description)) {
    errors.push('설명에는 변경 의도를 나타내는 한글을 포함해 주세요.');
  }

  if (description.includes('#') && !/ #[1-9]\d*$/u.test(description)) {
    errors.push('이슈 번호는 `#123`처럼 1 이상의 숫자로 작성해 주세요.');
  }

  if (title !== title.trim()) {
    errors.push('커밋 제목 앞뒤의 불필요한 공백을 제거해 주세요.');
  }

  return errors;
}

function run(messageFilePath) {
  if (!messageFilePath) {
    console.error('commit message file 경로가 필요해요.');
    return 1;
  }

  const errors = validateCommitMessage(readFileSync(messageFilePath, 'utf8'));
  if (errors.length === 0) return 0;

  console.error('커밋 메시지를 확인해 주세요:');
  for (const error of errors) console.error(`- ${error}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv[2]);
}
