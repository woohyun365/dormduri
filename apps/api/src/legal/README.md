# Legal API module architecture

Legal 도메인의 server-side boundary map이다. 이 문서는 `apps/api/src/legal`의 공개 법적 문서 판 열람, 가입 동의 저장, 재동의 대기·기록 책임을 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `LegalModule`: 공개 legal document HTTP API와 재동의 API provider wiring을 제공한다. 외부 도메인에 repository/concrete provider를 export하지 않는다.
- 공개 열람(`LegalController`, class 단위 `@Public()`, 가입 전 사용자도 문서를 읽어야 함):
  - `GET /api/legal/documents/:kind/active`: 그 kind의 시행 중 판.
  - `GET /api/legal/documents/active-bundle`: 회원가입에 필요한 4종 문서(`이용약관`, `개인정보 처리방침`, `개인정보 수집·이용 동의`, `만 14세 이상 확인`)의 시행 중 판. 하나라도 없으면 partial success를 만들지 않는다.
  - `GET /api/legal/documents/:kind/page?version=YYYY-MM-DD`: 보고 있는 판(`version`이 없으면 시행 중 판), 판 목록(최신이 앞, 시행 예정 포함), 시행 예정 판 요약. 없는 판이나 형식이 틀린 값은 404 `LEGAL_DOCUMENT_VERSION_NOT_FOUND`다.
  - `GET /api/legal/documents/:kind/versions/:versionKey/comparison`: 그 판과 바로 앞 판의 조항 대조표. 조항은 level 2 heading이고 "제N조" 접두(없으면 heading 전체)로 짝짓는다. 첫 판은 `previousVersionKey: null`과 빈 `articles`다.
  - `GET /api/legal/revision-notices`: kind별 시행 예정 판 요약(초기화면 개정 예고).
- 재동의(`LegalConsentController`, class 단위 `@RequireCapability()`, 로그인 필요):
  - `GET /api/legal/consents/pending`: 다시 동의해야 하는 kind와 그 시행 중 판.
  - `POST /api/legal/consents`: 판 id 목록에 `AGREE` 기록(`source` `RECONSENT`)을 쓴다. 각 id가 그 회원이 빚진 kind의 시행 중 판이 아니면 아무것도 쓰지 않고 409 `LEGAL_CONSENT_STALE`이다.
- signup legal acceptance persistence: auth signup transaction 안에서 kind별 시행 중 판 id를 검증하고 `LegalAcceptanceRecord` 4건을 저장한다.

## 판과 시각

- 판 하나가 `LegalDocumentVersion` 행 하나이고, 게시한 판의 내용은 바뀌지 않는다(어느 runtime role도 내용 열 UPDATE·DELETE 권한이 없음). 규칙은 [legal-basis.md](../../../../docs/policies/legal-basis.md) `LB-R6`, 결정은 [DB 결정 기록](../../../../docs/architecture/decisions/db.md) `db.schema.history-model/legal`이다.
- 판의 공개 key는 시행일(`effectiveDate`, 한국 시간 날짜)이다. 시행 시각은 시행일 00:00 한국 시간이고, 상태(시행 예정·시행 중·이전)와 적용기간은 상태 열 없이 DB 시각으로 계산한다(`@repo/shared/legal`의 `buildLegalVersionTimeline`). 이전 판 기록(`HISTORICAL`)은 늘 이전 판이고 자기 적용 끝 날짜를 갖는다.
- 공지가 시작되지 않은 판(`publishedAt`이 DB 시각보다 뒤)과 철회한 판은 읽지 않는다. 철회 시각은 공지 기간이 있는 판에만, 시행 시각 전 값으로만 쓸 수 있다(DB CHECK).
- 판의 본문(`summaryItems`·`sections`)은 형식 version(`contentSchemaVersion`)을 갖고, `domain/legal-version.ts`의 version별 reader가 지금 모양으로 읽는다. 읽는 법이 없는 version은 읽기 실패로 다룬다. 게시 판의 승인 사실(게시 요청자·승인자·자기 승인)은 승인 요청에서 복사한 값이다.
- 옛 두 endpoint의 `effectiveAt`·`lastModifiedAt`은 그 한국 시간 날짜의 `T00:00:00.000Z`이고(Web이 앞 10자를 날짜로 읽음), 새 endpoint의 날짜는 `YYYY-MM-DD`다. `lastModifiedAt`은 이전 판 기록과 kind의 첫 게시는 시행일, 그 뒤 판은 승인일(한국 시간)이다. 호환 결정은 [BE 결정 기록](../../../../docs/architecture/decisions/be.md) `be.api.compatibility/legal`이다.
- 재동의 대기: kind마다 시행이 시작된 재동의 필요 판 가운데 가장 늦은 판 R에 대해, 그 회원의 `AGREE` 기록이 R이나 R 뒤 판에 없으면 대기다(`LB-R11`). 재동의 필요는 이용약관·개인정보 수집·이용 동의·만 14세 확인에만 켤 수 있다(DB CHECK).

## 마지막 성공 묶음

- `LegalPublishedVersionReader`는 요청마다 DB 시각과 게시 판을 읽고, 성공하면 kind별 묶음을 process memory에 둔다. 먼저 시작해 늦게 끝난 읽기는 더 새 DB 시각의 묶음을 덮지 않는다. DB 읽기가 실패하면 그 묶음으로 같은 계산을 하고 현재 시각은 마지막 DB 시각에 monotonic 경과를 더한 값이다(서버 wall clock을 쓰지 않음). 묶음이 없으면 503 `LEGAL_DOCUMENTS_UNAVAILABLE`이다.
- 읽기가 실패하면 실패한 단계(DB 시각·게시 판 조회·행 변환), kind, 오류 종류와 code(Prisma code나 SQLSTATE), 대체 결과(memory·unavailable)를 warn log 한 줄로 남긴다. driver 메시지는 query 값을 담을 수 있어 남기지 않는다.
- 단일 instance process 상태다. 한계는 [Runtime composition and process state](../../../../docs/architecture/backend/runtime-composition-and-process-state.md)의 process-local state 표가 소유한다.
- 요청마다 `api_legal_document_reads_total{endpoint,source,outcome}`을 하나 올린다(`source`는 `database`·`memory`, `outcome`은 `ok`·`not_found`·`unavailable`).

## Directory responsibilities

- `application/`: `LegalService` controller-facing facade. Query에만 위임한다.
- `queries/`: 공개 열람 query(`legal-document.query.ts`)와 마지막 성공 묶음 reader(`legal-published-version.reader.ts`).
- `domain/`: DB 행을 판 값으로 바꾸고 timeline·시행 중 판을 고르는 함수.
- `commands/`: signup legal acceptance 검증·저장 helper와 재동의 command. 판 id가 stale이면 쓰기 전에 fail-closed 한다.
- `repositories/`: `LegalDocumentVersion` 읽기 owner. 공개 열람 조건(철회 제외, 공지 시작 지남)과 ordering을 고정한다.
- `presenters/`: public response allowlist projection. 고지 종류, digest, 형식 version, 게시 요청자·승인자, 철회·승인 시각을 외부에 노출하지 않는다.
- `observability/`: 읽기 출처 metric 정의.
- `errors/`: user-facing legal error contract.
- `contracts/`: API/query/presenter behavior regression spec.
- `test-support/`: unit spec이 함께 쓰는 게시 판 행 mock.

## Hard rules

- Public response에는 `publishedAt`, `withdrawnAt`, `noticeClass`, `contentDigest`, `contentSchemaVersion`, 게시 요청자·승인자 같은 내부 운영 필드를 포함하지 않는다.
- Legal document body는 raw HTML이 아니라 typed section JSON으로만 제공한다.
- 사용자 API는 판을 쓰지 않는다(`app_runtime`은 `LegalDocumentVersion` SELECT만). 판은 백오피스 가져오기·승인으로만 생긴다.
- Signup acceptance 저장은 auth signup transaction에서 원자적으로 처리한다. 공개 열람 API는 user acceptance evidence를 조회하거나 노출하지 않는다.
- 공개 문안(seed와 Web fallback 본문)에는 raw version id, 내부 상태명, plan/file path를 쓰지 않는다. 응답의 판 `id`는 가입·재동의 기록이 가리키는 값이라 두고, 공개 주소와 화면은 시행일 key를 쓴다.
- 재동의 화면, 로그인 때 안내, 받기 전 서비스 이용 제한은 이 module이 아니라 그 화면을 여는 Auth 축이 이 API로 만든다.

## Seed와 release handoff

- 개발·test DB의 판은 `apps/api/prisma/seed-data/reference/seed-legal-documents.js`가 판 seed 목록 순서로 upsert한다(재실행해도 같은 행). production은 이 seed를 돌리지 않는다.
- legal 문안 data는 code가 아닌 JSON 파일이다(`apps/api/prisma/seed-data/reference/legal/`): 판 seed 목록 `version-seed-rows.json`(순서·고지 등급·재동의 필요·시행일·적용 끝, 본문 출처), 네 문서 배열에 없는 본문(`privacy-policy-historical-2026-06-22.json`), 처리방침·이용약관 첫 개정 초안(`privacy-policy-first-revision.draft.json`, `terms-of-service-first-revision.draft.json`). 본문 파일과 초안은 형식 version(`contentSchemaVersion`)을 적는다. seed module은 이 파일을 읽기만 하고, 본문 출처 `reference-row`는 같은 id의 네 문서 배열(`LEGAL_DOCUMENT_REFERENCE_ROWS`) 행이다.
- 처리방침은 이전 판 기록(2026-06-22~2026-11-19)과 시행 중 판(2026-11-20) 둘이고, 나머지 셋은 2026-06-22 첫 게시다.
- 첫 개정 초안 파일 둘은 백오피스 가져오기 형식(`legalDocumentDraftImportSchema`) 그대로이고 판 행이 아니다. 이용약관 초안은 시행 중 약관에서 제11조(약관 변경)만 `LB-R10`의 공지 기간·조항 대조표와 `LB-R11`의 불리한 변경 재동의 기준으로 바꾼다. 시행 중 판의 처리 위탁 표에 남은 '정해지면 안내' 행은 이 개정이 데이터베이스 운영·운영 관측 기록 보관·운영 관리 서버 운영·운영 접속 기록 보관을 AWS 행에 적고 지운다. 처리자가 바뀌면 다음 판으로 고친다.
- 법률·개인정보 전문가 검토 여부는 실제 사용자 공개 전에 GitHub issue로 정한다.
- 네 문서 배열은 Web fallback의 원본이라 `apps/web/src/legal/__tests__/legal-document-source-sync.test.ts`가 둘의 같음을 지킨다. 이 test는 Web CI lane에서만 돌므로 배열을 바꾸면 같은 commit에서 fallback도 바꾼다.

## Where to change

- HTTP route parsing/delegation: `legal.controller.ts`, `legal-consent.controller.ts`.
- Controller-facing facade: `application/legal.service.ts`.
- 공개 열람 query behavior: `queries/legal-document.query.ts`; 마지막 성공 묶음: `queries/legal-published-version.reader.ts`.
- 판 계산·대조·digest 입력과 공유 schema: `packages/shared/src/legal/`.
- `LegalDocumentVersion` 읽기 shape: `repositories/legal-document.repository.ts`.
- Public response allowlist: `presenters/legal-document.presenter.ts`.
- 재동의: `commands/legal-reconsent.command.ts`.
- User-facing error contract: `errors/legal.errors.ts` and auth stale acceptance failure in `auth/errors/auth-failures.ts`.
- Legal document seed: 네 문서 배열 `apps/api/prisma/seed-data/reference/legal-document-seed-data.js`, 판 seed 목록·이전 판 본문·첫 개정 초안 JSON `apps/api/prisma/seed-data/reference/legal/`, 읽고 쓰는 code `seed-legal-documents.js`.
- Persistence schema/migration SQL과 grant: `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/`, `packages/database/prisma/role-grants/`.
- Signup acceptance transaction hook: `apps/api/src/auth/registration/signup.command.ts`.

## Route matrix

- Public legal document API:
  - `GET /api/legal/documents/active-bundle`
  - `GET /api/legal/documents/:kind/active`
  - `GET /api/legal/documents/:kind/page`
  - `GET /api/legal/documents/:kind/versions/:versionKey/comparison`
  - `GET /api/legal/revision-notices`
- Protected reconsent API:
  - `GET /api/legal/consents/pending`
  - `POST /api/legal/consents`

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  test/operations/reference-data/legal-document-reference-data.spec.ts \
  test/operations/database/migration-legal-version-model.spec.ts \
  test/operations/database/role-grant-matrix.spec.ts \
  src/legal \
  src/auth/registration/signup.command.spec.ts \
  test/architecture/security/auth-access-route-matrix.spec.ts \
  test/operations/database/migration-baseline.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts \
  test/integration/legal test/integration/platform/database-role-grants.integration.spec.ts
pnpm --filter @repo/shared exec vitest run test/contracts/legal
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed legal files without apps/api prefix>
git diff --check
```
