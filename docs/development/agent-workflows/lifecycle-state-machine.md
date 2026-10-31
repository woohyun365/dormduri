# Lifecycle state machine

작업 생명주기 상태 기계의 상태·guard·역전이·변경 등급·등록 검사는
[정의 JSON](../../../scripts/ci/lifecycle/lifecycle-definition.json)(`lifecycle-definition/v1`)이 값으로 가진다. 이 문서는
field 의미와 그 값을 읽는 규칙을 설명하고, 상태·guard·역전이를 사람이 읽는 표로 둔다. 세 표는 정의의 사본이고 값의 원본은
JSON이다. [정의 test](../../../scripts/ci/lifecycle/lifecycle-definition.test.mjs)가 세 표의 id·층·나가는 상태·강도·확인
주체를 JSON과 대조하고, 정의를 계약 값(상태 13, guard 14, 역전이 5, 등록 검사 8)과 검사 code의 출력에 묶는다.

지금 정의를 읽는 것은 정의 test와 상태 계산기([계산 규칙](#계산-규칙))다. hook·CI 연결은 아직 없고, CI `Lifecycle gate`가
PR마다 판정하는 것은 `checks`의 등록 검사다([Lifecycle 절](../github/collaboration.md#lifecycle-절)). guard의 `hook`·`ci` 값은
그 guard를 강제할 위치의 설계다.

## 정의 field

| field       | 의미                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`    | `lifecycle-definition/v1`. field나 어휘를 바꾸면 version을 올린다                                                                                                                                                                                              |
| `strengths` | 강도 어휘 다섯(아래 확인 주체와 강도)                                                                                                                                                                                                                          |
| `states`    | 상태 13개. `id`, `layer`(`project`·`work`), `artifacts`(그 상태에서 만드는 산출물 요약). 층마다 진행 순서다                                                                                                                                                    |
| `guards`    | 상태를 나가는 조건 14개. `id`, `state`(나가는 상태), `input`(판정 입력), `strength`(강도 배열), `confirmer`(확인 주체), `condition`(조건부 guard만), `hook`·`ci`(강제 위치 설계, 없으면 `null`), `checks`(이 guard의 CI 부분인 등록 검사 id)                   |
| `reverse`   | 역전이 5개. `id`, `trigger`(계기), `target`(돌아갈 곳), `rule`, `detection`(탐지). `R-SIGNAL`만 `sameFixLimit`을 갖는다                                                                                                                                        |
| `grades`    | 변경 등급 다섯. 키는 [`lifecycle-section.mjs`](../../../scripts/ci/lifecycle/lifecycle-section.mjs)의 `LIFECYCLE_GRADES`다. `path`(거치는 작업 층 상태), `steps`(상태가 아닌 절차 단계), `skip`(계산하지 않는 guard), `warnOnly`(실패를 경고로 계산하는 guard) |
| `checks`    | 등록 검사 8개. `id`(검사 code가 내는 finding의 `check`), `module`, `guard`(이 검사가 CI 부분인 guard, 없으면 `null`)                                                                                                                                           |

## 확인 주체와 강도

- `strengths`의 `deterministic-static`·`native-runtime`·`model-mediated`·`advisory-policy`는
  [plan-authoring core](./plan-authoring/core.md#7-implementation-readiness-promotion)의 enforcement strength와 같은 뜻이다.
  `human-judgment`는 사람(Owner 또는 Owner가 지정한 검토자)의 선택 자체가 판정인 경우다.
- `confirmer`는 누가 그 guard를 넘기는지(`owner`, `owner-or-delegate`, `reviewer`, `parent`, `agent`, `setup`, `github`,
  `evidence-stage`)이고 `strength`는 그 판정을 무엇이 강제하는지다. 같은 Owner 확인도 강제 방식이 다르므로 둘을 다른
  field로 둔다. `W-POLICY`는 확인 주체가 `owner`이지만 강도는 정책 header 값 검사(`deterministic-static`)와 L4 설계 절의
  reviewer 판정(`model-mediated`)이다. header의 `owner-confirmed` 값은 기계가 읽지만, Owner와 agent가 같은 credential을 쓰는
  저장소에서는 그 값을 Owner가 썼는지 증명하지 못한다.
- reviewer 판정은 `model-mediated`다. `W-EVID`는 evidence 단계의 contract가 강도를 정하므로 빈 배열이다.
- `W-DESIGN`은 plan이 시각 품질 claim을 선언했을 때만(`condition` `visual-quality-claim`) `policy-ready`에서 `W-POLICY`와
  함께 계산한다. 판정 입력은 시각 방향 확정 기록(확정 원문과 본 산출물의 경로·revision)이고 강도는 `human-judgment`다. 확정
  기록 없이 Owner 지시로 다음 단계로 가면 확정이 아니라 `W-DESIGN` override다. 후보 탐색과 선택 절차는
  [Visual design](./visual-design/README.md)이 소유한다.

## 상태

| 상태              | 층        | 산출물                                                                                |
| ----------------- | --------- | ------------------------------------------------------------------------------------- |
| `uninitialized`   | `project` | 없음                                                                                  |
| `intake`          | `project` | 요청 분류(변경 등급·intent), 고위험 trigger 판정                                      |
| `discovery`       | `project` | PRD 개요 초안(draft), 질문과 답                                                       |
| `product-defined` | `project` | PRD 개요(owner-confirmed), 정책 도메인 목록                                           |
| `policy-baseline` | `project` | cross-cutting 정책(법적 근거·데이터 보유·인증·권한 모델·실제 돈, 고위험 trigger 포함) |
| `architected`     | `project` | L1 아키텍처 개요(owner-confirmed), L1 결정의 L2 기록, 경로 → 정책 도메인 표           |
| `planned`         | `work`    | umbrella·bounded plan(PRD 기능 영역 문서와 링크)                                      |
| `policy-ready`    | `work`    | 바뀌는 도메인의 정책(owner-confirmed), L4 설계 절                                     |
| `ready`           | `work`    | plan implementation-ready, 정책 규칙을 인용한 acceptance                              |
| `implementing`    | `work`    | branch, 정책 규칙에서 도출한 RED test, 구현                                           |
| `reviewing`       | `work`    | 독립 리뷰 결과                                                                        |
| `merged`          | `work`    | PR, CI                                                                                |
| `evidenced`       | `work`    | evidence 원자료·승격                                                                  |

프로젝트 층 산출물이 owner-confirmed로 남아 있으면 그 상태는 유지되고, 다시 draft가 되면 그 상태로 돌아간다. 작업 층의
bounded plan은 프로젝트 층이 `architected`일 때 만든다(`W-SCOPE` 입력). plan이 추적되지 않는 저장소에서는 plan → PRD 기능
영역 문서 한 방향으로 링크한다(추적 문서는 ignored 경로를 근거 링크로 쓰지 않는다).

## Guard

guard는 그 상태를 나가는 조건이다. 층마다 위에서부터 첫 실패 guard의 상태가 그 층의 상태이고, 모두 통과하면 마지막 상태다.
`P-ARCH`는 나간 뒤에도 지켜야 하는 유지 조건이다. 조건부 guard는 조건이 거짓이면 계산하지 않는다.

| guard           | 나가는 상태       | 입력                                                                    | 강도                                     | 확인 주체           |
| --------------- | ----------------- | ----------------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| `P-INIT`        | `uninitialized`   | repo binding                                                            | `deterministic-static`                   | `setup`             |
| `P-GRADE`       | `intake`          | 변경 등급·근거, 고위험 trigger 판정 기록                                | `model-mediated`                         | `agent`             |
| `P-DIRECTION`   | `discovery`       | PRD 개요 header                                                         | `deterministic-static`                   | `owner`             |
| `P-POLICY-SET`  | `product-defined` | 정책 도메인 목록, cross-cutting 대상                                    | `deterministic-static`                   | `owner`             |
| `P-POLICY-BASE` | `policy-baseline` | cross-cutting 정책의 header 또는 대응 기록 `not-applicable` 확인        | `deterministic-static`                   | `owner`             |
| `P-ARCH`        | `architected`     | L1 개요 header, L2 결정 기록, 경로 → 정책 도메인 표                     | `deterministic-static`                   | `owner`             |
| `W-SCOPE`       | `planned`         | 프로젝트 층 `architected`, plan의 정책 도메인·하위 layer·경로 선언      | `deterministic-static`                   | `parent`            |
| `W-POLICY`      | `policy-ready`    | 선언 도메인 정책의 header 또는 대응 기록, `R-UPSTREAM` 아님, L4 설계 절 | `deterministic-static`, `model-mediated` | `owner`             |
| `W-DESIGN`      | `policy-ready`    | 시각 방향 확정 기록(시각 품질 claim이 있을 때)                          | `human-judgment`                         | `owner-or-delegate` |
| `W-READY`       | `ready`           | implementation-ready, 비가역 결정 확인, 규칙 id 인용, `R-UPSTREAM` 아님 | `model-mediated`, `deterministic-static` | `reviewer`          |
| `W-PATHS`       | `implementing`    | 바뀐 경로가 plan 경로 선언 안                                           | `deterministic-static`                   | `parent`            |
| `W-REVIEW`      | `reviewing`       | 독립 리뷰 PASS와 정산                                                   | `model-mediated`, `deterministic-static` | `reviewer`          |
| `W-MERGE`       | `merged`          | required check green, merge                                             | `native-runtime`                         | `github`            |
| `W-EVID`        | `evidenced`       | evidence 단계 완료                                                      | 없음                                     | `evidence-stage`    |

- `P-DIRECTION`은 PRD 개요 header만 계산한다. 그때까지 나온 비가역 결정의 확인은 리뷰가 보고, 작업 층의 비가역 결정은
  `W-READY`가 본다.
- `P-ARCH`의 L2 입력은 결정 기록이 있는지다. L1의 결정마다 L2가 있는지는 리뷰가 본다. 경로 → 정책 도메인 표의 행과
  `noDomain` 어디에도 맞지 않는 새 제품 디렉터리는 경고다.
- repo-based 저장소는 산출물 자리에 추적 대응 기록(이 저장소는 [Product documents](../../product/README.md)의
  `artifact-map.json`)의 항목을 넣어 같은 guard를 계산한다. `legacy`는 충족이되 표시하고, `not-applicable`은 Owner 확인이
  있어야 충족이다.

## 변경 등급

| 등급                      | `path`                                                                                       | `steps`                                                             | `skip`                                      | `warnOnly`           |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| `trivial`                 | `implementing` → `reviewing` → `merged` → `evidenced`                                        | 없음                                                                | `W-SCOPE`, `W-POLICY`, `W-READY`, `W-PATHS` | 없음                 |
| `bugfix`·`hotfix`         | `policy-ready` → `implementing` → `reviewing` → `merged` → `evidenced`                       | `baseline-check`, `reproduce`, `cause-hypothesis`, `confirm`, `red` | `W-READY`                                   | `W-SCOPE`, `W-PATHS` |
| `feature`·`policy-change` | `planned` → `policy-ready` → `ready` → `implementing` → `reviewing` → `merged` → `evidenced` | 없음                                                                | 없음                                        | 없음                 |

- `path`의 첫 상태가 그 등급의 작업 층 시작이다. 프로젝트 층의 L1 확인 근거는 모든 등급에서 본다.
- bugfix·hotfix의 `steps`는 상태가 아닌 절차 단계이고 `implementing` 앞 순서다: 기준(정책·acceptance) 대조
  `baseline-check` → 재현 `reproduce` → 원인 가설 `cause-hypothesis` → 확인 `confirm` → RED `red`. `policy-ready`의
  `W-POLICY`가 기존 정책 대조이고, 고칠 기준이 정책에 없으면 feature로 올린다.
- bugfix·hotfix는 plan이 없어 `W-READY`(readiness PASS 날짜 비교 포함)를 계산하지 않고, `W-SCOPE`·`W-PATHS`는 PR 본문
  `Lifecycle` 절로 경고만 계산한다. trivial은 선언 범위가 없어 `W-PATHS`도 계산하지 않는다. plan이 없는 등급에서는
  `W-DESIGN`의 조건이 늘 거짓이다.

## 역전이

| 역전이       | 계기                                                      | 돌아갈 곳                                                                                     |
| ------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `R-AMBIG`    | 구현 중 새 모호함·미정 결정                               | `planned`(정책 변경이 필요하면 `policy-ready`)                                                |
| `R-REVIEW`   | 리뷰 finding이 정책·L2와 충돌                             | `policy-ready` 또는 `architected`                                                             |
| `R-UPSTREAM` | PRD·cross-cutting 정책·L1 변경                            | 바뀐 산출물의 상태                                                                            |
| `R-REJECT`   | Owner 확인 거절                                           | 검토 대상 상태의 처음                                                                         |
| `R-SIGNAL`   | 실패 신호: 요청 밖 기능, test 삭제·비활성, 같은 수정 반복 | 등급별: feature·policy-change `ready`, bugfix·hotfix `baseline-check`, trivial `implementing` |

- `target`은 상태 id 하나, 후보 배열(어느 쪽인지는 `rule`대로 agent가 판정), 등급별 객체 가운데 하나다. 상태나 절차 단계가
  아닌 값은 `reviewed-state-start`(검토 대상 상태의 처음)와 `changed-artifact-state`(바뀐 산출물의 상태) 둘이다.
- 구현 불가 경계: 구현 불가 블록은 guard 실패에서 낸다. 결정 목록(pack 결정 id) 밖이고 되돌림이 `easy`이며 선언 범위 안인
  판단은 [Owner–Lead collaboration](./owner-lead-collaboration.md#결정권과-안전한-다음-행동) 결정권 표의 Lead 결정이라
  trigger가 아니다. 셋 가운데 하나라도 벗어나면 `R-AMBIG` 블록이다(되돌림이 `costly`이면 Lead 결정이 아니다). 세 입력 값을
  정하는 것은 agent 판단(`model-mediated`)이다.
- `R-SIGNAL`의 "같은 수정 반복" 기준 값은 같은 결함 수정 3회 실패(`sameFixLimit`)이고 결과는 하나다: 멈추고 Owner에게 구조
  문제인지 묻는다. 구조 문제면 bugfix·hotfix를 feature로 올린다. 실패 횟수는 agent가 센다(`model-mediated`). 리뷰 회차의
  연속 non-PASS quality stop과 다른 축이다.
- `R-REJECT`는 그 상태의 처음으로만 돌아간다. `W-DESIGN` 확정 뒤 방향 기각은 `policy-ready` 처음이고 plan을 다시 써
  탐색부터 한다. 탐색 중 후보 기각은 `W-DESIGN` 미충족이지 역전이가 아니다.
- `R-UPSTREAM`은 표시가 아니라 계산이다. header 문서(정책·L1·L2)는 `근거` 링크가 가리키는 상위 문서의 확인일이 자기
  확인일보다 늦으면 재확인 필요이고, header가 없는 plan과 L4(plan 설계 절)는 readiness PASS 날짜를 입력으로 쓴다.

## 등록 검사

| 검사        | module                      | guard      |
| ----------- | --------------------------- | ---------- |
| `W-SCOPE`   | `policy-first-check.mjs`    | `W-SCOPE`  |
| `W-POLICY`  | `policy-first-check.mjs`    | `W-POLICY` |
| `W-CITE`    | `policy-first-check.mjs`    | `W-READY`  |
| `W-IRREV`   | `policy-first-check.mjs`    | 없음       |
| `L-CONFIRM` | `policy-first-check.mjs`    | 없음       |
| `W-AREA`    | `area-criteria-check.mjs`   | 없음       |
| `W-REVIEW`  | `review-snapshot-check.mjs` | `W-REVIEW` |
| `W-CAUSE`   | `review-snapshot-check.mjs` | 없음       |

- `guard`가 있는 검사는 그 guard의 CI 부분이다. `W-CITE`는 acceptance의 정책 규칙 인용이라 `W-READY`에 속한다.
- `guard`가 없는 검사는 상태를 나가는 조건이 아니다. `W-IRREV`(비가역 경로)와 `L-CONFIRM`(경로 표·대응 기록·정책 문서 변경의
  Owner 확인)은 강제 경로의 예외 행이고, `W-AREA`는 영역 리뷰 기준 검사, `W-CAUSE`는 bugfix·hotfix 경로의 기록 검사다.
- `W-REVIEW`·`W-CAUSE`는 경고만 내고 `W-REVIEW` 경고는 guard 실패가 아니다. `L-CONFIRM`은 override 줄로 낮추지 않는다
  (`run.mjs`의 `nonOverridable`).
- 검사 code가 괄호로 쓰는 출력 label(`(경로)`·`(형식)`)은 검사 id가 아니라 `checks`에 없다. 정의 test는 `checks` id가 검사
  code의 출력(`POLICY_FIRST_CHECK_IDS`, `AREA_CHECK_ID`, `evaluateReviewSnapshot` finding)과 같은지 보므로 검사를 더하거나
  지우면 정의를 함께 고친다.

## 계산 규칙

[`lifecycle-state.mjs`](../../../scripts/ci/lifecycle/lifecycle-state.mjs)의 `computeLifecycleState(input, definition)`는
정의와 입력 하나(`lifecycle-state-input/v1`)로 층별 상태를 계산하는 순수 함수다. 결과(`lifecycle-state/v1`)는 `grade`
(`declared`·`effective`·`raised`), `project`(`state`·`failed`·`legacy`·`recheck`), `work`(`state`·`failed`·`warnings`·
`skipped`·`checkFailures`)다. 그 결과로 무엇을 막을지는 결과를 쓰는 쪽(hook·`delegate` 진입·CI)이 정한다.

| 입력                                              | 값                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grade`                                           | 변경 등급. 없으면 feature이고 모르는 값은 입력 오류다                                                                                                                                                               |
| `artifacts`                                       | `config`·`prdOverview`·`policyDomains`·`crossCutting`·`l1`·`l2`·`pathDomains`. 문서는 `{ id, path, header }`, 대응 기록 항목은 `{ id, path, record }`, 경로 표는 `{ id, path, table }`                              |
| `plan`                                            | `domains`·`layers`·`paths`·`readinessPass`·`implementationReady`·`decisions`·`visualClaim`·`designConfirmation`(`source`·`artifact`·`revision`). local은 plan, CI는 PR 본문 `Lifecycle` 절에서 같은 모양으로 만든다 |
| `overrides`                                       | `Lifecycle` 절 override 줄 모양 `{ check, reason, revisit }`                                                                                                                                                        |
| `changedPaths`                                    | 바뀐 경로 목록                                                                                                                                                                                                      |
| `bugfixBasis`                                     | bugfix·hotfix의 기준 대조 결과 `found`·`missing`                                                                                                                                                                    |
| `policyFindings`·`areaFindings`·`review.findings` | 등록 검사 출력(`evaluatePolicyFirst`·`evaluateAreaCriteria`·`evaluateReviewSnapshot`)                                                                                                                               |
| `review`·`merged`·`evidenced`                     | 리뷰 PASS·정산, merge, evidence 단계 완료                                                                                                                                                                           |

- 층마다 guard를 정의 순서로 계산하고 실패한 첫 guard의 상태에서 멈춘다. 같은 상태를 나가는 guard(`W-POLICY`·`W-DESIGN`)는
  함께 계산하고 그 뒤 guard는 계산하지 않는다. `failed`는 그 상태 guard의 실패(`{ id, reason, needs }`, 구현 불가 블록의
  `failedGuards` 모양)이고, 모두 통과하면 마지막 상태다.
- 문서는 header `상태`가 `owner-confirmed`이면, 대응 기록 항목은 기록의 `confirmedBy`가 `owner-confirmed`이면 충족이다.
  `legacy`는 충족이되 `project.legacy`에 적고 `not-applicable`도 기록의 Owner 확인이 있어야 충족이다. `P-POLICY-SET`은 정책
  도메인 목록과 cross-cutting 대상 목록이 있는지, `P-ARCH`는 L1 충족·L2 기록 하나 이상·경로 표를 본다. `P-GRADE`는 늘
  통과다.
- 작업 층은 등급 `path`의 첫 상태에서 시작한다. feature·policy-change는 `W-SCOPE`가 프로젝트 층 `architected`와 plan 선언
  (`domains`·`layers`, 하나 이상의 `paths`)을 본다. bugfix·hotfix는 `planned`를 거치지 않으므로 프로젝트 층의 첫 실패
  guard를 그대로 `work.failed`에 두고, `W-SCOPE`의 선언 대조는 `warnOnly`라 경고로 계산한다. trivial은 `P-ARCH`의 L1
  확인만 본다. `bugfixBasis`가 `missing`이면 feature로 올려 계산하고 `grade.raised`에 이유를 적는다.
- 등급 `skip`의 guard는 `skipped`, `warnOnly` guard의 실패는 `warnings`다. `warnOnly`가 아니면서 등급 `path` 밖 상태를
  나가는 guard와 조건이 거짓인 조건부 guard는 계산하지 않는다(bugfix·hotfix의 `W-SCOPE`는 `planned`를 나가지만
  `warnOnly`라 경고로 계산한다).
- 바뀐 정책 도메인은 `plan.domains`와 `changedPaths`에 경로 표(`createPathTable`)를 적용한 판정의 합집합이고, `W-POLICY`는
  그 도메인마다 `policy:<도메인>` 산출물의 충족을 본다. 표 행과 `noDomain` 어디에도 맞지 않는 바뀐 제품 경로는 `W-SCOPE`
  경고이고 needs는 `경로 표 행 추가(L-CONFIRM Owner 확인)`다.
- `W-READY`는 `implementationReady`, readiness PASS 날짜, 비가역 결정, `R-UPSTREAM`을 본다. 비가역 결정은 plan readiness의
  규칙과 같다: `irreversible`이고 `unknown`·`provisional`이거나 Owner 확인 없는 `validated`이면 reason
  `irreversible-decision-unconfirmed`다. `W-PATHS`는 `changedPaths`가 비면 reason `바뀐 경로 없음`, `plan.paths` glob 밖
  경로가 있으면 그 경로를 적어 실패다.
- `R-UPSTREAM`(`upstreamRecheck`): header 문서는 `근거` 링크가 가리키는 산출물(문서는 `path`, 대응 기록 항목은 `sources`로
  찾는다)의 확인일이 자기 확인일보다 늦으면 재확인 필요이고 `project.recheck`에 `{ id, upstream }`으로 적는다. 대응 기록
  항목의 확인일은 기록의 `confirmedBy.date`다. plan은 readiness PASS 날짜가 PRD 개요·L1·선언 도메인 정책의 확인일보다
  이르거나 선언 도메인 정책이 재확인 필요면 재확인 필요다. 이 비교로 `W-POLICY`·`W-READY`를 reason `R-UPSTREAM` 실패로
  계산하는 것은 feature·policy-change뿐이다.
- 등록 검사 finding의 `warn`은 `warnings`다. guard가 있는 검사의 `fail`은 그 guard를 계산할 때 그 guard의 실패
  (`W-CITE`는 `W-READY`)이고, guard가 없는 검사(`W-IRREV`·`L-CONFIRM`·`W-AREA`·`W-CAUSE`)의 `fail`은 상태를 바꾸지 않고
  `checkFailures`다. 괄호 출력 label(`(경로)`·`(형식)`)은 검사가 아니라 읽지 않고, 그 밖에 `checks`에 없는 check id는
  입력 오류다.
- override 줄의 `check`가 실패한 guard나 등록 검사 id와 같으면 그 실패를 `override`(`reason`·`revisit`)를 붙인 경고로 옮기고
  계산을 이어 간다. `L-CONFIRM` 줄은 적용하지 않고 `override 대상이 아님` 경고를 낸다(`run.mjs`의 `nonOverridable`과
  같다). 실패가 없는 id의 줄은 바꾸는 것이 없고, 프로젝트 층 결과에는 적용하지 않는다.
- 모르는 schema·등급·field, `schema`·`artifacts` 누락, override 줄 모양 오류, `checks`에 없는 finding check id는
  `LifecycleInputError`다.

같은 module의 다른 함수:

- `evaluateBoundary({ packDecisionId, reversibility, inScope })`: 셋이 `null`·`easy`·`true`면 블록이 아니고, 하나라도
  다르면 `{ blocked: true, reverse: 'R-AMBIG', reasons }`(벗어난 입력 이름)다.
- `reverseTarget(id, { grade, reviewedState }, definition)`: `R-REJECT`는 `reviewedState`, 등급별 `target`은 그 등급의
  값, 나머지는 정의의 `target`이다. `sameFixStop({ grade, failedFixes }, definition)`은 `failedFixes`가 `sameFixLimit`
  이상이면 `{ reverse: 'R-SIGNAL', target, ask: 'structure' }`이고 아니면 `null`이다.
- `buildBlockedReport(fields)`·`validateBlockedReport(block)`은 `lifecycle-blocked/v1` 필드(`request`·`state`·`failedGuards`·
  `questions`·`resume`·`inspected`와 그 안 필드)만 허용한다. 검증 결과는 `[{ field, code }]`이고 code는 `unknown-field`·
  `missing-field`다. `renderBlockedMarkdown(block)`은 사람이 읽는 Markdown이다.
- `collectProjectInputs({ readFile, listFiles, layout })`는 workspace layout root(`config`·`product`·`policies`·
  `architecture`·`decisions`·`artifact-map`·`path-domains`)에서 산출물을 모은다. `상태` 줄이 있는 header의 문서는
  header로, 없으면(header 없음, `상태` 줄 없는 key 줄만 있음) 대응 기록 항목으로 본다. 정책 우선 검사의 `headerStatus`와
  같은 기준이다. PRD 개요는 제품 root의 `overview.md`, L1은 architecture root의 `README.md`, L2는 decisions root의
  `상태` 줄 있는 결정 기록(README 밖)과 대응 기록의 `l2:` 항목이다. 대응 기록 `l2:` 항목의 경로가 저장소 밖(절대 경로,
  `..`)이거나 `policy:` 항목 이름이 파일 이름 하나가 아니면(`/`·`\`, `.`으로 시작) 읽지 않고 입력 오류다. 정책 목록과 cross-cutting 대상(`level` `cross-cutting`)은 대응 기록의 `policy:` 항목과
  policies root 문서에서 읽는다. binding에 `config` root가 없으면 제품 root 대응을 config로 본다.
- CLI `node scripts/ci/lifecycle/lifecycle-state.mjs --repo <root> [--input <json>]`은 `lifecycle-state/v1` JSON을 낸다.
  입력에 `artifacts`가 없으면 `<root>`에서 모은다. 계산이 끝나면 상태와 무관하게 exit 0이고, `<root>`가 디렉터리가 아님,
  읽기·JSON parse 실패와 `LifecycleInputError`는 stderr 한 줄과 exit 2다.

## 정책 규칙 id 번호

규칙 id의 형식·접두어·인용은 [정책 README](../../policies/README.md#규칙-id와-인용)가 소유한다. acceptance·RED test·리뷰가
id로 규칙을 인용하므로 규칙을 지워도 그 번호를 다시 쓰지 않는다. 이 규칙을 보는 검사는 없다.

## 문서 상태 header

PRD·정책·L1·L2 문서는 제목 바로 아래 연속한 굵은 key 줄로 header를 갖는다.

| key         | 값                                                          |
| ----------- | ----------------------------------------------------------- |
| `상태`      | `draft`·`owner-confirmed`·`superseded`                      |
| `확인일`    | `owner-confirmed`일 때 Owner가 확인한 날짜(`YYYY-MM-DD`)    |
| `확인 근거` | Owner 확인 기록의 위치                                      |
| `근거`      | 상위 산출물 링크(PRD 개요는 없음). `R-UPSTREAM` 계산에 쓴다 |

- [`document-header.mjs`](../../../scripts/ci/lifecycle/document-header.mjs)의 `parseDocumentHeader`는 첫 `# ` 제목 다음 빈
  줄(0개 이상)을 건너뛴 뒤 연속한 `**key**:` 줄을 읽어 `{ status, confirmedOn, confirmationRef, basis, keys }`를 돌려주고,
  key 줄이 없으면 `null`이다. 같은 key가 여러 번이면 처음 값을 쓰고, `basis`는 `근거` 줄의 Markdown 링크 대상이다.
- `checkDocumentHeader(text, { requireBasis })`의 finding code는 넷이다. `header-missing`(header 줄 없음),
  `header-status-invalid`(`상태`가 세 값 밖이거나 없음), `header-confirmed-fields-missing`(`owner-confirmed`인데 `확인일`
  `YYYY-MM-DD`나 `확인 근거`가 없음), `header-basis-missing`(`requireBasis`인데 `근거` 링크가 없음. PRD 개요만 `false`).
- 정책 우선 검사의 `headerStatus`(`W-POLICY`가 정책 문서 header 상태를 읽음)는 같은 parser를 쓴다. `확인 근거`가 PR을
  가리키는지와 PR 본문 Owner 확인 줄의 대조는 이 검사 밖이다.
- header 검사는 gate가 아니다. 이 저장소 `docs/architecture`에는 `**상태**: Accepted / current`를 쓰는 문서가 있고, 그 값은
  세 값 밖이라 `header-status-invalid`다.
