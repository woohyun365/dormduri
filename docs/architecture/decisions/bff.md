# BFF 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-26
**확인 근거**: [#1008의 결정 기록 근거 댓글](https://github.com/woohyun365/dormduri/issues/1008#issuecomment-7180684316)(server-read-error-privacy-shaping의 `bff.read.server-read-path/legal`: 마지막 성공본 2026-11-17, 시간 상한 2026-11-26)
**근거**: [Web legal](../../../apps/web/src/legal/README.md), [Legal 게시 runbook](../../runbooks/legal-publication.md#마지막-성공본-확인), [Legal 단계 배포](../../../infra/runbooks/release/legal-stage-deploy.md), [Domain/SWE/Web/BFF pack](../../development/agent-workflows/domain/swe-web/bff.md)

`Domain/SWE/Web/BFF` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## server-read-error-privacy-shaping

#### bff.read.server-read-path/legal

- 판정: Inspect(읽기 경로)·Ask(실패 때 낼 것)
- 상태: validated
- 고른 선택지: 읽기 경로는 [Repo binding의 고른 값](../../development/agent-workflows/domain/knu-binding.md#고른-값)
  그대로 upstream 직접 호출이다. `/privacy`·`/terms`와 대조표·개정 예고 loader는 설정된 API upstream을 `no-store`로 요청마다
  한 번 읽고(timeout 3초) 자기 route를 다시 부르지 않는다. 공유 계약을 통과한 응답은 그 요청(endpoint, kind, 판 key)의 마지막
  성공본 파일로 Web host의 named volume에 남긴다(같은 디렉터리의 임시 파일을 쓰고 rename). API가 판 주소에
  `404 LEGAL_DOCUMENT_VERSION_NOT_FOUND`를 주면 '없는 판'을 내고 그 파일을 지운다. 그 밖의 실패(연결·timeout·오류 상태·계약
  불일치·API 주소 설정 오류)는 파일을 공유 schema로 다시 검사해 '마지막으로 확인한 판'(확인 시각)으로 내고, 파일이 없으면
  '불러올 수 없음'이다. 파일은 framework cache가 아니라 legal 기능이 소유한다(`fe.state.server-cache-owner`의 화면별 수동).
  API DB 읽기 상한은 1.5초로 Web timeout보다 짧다
- 근거: 처리방침은 지속 게재해야 하는데 Web에는 문안 사본이 없다(문안 원본은 하나). API가 멈춘 동안 새로 뜬 Web
  container도 같은 volume 파일을 읽어 빈 문서가 되지 않는다. 파일에는 공개 문서만 있다. 판 선택·대조는 API만 계산한다.
  되돌림은 code·compose 수준이다(volume은 지우지 않아도 옛 Web이 읽지 않음)
- 기각한 대안: Next 재검증(ISR) 마지막 성공본만(새 container와 API 장애가 겹치면 빈 문서), ingress(nginx) cache(새 배포 뒤
  옛 HTML이 지워진 asset을 가리킴), build 때 snapshot(CI가 private API에 닿지 않음), Web fallback 문서 유지(문안 원본이 둘)
- 재검토 조건: Web을 여러 instance나 다른 host로 늘릴 때(volume 공유 방식), 공개 API 주소가 생길 때
- 출처: #1008, Owner 확인 2026-11-17(마지막 성공본)·2026-11-26(시간 상한)
- pack 결정: [bff.read.server-read-path](../../development/agent-workflows/domain/swe-web/bff.md#bffreadserver-read-path)
