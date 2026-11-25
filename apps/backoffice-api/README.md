# apps/backoffice-api

백오피스 관리자 화면(BFF)이 부르는 NestJS API다. 관리자 계정·로그인·session·권한·승인 요청·감사, 관리자 기록 정리
작업과 공개 법적 문서의 초안·게시·철회 승인을 소유한다. 운영자 접근 규칙의 원본은 [운영자 접근 정책](../../docs/policies/operator-access.md)(`OA-R*`)이고, 이
문서는 그 규칙을 code에서 어디가 지키는지와 실행·test 방법을 설명한다.

## 1. 경계

- 사용자 API(`apps/api`)와 같은 DB(`@repo/database`)를 쓰지만 code를 import하지 않는다(ESLint `no-restricted-imports`가
  막는다). 둘이 함께 쓸 server code가 생기면 공유 server package를 둔다. 계약은 `@repo/shared/backoffice`다.
- DB에는 LOGIN user 둘로 접속한다. API 요청은 `dormduri_backoffice`(`backoffice_runtime`), 정리 작업은
  `dormduri_backoffice_retention`(`backoffice_retention`)이다. 둘 다 사용자 table과 RRPD table에는 권한이 없다. 관리자 table
  밖에서 `backoffice_runtime`이 닿는 것은 공개 법적 문서의 초안·판 table(판은 철회 시각만 고침)과 메일 받을 회원 수만 내는
  view `LegalNoticeRecipientCount` 하나다([grant 표](../../infra/db/README.md#grant-표), §8).
- 관리자 감사(`AdminAuditEvent`)는 이 API만 추가한다. `backoffice_runtime`은 `occurredAt` 열에 INSERT 권한이 없어 감사 시각은
  늘 DB 시계다. 감사 행은 그 행동과 같은 transaction에서 쓰므로 감사 기록이 실패하면 행동도 rollback된다(`OA-R7`).
- 화면(`apps/backoffice-web`)은 이 API가 준 session token을 `dormduri_bo_session` cookie에 두고 `Authorization: Bearer`로
  넘긴다. CSRF·Origin 대조와 cookie 속성은 BFF가 소유한다. 이 API는 SSM 포트 포워딩 안의 BFF만 부른다.

## 2. 모듈

의존 방향은 `platform` ← `audit` ← `access-control/roles` ← `admin-identity` ← `access-control` ← `legal`이다. 예외는 다른 module을
import하지 않는 두 파일, route 접근 규칙 decorator(`access-control/route-access.ts`)와 권한 계산(`access-control/permissions.ts`)이고
모든 module의 controller와 session이 쓴다.

| 모듈                                       | 책임                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/platform`                             | 설정·시계·Prisma client 둘·HTTP 오류 형식·log 가림·metric                                            |
| `src/audit`                                | 감사 기록(`AdminAuditWriter`)·조회·점검 기록과 관리자 기록 정리 작업(`retention/`)                   |
| `src/access-control/roles`                 | 역할 부여·회수 행(`RoleAssignmentStore`). 초대 등록의 bootstrap 부여와 승인 결과가 같은 store를 쓴다 |
| `src/admin-identity`                       | 비밀번호·passkey·TOTP·복구 code, 로그인·잠금, session·재인증, 초대·등록·비활성화, `bootstrap-owner`  |
| `src/access-control`                       | 권한 상수와 역할 묶음, 전역 guard, 승인 요청과 직무 분리                                             |
| `src/legal`                                | 공개 법적 문서 초안·가져오기·게시와 철회 요청·결정 검사(§8)                                          |
| `src/health`, `src/platform/observability` | `GET /health/live`·`/health/ready`, `GET /internal/metrics`                                          |

## 3. 인증과 session

- 로그인은 두 단계다. `POST /auth/login/password`가 맞으면 5분짜리 1회용 challenge를 주고, `POST /auth/login/passkey`가
  passkey 응답을 확인하면 전체(`FULL`) session을 낸다(`OA-R2`). 같은 challenge로 TOTP(`/auth/login/totp`)나 복구
  code(`/auth/login/recovery-code`)를 내면 `RECOVERY` session이 된다. 이 session은 자기 session 보기, 새 passkey 등록,
  로그아웃만 할 수 있고 권한이 비어 있다. 이 로그인은 `backoffice_security_events_total{event="recovery_login"}`을 올린다.
- 계정이 없거나, 비활성이거나, 잠겼거나, 비밀번호가 틀려도 같은 `authentication_failed`를 준다. 비밀번호와 2단계 인증을
  합쳐 연속 5번 틀리면 15분 잠그고 그 계정의 session을 끝낸다(`OA-R5`). 한 계정의 시도는 계정 행을 잠근 transaction 안에서
  차례로 돌아, 동시에 온 시도도 앞 시도가 남긴 실패 수와 잠금을 본다. 잠금은 `FOR NO KEY UPDATE`라 그 계정을 가리키는
  감사·session 행의 FK 검사는 기다리지 않는다(credential 행을 잡고 감사 행을 쓰는 재인증과 엇갈려도 deadlock이 없다). 로그인 route 전체는 process 안에서 분당 30번으로 막는다.
- Session token은 32 byte 불투명 값이고 DB에는 SHA-256 hash만 둔다. 15분 동안 요청이 없거나 로그인 뒤 8시간이 지나면
  끝나고, 끝난 session은 감사에 한 번 `SESSION_EXPIRED`로 남는다(`OA-R3`). 로그아웃·잠금·비활성화·역할 회수는 바로 끝낸다.
- 재인증(`POST /auth/reauthentication/options` → `POST /auth/reauthentication`)은 passkey로 하고 5분 동안 유효하다.
  승인·거절, 역할 요청, 법적 문서 게시·철회 요청, 계정 비활성화, TOTP·복구 code 재발급은 재인증을 요구한다(`OA-R4`).
- WebAuthn은 `@simplewebauthn/server`로 origin `http://localhost:4300`, RP ID `localhost`를 확인하고 user verification을
  요구한다. TOTP(RFC 6238, SHA-1, 30초, 6자리, 앞뒤 1단계)는 직접 구현하며 비밀은 AES-256-GCM(계정 id를 AAD로)으로 저장한다.
  같은 시간 단계의 code는 다시 받지 않는다. 복구 code 10개는 hash로만 두고 한 번씩 쓴다. 비밀번호는 argon2id다.

## 4. 권한과 직무 분리

- 세부 권한(`admin:<자원>:<행동>`)은 `@repo/shared/backoffice`, 역할 묶음은 `src/access-control/permissions.ts`가 정한다.
  DB에는 계정별 역할 부여(`AdminRoleAssignment`)만 둔다. `admin:restricted:*`(RRPD 열람·반출·hold)는 상수로만 있고 어느
  역할에도 없다(`OA-R11`).
- 전역 guard(`AdminAccessGuard`)는 접근 규칙(`@PublicRoute`·`@SessionRoute`·`@RequirePermission`)이 없는 route를 거부한다.
  모든 route와 규칙은 `test/architecture/route-access-table.spec.ts`의 표와 같아야 한다. 새 route는 규칙과 표 행을 함께 더한다.
- 역할 부여·회수는 승인 요청(`/access/requests`)을 거친다. 이 경로는 역할 요청(`ROLE_GRANT`·`ROLE_REVOKE`)만 내고 결정하며,
  같은 table의 법적 문서 요청은 `/legal/requests`만 다룬다(§8). 결정자는 요청자와 달라야 하고, 승인 권한을 가진 활성 계정이
  요청자 하나뿐일 때만 사유를 적어 자기 요청을 승인할 수 있다(`OA-R9`). 그 수는 결정 때 센다. 승인자는 화면에서 본 내용
  digest를 보내고, 결정은 digest와 대기 상태를 조건으로 한 UPDATE라 한 번만 된다. 요청은 7일 뒤 만료되고, 목록은 기한이
  지난 대기 요청을 결정 시도 전에도 `EXPIRED`로 보인다. 마지막 승인 계정의 owner 역할 회수와 비활성화는 거부한다. 승인 계정을
  요청자 하나만 남기는 비활성화도 거부하고, 그 owner 역할은 승인 요청으로 먼저 회수한다(대상 운영자도 결정할 수 있다). DB
  CHECK가 상태·결정자·자기 승인 표시의 짝을 지킨다.
- 감사 목록과 승인 요청 목록은 최신순이고 한 번에 `limit`(최대 100)행이다. 다음 page는 응답 `nextPage`의 마지막 행 시각과
  id(`beforeTime`·`beforeId`)로 받는다. 한 transaction의 감사 행은 시각이 같아 id가 순서를 정한다.
- 첫 owner는 `bootstrap-owner` 명령이 만든다(`OA-R10`). 활성 계정이 하나라도 있으면 거부하고, 15분 동안 한 번 쓰는 등록
  code를 낸다. 그 code로 등록하면 owner 역할 부여가 system actor의 감사 행으로 남는다.

```sh
# SSM Run Command로 백오피스 container 안에서(BACKOFFICE_DATABASE_URL만 필요)
node dist/cli/bootstrap-owner.js --email <owner email> --display-name <이름>
```

## 5. 관리자 기록 정리 작업

`AdminRecordsRetention`이 `dormduri_backoffice_retention`으로 1시간마다(첫 실행은 기동 30초 뒤) 아래 순서로 돈다. 기준
시각은 DB 시계다. 앞 단계가 실패하면 뒤 단계는 그 회차에 돌지 않는다. 단계마다 500행씩 대상 선택과 삭제·익명화를 한
문장으로 하고, 고르는 상태(기준 시각 전·끝남·닫힘·회수됨·감사 행 없는 비활성)는 되돌아가지 않으므로 다시 돌리거나 rollout
때 옛·새 container가 겹쳐 돌아도 결과가 같다. 익명화 UPDATE는 비활성·미익명 조건을 다시 건다.

1. 3년이 지난 감사 행 폐기([DR-R5](../../docs/policies/data-retention.md))
2. 3년 전에 회수됐고 가리키는 감사 행이 없는 역할 부여 폐기
3. 3년 전에 끝났거나(대기인 채 만료 포함) 가리키는 감사 행·역할 부여가 없는 승인 요청 폐기
4. 가리키는 감사 행이 없는 비활성 계정의 email·이름 익명화(행과 id는 남김)
5. 끝난 지 7일이 지난 session, 6. WebAuthn challenge, 7. 초대 폐기([DR-R6](../../docs/policies/data-retention.md))

단계별 처리 행 수·실패와 마지막 성공 시각은 `backoffice_retention_*` metric으로 낸다. DB 시계를 읽지 못한 회차는 실패
`step="start"`로 센다. Production에서 기본으로 켜지고
`BACKOFFICE_RETENTION_JOB_ENABLED`로 끌 수 있다.

## 6. 환경변수

| 이름                                     | 뜻                                                             |
| ---------------------------------------- | -------------------------------------------------------------- |
| `BACKOFFICE_DATABASE_URL`                | `dormduri_backoffice` 접속 URL(필수)                           |
| `BACKOFFICE_RETENTION_DATABASE_URL`      | `dormduri_backoffice_retention` 접속 URL(필수, 위와 달라야 함) |
| `BACKOFFICE_TOTP_ENCRYPTION_KEY`         | TOTP 비밀 암호화 key, base64 32 byte(필수)                     |
| `BACKOFFICE_METRICS_BEARER_TOKEN`        | `/internal/metrics` bearer token, 32자 이상(production 필수)   |
| `BACKOFFICE_API_PORT`                    | 기본 4310                                                      |
| `BACKOFFICE_DATABASE_POOL_MAX`           | 기본 5                                                         |
| `BACKOFFICE_RETENTION_DATABASE_POOL_MAX` | 기본 1                                                         |
| `BACKOFFICE_RETENTION_JOB_ENABLED`       | 정리 작업 실행 여부(기본: production만)                        |
| `BACKOFFICE_RETENTION_JOB_INTERVAL_MS`   | 기본 3600000                                                   |
| `BACKOFFICE_LOG_LEVEL`                   | `debug`·`info`·`warn`·`error`, 기본 `info`                     |

설정 오류는 값이 아니라 이름만 출력한다. Log는 pino JSON이고 비밀번호·code·token·passkey 응답·email·사유를 key와 문자열
pattern으로 가린다.

## 7. Test

Test를 어느 층에 둘지는 [BE test 기준](../api/test/README.md#be-test-기준)을 따른다.

| 명령(root)                                      | 범위                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm backoffice-api:check`                     | 준비(shared·Prisma client·TypedSQL build) 뒤 lint와 typecheck                                                            |
| `pnpm backoffice-api:test:prepared`             | unit(`src/**/*.spec.ts`: TOTP RFC 6238 vector, 복구 code, 권한, 직무 분리, session, 정리 순서, log 가림)과 route 전수 표 |
| `pnpm backoffice-api:test:integration:prepared` | 실 PostgreSQL integration(`test/integration`)                                                                            |
| `pnpm backoffice-api:build:prepared`            | `nest build`                                                                                                             |

Integration은 global setup이 운영과 같은 `bootstrap-roles.sql`로 group role과 LOGIN user를 만들고, suite마다 새 schema에
migration과 grant 표를 적용한 뒤 앱을 두 LOGIN user로 띄운다. 그래서 모든 query가 운영 권한 아래에서 돈다. Admin URL은
`DORMDURI_BACKOFFICE_INTEGRATION_ADMIN_DATABASE_URL`, 없으면 `DATABASE_URL`이고 loopback이 아니면
`DORMDURI_BACKOFFICE_INTEGRATION_DISPOSABLE_DATABASE=yes`가 있어야 돈다. Passkey는 `test/support/software-authenticator.ts`의
software authenticator(ES256, `none` attestation)가 응답한다. CI는 `.github/workflows/backoffice-ci.yml`이 이 순서로 돌린다.

```sh
pnpm db:up
pnpm backoffice-api:prepare
pnpm backoffice-api:test:integration:prepared
```

## 8. 공개 법적 문서

공개 법적 문서의 규칙 원본은 [legal basis](../../docs/policies/legal-basis.md)(`LB-R6`·`LB-R10`·`LB-R11`)이고, 사용자 API의 공개
열람은 [legal README](../api/src/legal/README.md)가 소유한다. 이 API는 백오피스 쪽의 초안·요청·결정을 맡는다(`src/legal`).

- 권한: 초안 편집·가져오기·게시와 철회 요청은 `admin:legal:edit`(`LEGAL_EDITOR`), 승인·거절은 `admin:legal:approve`
  (`LEGAL_APPROVER`)다. `OWNER` 역할도 둘을 갖는다. 결정 때 세는 승인 권한 계정은 이 두 역할 가운데 하나를 가진 활성 계정이고,
  직무 분리와 1인 예외(재인증·사유·자기 승인 표시·`self_approval` 경보)는 역할 요청과 같다(`OA-R9`).
- 초안: `POST /legal/drafts`는 편집기와 JSON 파일(`source`)이 같은 공유 가져오기 schema(`legalDocumentDraftImportSchema`)를
  통과한다. 저장(`PUT`)과 버림은 읽은 판 번호(`revision`)를 조건으로 한 UPDATE이고, 게시 요청이 대기 중인 초안은 저장하지
  않는다. 미리보기(`GET /legal/drafts/:draftId`)는 바로 앞 판과 공유 조항 대조표(`compareLegalSections`)를 낸다.
- 요청: 게시 요청 digest는 그 판 번호의 초안 내용 digest(공유 `legalContentDigestInput`의 sha256)이고, 철회 요청 digest는 대상
  판의 digest다. 요청은 7일 뒤 만료된다. 거절·취소된 게시 요청의 초안은 같은 transaction에서, 만료된 요청의 초안은 다음 저장·
  요청·결정 시도 때 편집 중으로 돌아간다. 읽기는 그 전에도 만료된 요청을 `EXPIRED`, 그 초안을 편집 중으로 보인다.
- 결정: serializable transaction 안에서 kind마다 advisory lock을 잡고 요청의 조건부 UPDATE, 검사
  (`legal-publication-policy.ts`), 판 INSERT 또는 철회 UPDATE, 초안 상태, 감사 행을 함께 쓴다. 하나라도 실패하면 모두
  rollback이다. 검사는 고지 등급별 시행일 하한(일반 7일·중대 30일, 승인일은 KST), kind의 시행 예정 판 하나, 이전 판 기록과 첫
  게시의 날짜 규칙, 중대·재동의 필요 판은 메일 받을 회원이 0명일 때만(`countLegalNoticeRecipients`)이다. 공지 시작·철회
  시각·승인일은 공개 열람과 같은 DB 시계, 요청 만료는 역할 요청과 같은 앱 시계다.
- 철회: 시행 시각 전의 일반·중대 판만이고, 철회 시각이 비어 있을 때만 쓰는 조건부 UPDATE라 한 번만 되며 되돌리는 경로가 없다.
- 관측: `backoffice_legal_decisions_total{kind, notice_class, decision}`(`publish_approved`·`publish_rejected`·
  `withdraw_approved`·`withdraw_rejected`)와 감사 행(대상 종류 `LEGAL_DOCUMENT_DRAFT`·`LEGAL_DOCUMENT_VERSION`)이다.
- 첫 게시 가져오기 파일: `node apps/api/prisma/seed-data/reference/export-legal-import-files.js --out <디렉터리>`가 seed의 판
  목록을 가져오기 JSON으로 쓴다(있는 파일은 덮지 않음). 가져온 초안의 digest는 그 seed 판의 digest와 같다.
