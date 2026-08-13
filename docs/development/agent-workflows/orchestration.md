# Agent orchestration

이 저장소의 기본 경로는 **single agent with deterministic tools**입니다. 여러 agent는 독립성과 검증 가능한 순이익이
있을 때만 사용합니다. 근거와 결정은 [Agentic architecture decisions](./agentic-architecture-decisions.md)을 따릅니다.

## Pattern selector

| 작업 형태                                         | 기본 pattern                 |
| ------------------------------------------------- | ---------------------------- |
| search, formatter, schema, typecheck, test        | deterministic tool           |
| 한 owner, 단일 dependency chain                   | single agent                 |
| policy→contract→test→implementation               | sequential workflow          |
| 독립 repo mapping, external research, risk review | centralized fan-out/fan-in   |
| objective rubric가 있는 고위험 결과               | maker-checker, 기본 최대 2회 |
| destructive, credential, external production      | human/authority gate         |

Agent 수 자체를 품질 지표로 사용하지 않습니다. sequential task, shared-file write, vague scope는 병렬화하지 않습니다.

## Child contract

Machine-checkable recommendation contract는
[Independent lane and child task contract](./request-intake/delegation.md)를 따릅니다. 이 문서의 orchestration 규칙을
실행 engine으로 복제하지 않으며, `scripts/agents/child-task-contract.mjs`도 child를 직접 생성하지 않습니다.

Child task에는 다음을 포함합니다.

```text
objective / non-goals
read scope / write ownership
required evidence
expected output schema
stop condition / escalation condition
```

Child는 전역 plan을 다시 작성하거나 다른 owner의 파일을 수정하지 않습니다. 결과에는 확인된 사실의 file/URL,
추론, confidence, blocker를 구분합니다. Leader는 결과 충돌을 해결하고 최종 edit·verification·completion을 소유합니다.

## Reasoning effort routing

| lane                                                       | 기본 effort                    |
| ---------------------------------------------------------- | ------------------------------ |
| file/symbol lookup, inventory                              | low                            |
| bounded implementation                                     | medium                         |
| test/fixture design                                        | medium; 고위험 contract는 high |
| official external research                                 | high                           |
| verifier 또는 adversarial critic                           | high                           |
| security, concurrency, irreversible migration architecture | high 또는 xhigh                |

- native role metadata가 있으면 가장 구체적인 installed role을 사용하고 effort를 중복 지정하지 않습니다.
- role routing을 지원하지 않으면 역할을 prompt label로 가장하지 않고 single/sequential fallback을 사용합니다.
- `max/ultra`는 일반 planning·implementation route에 사용하지 않습니다.
- leader가 high/xhigh여도 모든 child가 이를 무조건 상속하지 않습니다.

## Skill과 workflow routing

- read-only 원인/책임 분석: `$analyze`
- 공식 최신 근거 조사: `$best-practice-research`
- 요구가 모호하고 가정 금지: `$deep-interview`
- architecture/test 합의가 필요한 계획: `$ralplan`
- 한 owner 구현: solo 또는 executor
- 독립 구현 lane과 shared coordination: 실제 OMX runtime의 `$team`
- long-running single-owner completion: `$ralph`
- hostile E2E/회귀: `$ultraqa`
- cleanup: 계획과 회귀 보호 뒤 `$ai-slop-cleaner`
- UI source of truth: `$design`; reference 기반 반복은 `$visual-ralph`

Runtime이 없는 surface에서 team/ralph/ultrawork를 이름만 흉내 내지 않습니다.

## Figma provider 도입 경계

상세 visual capability 계약은 [Visual design workflow](./visual-design/README.md)를 읽습니다.

1. tracked `DESIGN.md`가 있으면 이를 먼저 사용하고, 없으면 Storybook, 현재 component/token과 repository workflow를
   source of truth로 사용합니다. untracked local `DESIGN.md`는 참고 입력일 뿐 clean clone의 필수 권한이 아닙니다.
2. 실제 Figma file/frame이 source of truth일 때만 Official Figma MCP를 user-level opt-in으로 검토합니다.
3. credential은 repository나 example file에 저장하지 않습니다.
4. Figma MCP는 승인된 frame/component/variable을 읽는 evidence bridge이며 product policy나 mutation 권한을 만들지
   않습니다.
5. provider 장애나 연결 해제 뒤에도 기존 Storybook·design·verification 경로는 동작해야 합니다.

Provider output은 증거이며 product policy와 repository design contract를 자동으로 덮지 않습니다.

## Cross-domain 예시

Legal 정책과 FE/BE를 함께 바꾸는 작업은 정책 결정을 먼저 고정한 뒤 contract/API와 UI를 순차 연결해야 합니다.
다만 기존 정책·API·UI mapping과 외부 법적 근거 조사는 서로 독립이면 read-only lane으로 나눌 수 있습니다. Leader는
근거를 합쳐 하나의 dependency-ordered plan을 만들고, 구현 단계에서는 shared contract와 파일 owner가 겹치지 않게
순서를 정합니다.

## Anti-patterns

- more-agents-is-better
- sequential dependency를 억지로 fan-out
- 모든 tool·policy·transcript를 모든 child에 broadcast
- vague delegation과 shared write ownership
- agent 완료 선언을 evidence로 사용
- model reviewer 하나에 security와 권한 경계를 의존
- 동일 실패 원인으로 무제한 retry/reflection
- benchmark 숫자를 repository의 보편 법칙으로 사용

## Completion gate

Fan-in 이후 leader는 source 누락, conflicting inference, unresolved high-risk decision, changed file ownership과 실제
verification을 확인합니다. Blocking finding이 남으면 완료로 판정하지 않습니다.

Machine-checkable native dispatch, one-alternate recovery와 synthesis input validation은
[Bounded orchestration, recovery, and leader synthesis](./request-intake/orchestration-recovery.md)를 따릅니다. 이
policy는 child lifecycle을 실행하지 않으며 최종 completion authority를 갖지 않습니다.
