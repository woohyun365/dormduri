# BE 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-10-31
**확인 근거**: [#773](https://github.com/woohyun365/dormduri/issues/773) 본문의 채택 판정과 계획 보강 댓글(application-architecture의 `be.arch.http-adapter`)
**근거**: [platform/http](../../../apps/api/src/platform/http/README.md), [platform/observability](../../../apps/api/src/platform/observability/README.md), [Domain/SWE/Web/BE pack](../../development/agent-workflows/domain/swe-web/be.md)

`Domain/SWE/Web/BE` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

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
  전에 끝나는 요청은 전역 guard가 기록한다. `@nestjs/platform-node`가 고정한 `qs` 6.16.0은 범위 override
  `'@nestjs/platform-node>qs': 6.16.1`로 보안 하한을 지킨다
- 근거: 같은 harness에서 처리량 중앙값 +35.7 %, 요청당 CPU -27.7 %였고(판정 기준 +10 % 또는 -10 %) `express` 계열 package가
  lockfile에서 빠졌다. Unit·integration·e2e와 trust proxy 네 조합, 응답 동작 test가 NodeAdapter에서 green이다. 바뀐 응답 동작(path
  대소문자 구분, 오류 응답 charset, prototype key body 거절, `ETag` 없음)은 client 영향을 확인하고 받아들였다. 첫 정식 release가
  2026-10-27이라 regression 보고가 적을 수 있다. 비가역이 아니고 PR revert로 되돌린다. Env 계약과 배포 설정은 바뀌지 않는다
- 기각한 대안: Express 유지(측정 이득을 버린다), Fastify adapter([#468](https://github.com/woohyun365/dormduri/issues/468), NestJS
  공식 권장이 NodeAdapter로 옮겨 갔다), API를 처음 배포하는 단계에서 전환(첫 배포 image가 정해진 adapter로 build되게 그 전에
  바꾼다), `qs` 6.16.1 이상에 기대는 NestJS release를 기다림(Owner가 범위 override로 진행하기로 했다), `maxParamLength` 기본값
  100(긴 parameter가 공통 envelope 대신 414가 된다)
- 재검토 조건: NestJS가 NodeAdapter나 Express adapter의 지원 상태를 바꿀 때(v13 기본 adapter 변경 포함), `@nestjs/platform-node`가
  `qs` 6.16.1 이상에 기댈 때(override 제거), trust proxy·body parser·Socket.IO·exception filter에 걸린 NodeAdapter regression이 보고될 때,
  API 배포 뒤 metrics로 본 처리량·CPU가 evidence와 크게 다를 때
- 출처: #773, Owner 확인 2026-10-31
- pack 결정: 없음
