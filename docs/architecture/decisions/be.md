# BE 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-21
**확인 근거**: [#773](https://github.com/woohyun365/dormduri/issues/773) 본문의 채택 판정과 계획 보강 댓글(application-architecture의 `be.arch.http-adapter`: adapter 채택, `qs` override, 성숙 기간 면제), [#958의 결정 기록 근거 댓글](https://github.com/woohyun365/dormduri/issues/958#issuecomment-7064557164)(domain-model-invariant의 `be.domain.owner-unit/backoffice`, authn-authz의 `be.auth.session-model/backoffice`, background-integration-performance의 `be.bg.job-runner/backoffice` 실행 위치, 2026-11-04·12·21)
**근거**: [platform/http](../../../apps/api/src/platform/http/README.md), [백오피스 API](../../../apps/backoffice-api/README.md), [platform/observability](../../../apps/api/src/platform/observability/README.md), [Domain/SWE/Web/BE pack](../../development/agent-workflows/domain/swe-web/be.md)

`Domain/SWE/Web/BE` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## domain-model-invariant

백오피스 API의 module 구성과 의존 방향은 [백오피스 API README](../../../apps/backoffice-api/README.md#2-모듈)가 소유합니다.

#### be.domain.owner-unit/backoffice

- 판정: Ask
- 상태: validated
- 고른 선택지: 업무 capability 단위. 백오피스는 사용자 앱과 따로 Next.js BFF(`apps/backoffice-web`)와 NestJS API(`apps/backoffice-api`)를
  두고 공유 DB package(`@repo/database`)와 계약 package(`@repo/shared/backoffice`)를 함께 쓴다. API 안의 owner는 기능 module
  (`platform`·`audit`·`access-control/roles`·`admin-identity`·`access-control`)이고 의존은 이 순서의 한 방향이다. 사용자 API code는
  import하지 않는다(ESLint `no-restricted-imports`)
- 근거: 관리자 계정·session·감사가 사용자 API image와 session 경계에서 떨어져 사용자 API process가 뚫려도 관리자 기록에 닿지 않는다.
  역할 부여 행은 초대 등록(bootstrap)과 승인 결과가 함께 바꾸므로 한 store(`access-control/roles`)가 소유해 identity와 access-control의
  순환을 끊었다. Module을 다시 나누는 비용은 크지만 DB·계약 package는 그대로 둔다
- 기각한 대안: 사용자 API에 admin module(user·admin code가 한 image와 session 경계를 나눔), 화면·진입점 단위 owner(같은 승인·감사 규칙이
  진입점마다 복제됨), 사용자 API code import로 재사용(두 app의 배포·권한 경계가 섞임)
- 재검토 조건: 두 API가 함께 쓸 server code가 생길 때(공유 server package), 백오피스 기능이 legal·RRPD 열람으로 늘 때
- 출처: #958, Owner 확인 2026-11-04·2026-11-12
- pack 결정: [be.domain.owner-unit](../../development/agent-workflows/domain/swe-web/be.md#bedomainowner-unit)

## authn-authz

값과 규칙은 [운영자 접근 정책](../../policies/operator-access.md) `OA-R2`~`OA-R5`가, 구현 위치는
[백오피스 API README](../../../apps/backoffice-api/README.md#3-인증과-session)가 소유합니다.

#### be.auth.session-model/backoffice

- 판정: Ask
- 상태: validated
- 고른 선택지: server 저장 session. 로그인하면 32 byte 불투명 token을 한 번 주고 DB(`AdminSession`)에는 SHA-256 hash만 둔다. 요청마다
  hash로 session을 읽어 idle 15분·absolute 8시간·회수를 확인하고, 로그아웃·잠금·비활성화·역할 회수는 그 행을 바로 끝낸다. BFF는 token을
  `dormduri_bo_session` cookie에 두고 `Authorization: Bearer`로 넘긴다
- 근거: 운영자 계정의 강제 종료가 다음 요청에 바로 반영되고(`OA-R3`), token이 새어도 DB에는 hash만 있다. 운영자가 몇 명이라 요청마다
  session 행을 읽는 비용이 작다. 바꾸면 모든 운영자가 다시 로그인하고 인증 경로를 다시 쓴다
- 기각한 대안: 서명된 token(만료 전 강제 종료가 어렵다), 사용자 API session 공유(관리자와 사용자 session 경계가 섞인다), 외부 IdP
  session(처리위탁 고지가 늘고 운영자 한 명 규모에 무겁다)
- 재검토 조건: 백오피스가 여러 독립 서비스로 나뉘어 같은 인증을 검증해야 할 때
- 출처: #958, Owner 확인 2026-11-12
- pack 결정: [be.auth.session-model](../../development/agent-workflows/domain/swe-web/be.md#beauthsession-model)

## application-architecture

이 절의 adapter option과 바뀐 응답 동작은 [platform/http README](../../../apps/api/src/platform/http/README.md#http-adapter)가,
route template은 [platform/observability README](../../../apps/api/src/platform/observability/README.md#route-template)가 소유합니다.
측정은 [HTTP adapter evidence](../../evidence/backend/http-adapter-evidence.md)입니다.

#### be.arch.http-adapter

- 판정: Ask
- 상태: validated
- 고른 선택지: API의 Nest HTTP adapter를 `@nestjs/platform-node`의 NodeAdapter로 둔다. Adapter는 `apps/api/src/platform/http/http-adapter.ts`
  하나가 만들고 다른 production 파일은 adapter·Express를 import하지 않는다. Trust proxy env 계약은 그대로 두고 hop 수는 per-hop
  함수로 바꿔 넘긴다. `maxParamLength`는 Node 기본 `maxHeaderSize`(16384)다. Route template은 Nest path metadata로 만들고, interceptor
  전에 끝나는 요청은 전역 guard가 기록한다. Helmet은 adapter security hook으로 걸어 router가 middleware 전에 거절하는 요청에도
  보안 header를 둔다. `@nestjs/platform-node`가 고정한 `qs` 6.16.0은 범위 override `'@nestjs/platform-node>qs': 6.16.1`로 보안
  하한을 지킨다
- 근거: 같은 harness에서 처리량 중앙값 +35.7 %, 요청당 CPU -27.7 %였고(판정 기준 +10 % 또는 -10 %) `express` 계열 package가
  lockfile에서 빠졌다. Unit·integration·e2e와 trust proxy 네 조합, 보안 header·CORS와 응답 동작 test가 NodeAdapter에서 green이다.
  바뀐 응답 동작(path 대소문자 구분, 오류 응답 charset, prototype key body 거절, `ETag`·304 없음, 잘못된 percent-encoding path
  400의 CORS header 없음, static route 우선 match)은 구현자가 Web BFF 호출 경로로 client 영향을 확인하고 받아들였다. Owner 확인
  범위는 adapter 채택, `qs` override, 성숙 기간 면제다. 첫 정식 release가 2026-10-27이라 regression 보고가 적을 수 있다. 비가역이
  아니고 PR revert로 되돌린다. Env 계약과 배포 설정은 바뀌지 않는다
- 기각한 대안: Express 유지(측정 이득을 버린다), Fastify adapter([#468](https://github.com/woohyun365/dormduri/issues/468), NestJS
  공식 권장이 NodeAdapter로 옮겨 갔다), API를 처음 배포하는 단계에서 전환(첫 배포 image가 정해진 adapter로 build되게 그 전에
  바꾼다), `qs` 6.16.1 이상에 기대는 NestJS release를 기다림(Owner가 범위 override로 진행하기로 했다), `maxParamLength` 기본값
  100(긴 parameter가 공통 envelope 대신 414가 된다), Helmet을 Nest `app.useSecurityHeaders()`로 교체(같은 hook을 쓰지만 header
  생성 주체와 dependency를 바꾸는 별도 변경이라 header 값 동등성을 따로 확인해야 한다)
- 재검토 조건: NestJS가 NodeAdapter나 Express adapter의 지원 상태를 바꿀 때(v13 기본 adapter 변경 포함), `@nestjs/platform-node`가
  `qs` 6.16.1 이상에 기댈 때(override 제거), trust proxy·body parser·Socket.IO·exception filter에 걸린 NodeAdapter regression이 보고될 때,
  API 배포 뒤 metrics로 본 처리량·CPU가 evidence와 크게 다를 때
- 출처: #773, Owner 확인 2026-10-31(adapter 채택·`qs` override·성숙 기간 면제)
- pack 결정: 없음

## background-integration-performance

정리 단계·순서·batch와 metric은 [백오피스 API README](../../../apps/backoffice-api/README.md#5-관리자-기록-정리-작업)가, 보존 기간은
[data-retention.md](../../policies/data-retention.md) `DR-R5`·`DR-R6`가 소유합니다.

#### be.bg.job-runner/backoffice

- 판정: Ask
- 상태: provisional
- 고른 선택지: process 안 timer. 관리자 기록 정리 작업은 백오피스 API process 안의 timer(1시간, 첫 실행은 기동 30초 뒤)가
  `dormduri_backoffice_retention`으로 돌린다. 백오피스 API instance는 하나이고, 단계마다 조건을 DELETE·UPDATE에 다시 건 batch 문장이라
  rollout 때 옛·새 container가 겹쳐 돌아도 같은 행이 두 번 바뀌지 않는다
- 근거: 실행 위치(백오피스 API가 소유·실행)는 Owner가 정했다. 실행 방식은 instance 하나에서 새 table·dependency 없이 가장 단순하고,
  pack이 결함으로 보는 "instance마다 같은 작업이 돈다"는 조건부 문장으로 결과가 같아(재실행·동시 실행 integration test) 중복 실행이
  결함이 되지 않는다. 기준 시각은 DB 시계라 container 시계와 무관하다
- 기각한 대안: DB 작업 table·lease(작업 하나·instance 하나에 table과 lease 관리가 더 든다), 별도 queue 서비스(새 dependency와 운영 대상),
  사용자 API worker가 실행(사용자 API process 침해 때 관리자 기록에 닿는다)
- 재검토 조건: 백오피스 API instance가 둘 이상으로 늘 때, 정리할 행이 batch 한도(단계당 500행 × 200회)를 넘을 때, 작업 종류가 늘 때
- 출처: #958, Owner 확인 2026-11-21(실행 위치)
- pack 결정: [be.bg.job-runner](../../development/agent-workflows/domain/swe-web/be.md#bebgjob-runner)
