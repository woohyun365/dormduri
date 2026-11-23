import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  BOOTSTRAP_DOCUMENT_NAME,
  BOOTSTRAP_DOCUMENT_PATH,
  DEPLOY_DOCUMENT_NAME,
  DEPLOY_DOCUMENT_PATH,
  DOCUMENT_SIZE_LIMIT,
  expectedDocuments,
} from './ssm-document.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');

// document harness와 backoffice-cd의 hash 대조는 저장소에 든 생성본을 쓴다. 그래서 원본(script·lib·compose·Alloy·secret 설치기·
// mount 계약)만 고치고 생성본을 다시 만들지 않으면 리뷰한 원본과 host가 실행하는 본문이 갈린다. 이 test가 그 차이를 잡는다.
test('the committed backoffice documents are the generator output of their sources and fit the SSM size limit', () => {
  const documents = expectedDocuments(repoRoot);
  assert.deepEqual(
    documents.map(({ path }) => path).sort(),
    [BOOTSTRAP_DOCUMENT_PATH, DEPLOY_DOCUMENT_PATH].sort(),
  );
  // Systems Manager quotas, Documents: "Document size 64 KB per document".
  assert.equal(DOCUMENT_SIZE_LIMIT, 65536);
  for (const { path, text } of documents) {
    assert.equal(readFileSync(resolve(repoRoot, path), 'utf8'), text, `${path} is stale`);
    assert.ok(Buffer.byteLength(text) <= DOCUMENT_SIZE_LIMIT, `${path} size`);
  }
  assert.equal(DEPLOY_DOCUMENT_NAME, 'dormduri-backoffice-deploy');
  assert.equal(BOOTSTRAP_DOCUMENT_NAME, 'dormduri-backoffice-bootstrap-owner');
});
