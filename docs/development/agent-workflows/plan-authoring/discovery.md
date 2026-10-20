# Discovery: 제품 설계·계획의 결정 확인

제품(FE·BFF·BE·DB·infra)을 설계·계획할 때 빈 결정을 추측으로 채우지 않도록, domain pack의 결정 목록에서 저장소로 확인할 것과
사용자에게 물을 것을 가르고 그 결과를 기록하는 절차입니다. Agent workflow·문서 계획은 이 흐름을 쓰지 않고 기존
[ambiguity disposition](../request-intake/ambiguity-and-authority.md)만 씁니다.

두 host의 workflow entry는 plan 요청에서 제품 primary guide([Frontend](./frontend.md)·[Backend](./backend.md)·
[Infrastructure](./infrastructure.md))가 골라지면 이 문서를 조건부 읽기(`plan-product-domain`)로 냅니다. 결과는
[Core](./core.md)의 Decision 절(§5)과 readiness gate(§7)가 받습니다.

## 질문 공간

- `node scripts/agents/common/discovery-questions.mjs --sublayer <하위 layer id>`가
  [Domain/SWE/Web pack](../domain/swe-web/README.md)의 결정 목록을 working tree에서 읽어 JSON으로 냅니다. 하위 layer id는
  `Domain/SWE/Web/FE/rendering-boundary` 형식이고, 생략하면 모든 하위 layer를 냅니다.
  - 결정마다 수준·질문·선택지·먼저 정할 결정·되돌림·기본값·확인 단서·기준 항목과 pack 규칙으로 계산한 `irreversible`
  - `order`: 먼저 정할 결정이 앞에 오는 순서. `outsidePrerequisites`: 고른 하위 layer 밖에서 먼저 정할 결정
  - `--skeleton`: 아래 결정 기록의 항목 골격(Markdown)
- 질문은 이 목록에서 고릅니다. 목록에 없는 결정은 기록에 `pack 결정: 없음`과 gap으로 표시하고 질문을 지어내지 않습니다.
- Helper는 결정 기록 본문을 읽지 않고 파일을 쓰지 않습니다. Pack이 형식에 맞지 않으면(모르는 하위 layer·먼저 정할 결정,
  순환, 필드 누락, 세 값 밖의 되돌림, `### 위험`이나 그 `비가역 선택` 줄의 누락·형식 오류) 실패합니다.

## 판정

결정마다 아래 표에서 처음 맞는 판정을 고르고, 근거(영향·불확실성·비가역성·되돌리는 비용)를 기록합니다. 마지막 행이 있어 모든
결정이 한 행에 맞습니다.

| 순서 | 판정     | 조건                                                                                                | 결정 상태                                    | 기존 disposition                                |
| ---- | -------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| 1    | Inspect  | 저장소(code·owner 문서·결정 기록·guard test)로 확인된다                                             | `known`                                      | `safe-read-only-first`                          |
| 2    | Defer    | 이 작업의 acceptance·구현이 고정하지 않는다(guard 입력이 아니다)                                    | `deferred`(재검토 조건)                      | `plan-oq`, 배포 값은 `release-evidence-handoff` |
| 3    | Escalate | pack 규칙의 비가역이거나 고위험 trigger에 걸린다                                                    | 확인 전 `unknown`, Owner 확인 뒤 `validated` | `clarify-now`                                   |
| 4    | Ask      | 사용자만 아는 의도(목적·대상·범위·성공 기준·정책 값)이거나, pack 규칙의 비가역이 아닌 `costly` 결정 | 답 뒤 `validated`                            | `clarify-now` 또는 `plan-oq`                    |
| 5    | Infer    | `easy`이고 pack `기본값` 필드의 "그 기본값을 버려야 하는 경우"에 걸리지 않는다                      | `provisional`(재검토 조건)                   | —                                               |
| 6    | Ask      | 앞 행에 맞지 않는다(기본값을 버릴 경우에 걸린 `easy` 등)                                            | 답 뒤 `validated`                            | `clarify-now` 또는 `plan-oq`                    |

- Pack 규칙의 비가역: 되돌림이 `one-way`이거나, `costly`이면서 다른 결정이 먼저 정할 결정으로 가리키는 결정입니다
  ([결정 목록 형식](../domain/swe-web/README.md#결정-목록-형식)). Helper의 `irreversible`이 이 계산이고, pack 밖 결정은 plan이
  비가역 여부를 적습니다.
- 고위험 trigger: 실제 돈의 이동·거래(결제, 매매, 송금), 규제 산업(금융·의료·교육 기록 등), 법적 책임·약관(외부 브로커·API 약관 포함),
  생명·안전, 민감 개인정보, 미성년자. 걸리면 "전문가·외부 확인 필요"를 표시하고 Owner 답을 법률·규제 판단으로 기록하지 않습니다.
- Defer는 이 작업이 고정하지 않는 결정에만 쓰고 재검토 조건을 남깁니다. Readiness 리뷰가 Defer 항목을 plan acceptance·구현
  범위와 대조하므로, 이 작업이 고정하는 비가역 결정은 Escalate로 갑니다.
- Repo-based 저장소는 Inspect를 먼저 모든 항목에 돌린 뒤 남은 항목만 다음 행으로 보냅니다. Fresh 저장소는 `order` 순서로
  따라가며 같은 표를 씁니다.

## 질문 형식

- 질문마다 쉬운 말 설명, 권장 기본값과 이유, 되돌릴 수 있는지를 보입니다. 질문 도구 경로는 선택지별 trade-off를 보이고 의존
  순서 앞에서 3개까지 묶습니다. Host별 수단은 [Claude Code](../adapters/claude-code.md#사용자-질문-수단)와
  [Codex](../adapters/codex.md#사용자-질문-수단) adapter가 정합니다.
- "모르겠다"는 권장 기본값을 `provisional`로 기록하고 재검토 조건을 남깁니다. 그 결정이 비가역이면 아래 gate가 승격을 막습니다.
- 정책 질문은 코드가 아니라 쉬운 말 규칙 초안을 한 줄씩 보이고 "이대로 둘까요?"로 묻습니다. 규칙마다 바뀌면 영향받는 것(예:
  데이터 보유 → DB schema)을 한 구절 붙이고, 고위험 trigger에 걸린 규칙은 "전문가·외부 확인 필요"를 붙입니다. 답은 정책 문서의
  규칙 id로 들어갑니다.

## 의도 확인 루프

질문 → 작업 단위 intent·plan 초안 → 쉬운 말로 되돌려 보이기 → 사용자 review를 모호한 지점이 남지 않을 때까지 반복합니다. 회차
수는 질문 기록에 남깁니다.

## 기록

| 기록                   | 위치                                                                                      | 형식                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 결정                   | `docs/architecture/decisions/<layer>.md`                                                  | [Decision records](../../../architecture/decisions/README.md)             |
| 프로젝트 intent        | `docs/product/intent.md`                                                                  | [Product documents의 intent 기록](../../../product/README.md#intent-기록) |
| 질문·답 원문과 판정 표 | 작업 계획 증거의 `discovery/`(`.artifacts/plans/<umbrella>/<bounded>/<phase>/discovery/`) | 원문 그대로. 추적하지 않습니다                                            |

- 추적 문서는 질문·답 원문 경로를 근거 링크로 쓰지 않습니다(`AGENTS.md` §5).
- 제품 plan은 이 작업이 정한 결정(pack 결정 id·판정·상태·고른 선택지·Owner 확인 출처)을 Decision 절에 담습니다. PR이 그 결정을
  결정 기록으로 옮기고, 이미 기록에 있는 결정(Inspect → `known`)은 id로만 인용합니다([Core §5](./core.md#decision)).

## 비가역 확인 gate

Plan이 고정하는 비가역 결정마다 Owner 명시 확인(질문 도구 답 또는 사용자 입력 원문)이 있고 상태가 `validated`여야 승격합니다
([Core §7](./core.md#7-implementation-readiness-promotion) 10번째 항목). Readiness reviewer는 plan Decision 절을 validator 입력
`decisions[]`로 옮깁니다. 비가역이 아닌 고위험 trigger Escalate 항목과 답을 기다리는 `clarify-now` Ask 항목은 `decisions[]`가
아니라 `openQuestions`(`blocking: true`, `status: open`)로 옮깁니다.

## 다음 작업에서 읽기

설계·계획·구현·리뷰 단계는 바뀌는 하위 layer의 결정 기록과 intent 영역 절을 입력으로 읽습니다.

## Enforcement

- `deterministic-static`: validator의 `decisions` 판정, helper 출력과 pack 일관성 test, workflow entry의 조건부 읽기
  (`scripts/agents/common/`과 그 test)
- `model-mediated`: plan을 `decisions[]`로 옮기기, 판정 선택, 질문 형식, 의도 확인 루프(readiness reviewer·Parent)
- `native-runtime`: 질문 도구의 대기와 선택지 표시(host)
- `advisory-policy`: 이 문서
