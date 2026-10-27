# Review criteria

이 디렉터리는 독립 리뷰가 변경 유형별로 **무엇을 중요하게 보는가**를 저장소가 소유하는 기준 문서 모음입니다.
Severity 정의, gate, 리뷰 회차와 PASS 뒤 처분 같은 공통 규칙은 [QA workflow](../qa.md#review-criteria와-회차)가 소유하고,
이 디렉터리는 그 규칙이 적용할 기준 항목만 둡니다. Host별 실행(packet에 기준 문서를 싣는 방법)은 각
[host adapter](../adapters/README.md)가 정합니다.

## 기준 문서

| id                                           | 문서                                                                                                            | 적용하는 변경                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `documents`                                  | [Document review criteria](./documents.md)                                                                      | tracked 문서·plan·evidence의 규칙·사실·수치·근거 변경                                         |
| `agent-workflow-tooling`                     | [Agent workflow tooling criteria](./agent-workflow-tooling.md)                                                  | agent workflow script·검사·helper·skill·역할 파일의 동작 변경                                 |
| `swe`                                        | [SWE common criteria](./swe.md)                                                                                 | 제품 code·공유 contract·infra·저장소 script와 그 test·설정의 동작·구조 변경                   |
| `web-fe-rendering-boundary`                  | [Web FE rendering boundary criteria](./web-fe-rendering-boundary.md)                                            | web frontend의 render 위치·server·client 경계·첫 render·체감 성능·부분 실패 변경              |
| `web-fe-state-data-cache`                    | [Web FE state, data, and cache criteria](./web-fe-state-data-cache.md)                                          | web frontend의 상태·server data·form·mutation·cache·외부 입력 검증 변경                       |
| `web-fe-component-architecture`              | [Web FE component architecture criteria](./web-fe-component-architecture.md)                                    | web frontend의 component owner·API·분기·파일 배치·예시 fixture·공유 model 변경                |
| `web-fe-design-system`                       | [Web FE design system criteria](./web-fe-design-system.md)                                                      | web frontend의 design token·공통 UI 부품·화면 문구 원본 변경(시각 값·미감 제외)               |
| `web-fe-layout-responsive-device`            | [Web FE layout, responsive, and device criteria](./web-fe-layout-responsive-device.md)                          | web frontend의 viewport·기기별 표현·layout·overlay·scroll 변경                                |
| `web-fe-accessibility`                       | [Web FE accessibility criteria](./web-fe-accessibility.md)                                                      | web frontend의 상호작용 요소·keyboard·focus·상태 알림 변경                                    |
| `web-bff-gateway-forwarding`                 | [Web BFF gateway and forwarding criteria](./web-bff-gateway-forwarding.md)                                      | BFF route·upstream 전달·상태 변경 진입점 변경                                                 |
| `web-bff-session-cookie-auth`                | [Web BFF session and cookie auth criteria](./web-bff-session-cookie-auth.md)                                    | BFF session·token cookie 발급·갱신·삭제 변경                                                  |
| `web-bff-server-read-error-privacy-shaping`  | [Web BFF server read, error, and privacy shaping criteria](./web-bff-server-read-error-privacy-shaping.md)      | server render data 읽기·upstream 오류 번역·응답 형태 변경                                     |
| `web-be-domain-model-invariant`              | [Web BE domain model and invariant criteria](./web-be-domain-model-invariant.md)                                | server 업무 규칙의 owner·상태 전이·선행 조건·종료 상태 변경                                   |
| `web-be-api-design-contract`                 | [Web BE API design and contract criteria](./web-be-api-design-contract.md)                                      | server API의 요청·응답 schema·오류·목록 조회·공유 contract 변경                               |
| `web-be-authn-authz`                         | [Web BE authentication and authorization criteria](./web-be-authn-authz.md)                                     | server 진입점의 기본 인증·판정 위치, role·capability·운영자 권한 변경                         |
| `web-be-application-architecture`            | [Web BE application architecture criteria](./web-be-application-architecture.md)                                | server code의 층 흐름·module 구조·domain 사이 호출·process 상태와 설정 주입 변경              |
| `web-be-transaction-concurrency-idempotency` | [Web BE transaction, concurrency, and idempotency criteria](./web-be-transaction-concurrency-idempotency.md)    | server의 read-check-write 보호·중복과 재시도·commit 뒤 부수효과·격리와 잠금 변경              |
| `web-be-background-integration-performance`  | [Web BE background work, integration, and performance criteria](./web-be-background-integration-performance.md) | server의 background 작업·외부 호출과 실패 동작·조회와 pool 포화·운영 신호 변경                |
| `web-db-schema-modeling`                     | [Web DB schema modeling criteria](./web-db-schema-modeling.md)                                                  | DB model·relation·제약·삭제 동작·이력·명명과 type 변경                                        |
| `web-db-migration-seed-compatibility`        | [Web DB migration, seed, and compatibility criteria](./web-db-migration-seed-compatibility.md)                  | DB migration·seed와 그 적용·되돌림 경로 변경                                                  |
| `web-db-index-query`                         | [Web DB index and query criteria](./web-db-index-query.md)                                                      | DB 조회 pattern·index·raw SQL 변경                                                            |
| `web-db-integrity-retention-lifecycle`       | [Web DB integrity, retention, and lifecycle criteria](./web-db-integrity-retention-lifecycle.md)                | DB 수준 무결성·잠금, 보존 기한 삭제·익명화, DB 계정·grant 변경                                |
| `web-infra-topology-runtime-config`          | [Web infra topology, runtime, and configuration criteria](./web-infra-topology-runtime-config.md)               | 배포 구성·환경 차이, artifact·설정·secret 주입, 실행 설정, 노출 port·권한, 선언형 설정 변경   |
| `web-infra-ci-cd`                            | [Web infra CI/CD criteria](./web-infra-ci-cd.md)                                                                | CI workflow·lane·cache·경로 분류, 검증·배포 권한과 사람 승인, 배포 pipeline·절차 owner 변경   |
| `web-infra-observability`                    | [Web infra observability criteria](./web-infra-observability.md)                                                | 관측 data의 수집·저장·보존·접근·alert 경계와 관측 UI·운영 화면 책임 변경                      |
| `web-infra-data-durability-recovery`         | [Web infra data durability and recovery criteria](./web-infra-data-durability-recovery.md)                      | backup·restore·RPO/RTO, DB 접속 script의 안전 gate, stateful 변경과 rollout 호환 구간 변경    |
| `web-infra-capacity-cost-supply-chain`       | [Web infra capacity, cost, and supply chain criteria](./web-infra-capacity-cost-supply-chain.md)                | 자원 한도·장애 동작, 확장·비용 가정, dependency·image 갱신과 공급망, upgrade·지원 종료 변경   |
| `web-security-privacy-trust-authz-model`     | [Web security-privacy trust and authorization model criteria](./web-security-privacy-trust-authz-model.md)      | 요청 신뢰 경계·권한 판정·반복과 추측 요청의 남용 방어·입력 주입 방어·신고와 제재 변경         |
| `web-security-privacy-data-privacy-secret`   | [Web security-privacy data privacy and secret criteria](./web-security-privacy-data-privacy-secret.md)          | 개인정보·비공개 필드·비밀값의 분류·표시·전달·저장·보존·기록과 외부 처리자 전달 변경           |
| `web-operations-release-release-gate`        | [Web operations-release release gate criteria](./web-operations-release-release-gate.md)                        | release 대상·절차·증거, 배포 순서·되돌림·운영 적용 권한, 완료 보고 변경                       |
| `web-operations-release-slo-signal`          | [Web operations-release SLO and signal criteria](./web-operations-release-slo-signal.md)                        | health·readiness 신호, 운영 신호·alert·runbook, 의존 서비스 실패 동작과 성능·가용성 목표 변경 |

- 리뷰 대상 경로로 고릅니다([자동 선택](#자동-선택)). 문서와 script를 함께 바꾸면 두 문서를 모두 고릅니다. 오탈자·포맷처럼 QA의
  독립 리뷰 trigger가 없는 변경에는 리뷰를 만들지 않으므로 기준 문서도 고르지 않습니다.
- 계획 readiness 리뷰는 `documents`를 쓰고, readiness 자체의 판정 항목은
  [Plan authoring core의 promotion gate](../plan-authoring/core.md#7-implementation-readiness-promotion)가 소유합니다.
- `swe`는 모든 영역에 공통인 SWE 기준을 소유합니다. `swe`의 경로 키는 agent workflow script와 문서를 빼므로 script에는 `swe` 대신
  `agent-workflow-tooling`을 고르고, 문서만 바꾸는 변경에는 그 경로 키로 `swe`를 고르지 않습니다. 영역 경로 키가 문서 경로(영역
  owner 문서·운영 절차 문서)에도 맞으면 아래 상속 규칙으로 `swe`도 함께 고릅니다. `swe.md` S2의 정책 원본은 그 도메인의 [정책 문서](../../../policies/README.md)이고, S7의 dependency 정책 원본은
  [AGENTS.md 5절](../../../../AGENTS.md#5-implementation-agreements)과 [dependency security policy](../../../policies/dependency-security.md)입니다.
- 영역 기준 문서(`web-<layer>-<하위 layer>`)를 고르면 `swe`와, 그 문서 머리말이 상속한다고 적은 문서도 함께 고릅니다.
- 제품 영역(FE·BFF·BE·DB·infra와 cross-cutting security-privacy·operations-release) 기준 문서는 영역 owner와 함께 이 형식으로
  추가합니다. 지금은 FE 하위 layer 6개, BFF 하위 layer 3개, BE 하위 layer 6개, DB 하위 layer 4개, infra 하위 layer 5개,
  security-privacy 하위 layer 2개, operations-release 하위 layer 2개의 문서가 있습니다. 기준 문서 대신 기존 owner 문서를
  acceptance 근거로 쓸 때(대체)는 영역 plan-authoring guide와
  [visual design review contract](../visual-design/design-review-and-acceptance.md)를 씁니다. 시각 값과 미감은 FE 기준 문서가
  아니라 visual design 문서가 소유합니다.
- 영역 기준 문서의 항목은 [Domain/SWE/Web pack](../domain/swe-web/README.md)의 하위 layer 절이 결정 목록·위험과 함께 인용합니다.
  기준·pack 문서는 저장소 값(경로·명령·stack 이름)을 쓰지 않고 binding 키로 가리키며, 이 저장소의 값은
  [KNU domain binding](../domain/knu-binding.md)에 있습니다.

## 자동 선택

리뷰를 만들 때 기준 id를 주지 않으면 리뷰 대상 경로로 기준 문서를 고릅니다. 선택 module은
[`review-criteria-selection.mjs`](../../../../scripts/agents/common/review-criteria-selection.mjs)이고 host 정책을 import하지
않습니다. Host가 넘기는 대상 경로는 Parent 작성 변경이면 subject 경로(디렉터리는 그 아래 tracked·비ignored 파일), 위임한 task면
관측한 변경 경로입니다.

- 경로 키: [KNU domain binding](../domain/knu-binding.md)의 `repo-structure.*` 값이 경로 glob입니다. 영역 기준 문서
  `web-<layer>-<하위 layer>`는 [pack](../domain/swe-web/README.md) 하위 layer 절의 `### binding 키`에 적힌 경로 키로, layer 없는
  `swe`·`documents`·`agent-workflow-tooling`은 `repo-structure.review-<id>` 키로 대상 경로와 맞춥니다. 경로 키가 하나도 없는 하위
  layer 절, 표에 없는 키, 기준 문서가 없는 절은 선택을 거부합니다.
- Glob 해석: backtick 안 경로만 glob입니다. 끝 `/`는 그 아래 전체, `<이름>`은 한 segment, `**`는 0개 이상 segment(끝에 오면 그
  아래 1개 이상), `/*`는 바로 아래 파일만, `*`만 있으면 root 파일입니다. segment 안의 `*`(예: `*.json`·`tsconfig*.json`)는 `/`를 뺀
  0개 이상 글자이고, wildcard가 없는 glob은 정확한 경로입니다. `!`를 앞에 붙인 glob은 그 키에서 뺍니다. `/`·`*`도 확장자도 없는
  backtick 단어(예시 이름)와 backtick 밖 설명은 범위를 좁히지 않습니다.
- 겹침: 다른 layer(FE·BFF·BE·DB·infra)의 문서가 같은 경로에 맞으면 더 구체적인 키로 맞은 문서만 고릅니다. 구체성은 맞은 glob의
  wildcard 앞 고정 segment 수이고 같으면 둘 다 고릅니다. 같은 layer 안, cross-cutting(security-privacy·operations-release), layer
  없는 문서는 맞으면 모두 고릅니다.
- 상속: 고른 문서의 머리말("이 문서를 고르면 … 함께 고릅니다")이 가리키는 문서를 함께 고르고, 그 문서의 머리말도 따라갑니다.
- Layer 신호: 영역 문서의 선택 이유에 [domain guide registry](../../../../scripts/agents/common/domain-guide-registry.mjs)가 그
  경로에 layer 신호를 주는지(`present`·`missing`, registry가 그 경로를 판정하지 못하면 `unavailable`)를 적습니다. 신호가 없어도
  경로 키가 맞으면 고르고, 그 기록은 registry 정렬의 입력입니다.
- 기록: 리뷰마다 고른 문서, 문서별 항목 id(`<file> <문자><번호>`), 선택 이유(맞은 경로·키·glob·구체성, 상속 출처), 겹침으로 뺀
  문서, 문서·항목 수, 맞은 키가 없는 경로를 helper 디렉터리의 `<reviewId>.criteria.json`에 남깁니다. Reviewer read path는 아닙니다.
- Override: 기준 id를 직접 주면(Claude `--criteria`) 그 문서만 쓰고 기록에 `override`와 자동 선택 결과를 함께 남깁니다.
  Claude `--criteria none`은 기준 문서 없이 리뷰하고 기록에 override `none`과 자동 선택 결과를 남깁니다. 기준 효과를 재는 비교
  측정(교정·baseline)용이고 필수 리뷰에는 쓰지 않습니다. 다른 id와 섞거나 `e3`와 함께 주면 거부합니다.
- 영역 판정: `matchReviewCriteriaPath(path, catalog)`는 경로 하나에 겹침 규칙까지 적용한 문서와 그 layer(`areas`)를 냅니다.
  CI `Lifecycle gate`의 영역 검사(`W-AREA`)가 이 함수로 제품 경로마다 영역이 있는지 봅니다([KNU domain binding의 영역 검사](../domain/knu-binding.md#영역-검사)).

## 리뷰어 입력

리뷰를 만들 때 자동 선택과 같은 리뷰 대상 경로로 reviewer가 subject 옆에서 읽을 기록을 고릅니다. 공통 module은
[`review-context-inputs.mjs`](../../../../scripts/agents/common/review-context-inputs.mjs)이고 host 정책을 import하지 않으며 CLI로도
씁니다(`node scripts/agents/common/review-context-inputs.mjs [--lifecycle-draft <경로>] -- <리뷰 대상 경로…>`).

- intent: [`docs/product/intent.md`](../../../product/intent.md)가 있으면 경로와 무관하게 넣습니다.
- 결정 기록: 자동 선택이 고른 영역 문서의 layer마다 [결정 기록](../../../architecture/decisions/README.md)
  `docs/architecture/decisions/<layer>.md`가 있으면 넣습니다. 파일이 없는 layer는 기록의 `absent`에만 남습니다.
- 정책 문서: 제품 경로를 CI `Lifecycle gate`의 경로 → 정책 도메인 표(`docs/policies/path-domains.json`)로 판정한 도메인마다
  `docs/policies/<도메인>.md`를 넣습니다(파일이 없으면 `absent`). 판정은 [`policy-first-check.mjs`](../../../../scripts/ci/lifecycle/policy-first-check.mjs)의
  `parsePathDomains`·`createPathTable`을 import하고 복제하지 않으므로, 그 표나 두 함수를 바꾸는 변경은 리뷰어 입력도 바꿉니다.
- 변경 등급 기록: Parent가 준 `## Lifecycle` 초안 파일(Claude Parent subject의 `lifecycleDraft`)을 넣습니다. Reviewer는 초안의
  `변경 등급`·`등급 근거`·`정책 영향 없음`·`인용 규칙`을 근거가 아닌 Parent 주장으로 보고 diff와 대조합니다. 초안이 없으면 변경을
  feature로 봅니다.
- Binding 문서(`knu-binding.md`)는 넣지 않습니다.
- 항목마다 포함 이유(intent, layer와 그 layer를 고른 기준 문서·경로, 도메인과 그 경로, 초안)를 붙입니다. 목록은 reviewer read
  path가 되고 prompt 입력 줄에는 경로와 이유만 들어갑니다. 기록은 `<reviewId>.context.json`(Claude는 helper 디렉터리,
  Codex는 knu-review skill이 정한 위치)이고 read path는 아닙니다.
- Reviewer는 요구가 말하지 않은 동작을 intent·결정 기록과 합리적 사용자 기대로 판정하고, 판정하지 않고 둔 동작은 결과
  `unjudgedBehaviors`(`behavior`·`reason`)에 적습니다. 이 필드는 PASS를 막지 않고 Parent가 정산 때 줄마다 처분합니다([처분
  기록](#처분-기록)). 같은 유형의 결함이 다른 위치에도 있으면 그 finding의 `sameTypeLocations`(`path:line`)에 적습니다.

## 항목 형식

문서당 항목 수 상한은 두지 않습니다. 적용 조건이 다른 항목이 섞이면 문서를 나눕니다. 각 항목은 `### <문자><번호>. <이름>`
제목과 아래 일곱 줄을 이 순서로 가집니다.

```text
- 질문: reviewer가 판정할 한 문장 질문
- 기본 severity: `critical` | `high` | `medium` | `low` (QA severity 정의)
- 적용 조건: 이 항목을 판정하는 변경의 범위
- 결함 패턴: 이 항목이 실제로 잡아야 했던 결함 유형의 요약
- PASS 근거: 충족을 보이는 관측(test·runner 기록·source 위치)
- 지침: 구현할 때 해야 할 것
- 피함: 구현할 때 피할 것
```

- 한 항목이 두 보기를 함께 가집니다. 지침·피함은 구현할 때 보는 구현 보기이고, 질문·기본 severity·결함 패턴·PASS 근거는 리뷰할
  때 보는 리뷰 보기입니다. 적용 조건은 두 보기가 함께 씁니다. 두 보기를 같은 블록에 두어 한쪽만 바뀌는 일이 diff에 보이게 합니다.
- 문서마다 항목 문자 하나를 씁니다(`documents` D, `agent-workflow-tooling` W, `swe` S, 영역 문서는 FE `F`·BFF `B`·BE `E`·DB
  `T`·infra `I`·security-privacy `P`·operations-release `O`). 영역 문서는 첫 항목 앞 머리말에 상속하는 문서·항목과 강화 관계를 적습니다. 영역 문서의 항목은
  상속한 항목보다 좁은 조건을 더 보는 별도 항목이고 기본 severity는 자기 값입니다. 상속한 항목은 영역 문서를 골라도 자기 기본
  severity로 그대로 적용되고 영역 문서가 끄거나 낮추지 못합니다. 같은 결함이 두 항목에 함께 맞으면 기본 severity가 높은
  항목으로 판정합니다.
- 구현 지침 문서(plan-authoring guide)는 항목 문장을 다시 쓰지 않고 `[swe.md S4](./swe.md#s4-책임-경계와-결합도)`처럼 항목 제목
  anchor로 인용합니다. 구현 guide가 없는 저장소 전용 기준(`documents`·`agent-workflow-tooling`)을 뺀 모든 항목은 guide 하나 이상이
  인용해야 합니다. pack 하위 layer 절도 같은 방식으로 인용하지만 guide 인용을 대신하지 않습니다.
- 결함 패턴은 유형 요약입니다. Local 증거 경로, plan 파일명, 작업 단계 이름을 근거로 인용하지 않습니다.
- Reviewer는 적용 조건에 맞는 항목을 판정합니다. 미충족 항목은 `criteriaItem` 필드에 항목 id 하나(예: `documents.md D2`)만 적은
  finding이 되고 기본 severity에서 시작하며, 다르게 매기면 finding에 이유를 적습니다. 관련 항목과 이유는 finding 본문에 적습니다. 리뷰 기록 측정은 이 필드로 항목을 셉니다. 충족한 항목은 finding이 아니라 그 항목의 PASS 근거에 해당하는 관측으로 acceptance coverage에 씁니다.
- 결정적 검사가 이미 판정하는 내용(Markdown link·anchor 해석 등)은 항목으로 두지 않습니다.

## 결정적 검사

리뷰를 dispatch하는 runner가 리뷰 전에 실행하는 host 공통 검사입니다. 도구 자체는 `scripts/ci/agents/common/`의 fixture
test가 보호하지만, ignored 입력(계획·증거·runner 기록)에 대한 적용은 runner가 실행하고 그 출력을 기록할 때만 효력이
있습니다. CI는 ignored 입력을 보지 못합니다.

| 검사        | 명령                                                                                                           | 위반 종류                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인용        | `node scripts/agents/common/citation-check.mjs [--root <repo>] [--json] <md file...>`                          | `unresolved`·`ambiguous`·`invalid-range`·`out-of-range`·`unreadable`·`invalid-expectation`·`content-mismatch`                                                                         |
| Runner 기록 | `node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header <첫 줄> [--root <repo>] [--json]`  | `invalid-record`·`missing-output`·`output-missing`·`digest-mismatch`·`header-mismatch`·`exit-mismatch`·`invalid-fragment`·`summary-mismatch`                                          |
| RED 사유    | `node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex> [--expect <regex>...] [--json]` | `missing-summary`·`no-failure`·`no-failure-blocks`·`unexpected-reason`·`unexpected-signature`                                                                                         |
| Mutation    | `node scripts/agents/common/mutation-harness.mjs --spec <JSON> [--link-node-modules] [--root <repo>] [--json]` | `baseline-failed`·`survived`·`target-missing`·`ambiguous`·`wrong-reason`·`timeout`                                                                                                    |
| 계획 참조   | `node scripts/agents/common/plan-reference-check.mjs [--root <repo>] [--report-only] [--json] <plan md...>`    | `unresolved`·`unresolved-target`·`duplicate-definition`·`broken-link`                                                                                                                 |
| 처분 기록   | `node scripts/agents/common/review-adjudication.mjs [--root <repo>] [--json] <adjudication.json...>`           | `invalid-field`·`unknown-key`·`result-unreadable`·`missing-finding`·`duplicate-finding`·`unknown-finding`·`missing-reason`·`missing-origin`·`invalid-duplicate`·`duplicate-result-id` |

- Exit 0은 위반 없음, 1은 위반, 2는 입력 오류(option·파일·root 없음, 읽기 실패, 빈 입력, 형식이 틀린 header·regex·spec·JSON,
  git 저장소 밖의 root, 알 수 없는 option·spec key, 지원하지 않는 형식, 만들 수 없는 mutation 사본)입니다. 입력 오류를 통과로 세지 않습니다. `--json`은 summary와 위반 목록을 JSON으로 냅니다.
- 명령줄의 입력 파일은 현재 디렉터리 기준이고, 인용·runner 기록·처분 기록 안의 경로는 `--root`(기본: 현재 git 저장소 root)
  기준입니다. Mutation spec의 경로는 [Mutation](#mutation)을 따릅니다.
- 인용 검사는 존재와 줄 범위만 봅니다. 고친 줄 번호가 같은 내용을 가리키는지는 내용 대조(아래)가 있을 때만 판정되므로,
  [PASS 뒤 처분](../qa.md#pass-뒤-처분)에서 인용 줄 번호 수정의 결정적 검사로 쓰려면 그 인용에 내용 대조를 붙입니다.

### 인용

- 대상은 fenced code 밖 backtick 안의 `<path>.<ext>:<줄>`과 `<path>.<ext>:<시작>-<끝>`입니다. `--root` 기준으로 그 경로가
  있거나 확장자가 tracked 파일의 확장자이면 인용입니다. 그 밖(`localhost:3000`, `example.com:443`)은 건수(`notCitations`)만 셉니다.
- 해석 순서는 `--root` 기준 정확 경로(대소문자까지 일치) → tracked 경로의 고유 접미입니다. 경로 없는 파일 이름도 고유하면
  해석되고, 해석되지 않는 인용(오타 파일 이름 포함)은 위반입니다. 줄 수는 마지막 줄바꿈 뒤의 빈 줄까지 셉니다.
- 내용 대조는 선택입니다. 인용 바로 뒤에 `~ "문자열"`을 쓰면 그 줄 범위에 문자열이 있어야 합니다(`\"`·`\\` escape). 빈
  문자열과 닫히지 않은 따옴표는 위반입니다. 줄 번호만으로는 줄이 다른 내용으로 밀린 경우를 잡지 못합니다.
- Backtick 없는 인용과 다른 형식의 code span 안 인용(`path.ext:3:5`, `see path.ext:3`)은 검사하지 않고 건수(`unchecked`)만 셉니다. 인용이 주장의 근거로 맞는지는
  [documents.md D2](./documents.md#d2-근거-참조의-현재성)가 판정합니다.

### Runner 기록

- Header는 `<문구> sha256:<64 hex>` 형식이고 마지막 token이 digest입니다. Record의 공통 필드만 읽습니다: `exit`(정수),
  `outputPaths`(비어 있지 않은 배열), `observedResult`(문자열), 있으면 `sourceDigest`(header digest와 같아야 함). 필드 형식
  전체는 각 host의 runner helper가 검사합니다.
- `.log`·`.txt` 출력은 첫 줄이 header와 같아야 하고, 마지막 `exit=<n>` 줄이 있으면 record의 `exit`와 같아야 합니다. 다른
  형식 출력은 존재만 확인합니다.

요약 조각 작성 규칙: `observedResult`의 backtick 조각은 그 record의 `.log`·`.txt` 출력과 대조합니다.

- 조각은 그 실행의 결과 줄에서 로그에 찍힌 라벨과 함께 그대로 옮깁니다(`ℹ pass 873`, `exit=0`, `Install dependencies=28`).
- 라벨 없는 조각(공백을 빼면 숫자·hex 문자·구두점·기호만인 `41`·`208`), 빈 조각, 짝이 맞지 않는 backtick은
  `invalid-fragment`입니다.
- 조각은 header 줄과 digest 줄(`<64 hex>  <path>` 형식의 `shasum` 출력, `sha256:<64 hex>`를 포함한 줄)을 뺀 줄 하나에
  token으로 있어야 합니다. 조각 앞뒤는 줄 시작·끝이거나 영숫자·`_`·`.`·`-`가 아닌 문자여야 하므로 `ℹ pass 87`은
  `ℹ pass 873`과 맞지 않습니다. 없으면 `summary-mismatch`입니다.
- Backtick 조각이 없는 요약은 대조하지 않고 건수(`unverifiedSummaries`)만 셉니다.
- 한 로그에는 한 실행만 둡니다. 같은 라벨이 echo된 명령 문구나 같은 로그의 이전 실행 출력에 있으면 우연히 일치할 수
  있습니다(known limit).

### RED 사유

- 입력은 `node --test` spec reporter 출력이고, `--expect`는 기대 실패 사유 regex(Unicode mode)이며 하나 이상 필요합니다. 빈
  문자열과 맞는 pattern(`''`, `.*`)은 모든 줄과 맞으므로 입력 오류입니다.
- `ℹ fail` 값이 0보다 커야 하고, `✖ failing tests:` 절의 실패 block마다 오류 본문(`✖` 줄 다음부터 다음 결과 줄 전까지)에
  `--expect`와 맞는 줄이 있어야 합니다. Block이 하나도 없으면 위반입니다.
- Block 수는 `ℹ fail`과 비교하지 않습니다. 하위 test 실패로 실패한 상위 test는 `ℹ fail`에 세지만 그 절에 block이 없기
  때문입니다. 그래서 잘린 로그의 빠진 block은 잡지 못합니다(known limit). 출력의 `fail`·`failures`가 다르면 runner가 로그를
  확인합니다.
- 기대 밖 사유 signature(`SyntaxError`, `ERR_MODULE_NOT_FOUND`, `Cannot find module`·`Cannot find package`, `ReferenceError`,
  `does not provide an export`, `ENOENT`)가 `--expect`와 맞지 않는 줄에 있으면 위반입니다. 실패 block 밖(예: import 오류의
  stderr)도 검사합니다. 결과 줄(`✔`·`✖`·`﹣`·`ℹ`·`▶`로 시작하는 줄과 `test at` 줄)은 test 제목이므로 사유로 읽지 않습니다.

### Mutation

- Spec은 `{command: [argv], timeoutSeconds?: 300, mutations: [{id, file, find, replace, occurrence?, expect?: [regex]}]}`입니다.
  `file`은 저장소 root 기준 경로(`--root`가 하위 디렉터리여도 그 저장소의 root), `occurrence`는 1부터 셉니다. 정규화한 경로가 저장소 밖(절대 경로, `..`)이거나 모르는 key가 있으면 입력 오류입니다.
- 원 작업 tree는 읽기만 합니다. HEAD의 detached worktree에 현재 diff와 ignore되지 않은 untracked 파일을 옮긴 사본에서
  baseline과 mutation을 실행하고, 끝나면 worktree를 지웁니다. Ignored 파일은 사본에 없습니다. Symlink를 따라 사본 밖으로
  나가는 `file`(linked `node_modules` 등)은 쓰지 않고 `target-missing`입니다.
- SIGINT·SIGTERM을 받으면 실행 중인 명령의 process group을 멈추고 사본을 지운 뒤 exit 130·143으로 끝납니다. SIGKILL처럼
  처리할 수 없는 중단은 사본과 worktree 등록을 남기므로(known limit) `git worktree list`에서 `mutation-harness-` 사본을 찾아
  `git worktree remove --force <경로>`로 지웁니다.
- Baseline이 exit 0이 아니면 mutation을 실행하지 않고 위반 하나로 끝냅니다. Mutation마다 적용 → 실행 → 복원합니다.
- `killed`는 exit가 0이 아니고, `expect`가 있으면 출력(stdout·stderr)이 모든 pattern과 맞는 경우입니다. 나머지 상태는
  모두 위반입니다. `find`가 없거나 `occurrence`가 일치 수를 넘으면 `target-missing`, 두 번 이상 맞는데 `occurrence`가
  없으면 `ambiguous`입니다. `timeout`은 명령의 process group 전체를 멈춥니다.
- `--link-node-modules`는 root와 workspace의 `node_modules`를 사본에 symlink합니다. Workspace package는 원 checkout을 읽게
  되므로 `packages/` 아래(정규화한 경로, 대소문자 무시) mutation과 함께 쓰면 입력 오류입니다.

### 계획 참조

문법과 판정은 [Plan references](../plan-authoring/references.md)가 소유합니다. 이 문법 전부터 있던 계획은 `--report-only`로
건수만 기록합니다.

### 처분 기록

- [QA 리뷰 회차](../qa.md#리뷰-회차)의 finding별 처분을 기계로 검사할 수 있게 쓰는 형식입니다. 파일은 reviewer result 옆의
  `<회차>-adjudication.json`입니다.

```json
{
  "schema": "review-adjudication/v1",
  "subject": "<변경 이름>",
  "round": 2,
  "reviews": [{ "taskId": "<reviewer task id>", "resultPath": "<--root 기준 result JSON 경로>" }],
  "findings": [
    { "id": "<task id>#0", "severity": "medium", "disposition": "fixed", "origin": "fix-induced" }
  ]
}
```

- Finding id는 result finding의 `id`, 없으면 `<task id>#<result findings 배열 index, 0부터>`입니다. 나열한 result의 모든
  finding이 정확히 한 번 나와야 하고 모르는 id는 위반입니다. 두 result finding이 같은 id를
  가지면 처분 하나가 둘을 덮으므로 `duplicate-result-id`입니다.
- `severity`는 QA severity, `disposition`은 `fixed`(회차 중 수정)와 [PASS 뒤 처분](../qa.md#pass-뒤-처분) 값
  `fixed-mechanical`·`deferred`·`rejected`·`pre-existing`입니다. `deferred`·`rejected`는 `reason`이 필요합니다. 회차 중과
  PASS 뒤의 구분은 검사하지 않습니다.
- `duplicateOf`는 같은 기록의 다른 finding(다른 reviewer가 낸 같은 결함)이고 그 finding의 disposition을 따릅니다. 중복의
  중복은 위반입니다.
- 2회차부터 `origin`이 필요합니다: `fix-induced`(수정이 들여온 결함), `previously-missed`(이전 회차가 놓친 결함),
  `re-raised`(다시 제기된 결함). `fixRef`는 선택입니다.
- 나열한 result에 `unjudgedBehaviors`(판정하지 않은 동작) 줄이 있으면 선택 key `unjudged`에 줄마다
  `{ "id": "<task id>#u<index>", "disposition": "...", "reason": "..." }`를 둡니다. Index는 result `unjudgedBehaviors` 배열
  index(0부터)입니다. `disposition`은 `out-of-scope`(이 변경 범위 밖)·`raised`(Parent가 finding으로 올림)·`follow-up`(후속
  작업)이고 모두 `reason`이 필요합니다. 줄마다 정확히 한 번 나와야 하며 처분이 빠진 줄(`missing-unjudged`)과 모르는 id는
  위반입니다.

### 리뷰 측정

[공통 ledger](../../../../scripts/agents/common/review-ledger.mjs)는 host reader가 준 행에서 상태·verdict·severity·기준
항목·회차·처분·기원 건수를 셉니다. 측정이며 판정이 아닙니다. 형식이 틀린 행은 이유와 함께 건수에서 뺍니다.

- Claude: `node scripts/agents/claude/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]... [--until <ISO 시각>] [--json]`.
  Native registry의 `knu_reviewer` task를 읽고, `--adjudications` 아래 `*-adjudication.json`과 task id로 연결합니다. 처분
  기록이 틀리거나(JSON이 아닌 기록, 한 task를 두 기록이 처분한 경우 포함) 형식이 틀린 행이 있으면 exit 1입니다. `--until`은
  발행 시각이 그 시각 이전인 task만 세고, 발행 시각을 읽지 못한 task는 빼고 그 수를 `excludedWithoutIssuedAt`으로 냅니다.
- 행 상태: `parsed`, `parse-failed`(마지막 응답에 result JSON 없음), `completion-missing`, `task-unreadable`(task 기록을 읽지
  못해 reviewer인지 모르는 task도 행으로 셈). 회차는 reviewer
  prompt의 `Review round N`에서 읽고, 회차 입력 전 기록은 `unknown`입니다.
- 행의 finding은 id·severity·기준 항목(`criteriaItem`)과 result finding의 위치(`location`, 없으면 null)를 담습니다.

## 갱신

리뷰가 놓쳐 merge 뒤 발견된 결함과 Parent가 재현으로 기각한 finding은 기준 항목 갱신의 입력입니다. 갱신은 이 디렉터리의 문서
변경이며 다른 문서와 같은 독립 리뷰 규칙을 따릅니다. 문서 graph test가 항목 제목·일곱 줄의 형식·순서(다른 필드·중복 없음),
README에 숫자 상한 문장('N개 이하'·'최대 N' 등)이 없음, guide·pack 인용(해석, 인용되지 않은 항목, pack 하위 layer 절의 항목
인용과 id 목록), pack 결정의 필드 순서와 먼저 정할 결정 해석, binding 키의 표기와 해석, 저장소 값 이름 목록 부재를
검사합니다.
