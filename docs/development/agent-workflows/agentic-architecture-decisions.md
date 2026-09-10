# Agentic architecture decisions

- 상태: accepted
- 결정일: 2026-08-13
- 범위: repository-local coding agent harness

이 문서는 특정 세션이나 모델의 취향이 아니라, 새 개발자와 coding agent가 같은 evidence·권한·완료 기준으로
수렴하도록 하는 결정을 소유합니다. 외부 benchmark 수치는 해당 실험 범위에만 적용하며 repository의 보편 법칙으로
해석하지 않습니다.

## Decision schema

각 결정은 문제, 근거, 결정, trigger/non-trigger, 기각 대안, 구현 영향, 검증, 재검토 조건을 포함합니다. 근거가
바뀌면 기존 결정을 덮어쓰지 않고 `superseded` 상태와 대체 Decision ID를 기록합니다.

## DA-001 — Deterministic-first, single-agent default

- **문제**: 모든 작업을 agent 토론이나 병렬 실행으로 처리하면 지연·context·충돌 비용이 증가합니다.
- **근거**: Anthropic과 OpenAI는 가장 단순한 구성에서 시작하고 tool이 해결할 수 있는 작업은 결정론적으로 처리할
  것을 권장합니다.
- **결정**: formatter, search, schema check, typecheck, test는 tool 결과를 우선하며 한 owner 작업은 single agent가
  기본입니다.
- **Trigger**: 독립적인 evidence lane이나 파일 ownership이 있을 때만 병렬화를 검토합니다.
- **기각**: 항상 multi-agent 사용 — sequential dependency에서 중복과 충돌을 키웁니다.
- **검증**: single-domain fixture에서 불필요한 child가 생성되지 않아야 합니다.
- **재검토**: 동일 작업군에서 반복적으로 context 한계나 처리량 병목이 측정될 때입니다.

## DA-002 — Sequential dependency와 parallel evidence lane 분리

- **문제**: policy→contract→implementation처럼 앞 결과가 다음 입력인 작업을 병렬화하면 서로 다른 가정을 만듭니다.
- **결정**: dependency chain은 순차 실행하고, repo mapping·외부 조사·독립 위험 분석만 fan-out합니다.
- **기각**: Phase 단위 무조건 병렬화 — 결과 통합 전에 전제가 갈라집니다.
- **검증**: child scope에 dependency와 stop condition이 명시되어야 합니다.

## DA-003 — Centralized leader synthesis와 one-write-owner

- **문제**: 여러 agent가 같은 파일이나 최종 계획을 수정하면 evidence와 결정의 owner가 흐려집니다.
- **결정**: child는 bounded evidence를 반환하고 leader가 충돌을 해결해 하나의 결과를 소유합니다. 쓰기 작업은 파일별
  owner를 하나로 둡니다.
- **기각**: child 결과 다수결 — 같은 근거와 모델의 반복은 독립 검증이 아닙니다.
- **검증**: 최종 결과에 source, inference, confidence와 충돌 해결이 보존되어야 합니다.

## DA-004 — Environment outcome 기반 completion

- **문제**: agent의 완료 선언이나 plan checkbox는 실제 동작을 증명하지 못합니다.
- **결정**: file state, git diff, test, build, service response 같은 environment outcome으로 완료를 판정합니다.
- **기각**: self-certified completion — false positive를 막지 못합니다.
- **검증**: 최종 보고에 실행한 명령과 읽은 결과 또는 명시적 검증 공백이 있어야 합니다.

## DA-005 — Progressive disclosure와 bounded context

- **문제**: 모든 policy·finished plan·transcript를 항상 주입하면 중요한 제약이 희석됩니다.
- **결정**: `AGENTS.md`에는 불변 규칙만 두고 task-specific guide는 필요할 때만 읽습니다. checkpoint는 pointer와
  bounded state만 보존합니다.
- **기각**: mega-prompt와 context stuffing — freshness와 source ownership을 흐립니다.
- **검증**: root guidance는 200줄·32KiB 이내이며 checkpoint에 transcript가 없어야 합니다.

## DA-006 — 명확한 tool namespace, schema, high-signal response

- **문제**: 겹치는 tool 이름과 큰 비정형 응답은 잘못된 호출과 context 낭비를 늘립니다.
- **결정**: tool은 owner/action이 드러나는 이름, 좁은 입력 schema, bounded 결과와 명확한 side-effect 경계를 가집니다.
- **기각**: tool buffet — 역할이 겹치는 도구를 항상 노출하지 않습니다.
- **검증**: destructive/open-world action은 권한 경계가 있고 결과는 필요한 evidence만 반환해야 합니다.

## DA-007 — Model reviewer는 defense-in-depth의 보조 계층

- **문제**: reviewer agent도 같은 오류나 prompt injection을 놓칠 수 있습니다.
- **결정**: reviewer는 static rule, type/contract, transaction guard, sandbox, approval, test 위에 추가하는 보조 검증입니다.
- **기각**: LLM-only guardrail — 실제 side effect를 제한하지 못합니다.
- **검증**: 고위험 invariant는 model 판단 밖의 deterministic control을 가져야 합니다.

## DA-008 — High-risk action은 authority gate 적용

- **문제**: credential, production, destructive, irreversible action은 잘못 실행했을 때 복구 비용이 큽니다.
- **결정**: 해당 action은 명시적 사용자 권한과 readiness/evidence를 확인하며, 그 외 reversible local 작업은 자동
  진행합니다.
- **기각**: 모든 작업 확인 요청 또는 모든 작업 자동 실행 — 각각 처리량과 안전성을 해칩니다.
- **검증**: external-production과 secret action은 실행 전에 authority가 기록되어야 합니다.

## DA-009 — Child reasoning은 repository evidence로 두 번 판정

- **문제**: task label·요청 keyword·lexical risk만으로 effort를 고르면 실제 transaction, migration, public contract,
  trust boundary 복잡도를 놓치거나 단순 lookup을 불필요하게 child로 보낼 수 있습니다.
- **결정**: Pass 1은 intent·authority·impact risk·candidate shape만 분류하고, Pass 2가 current ContextPack의 정규화된
  source/fact/predicate evidence로 child role과 `medium | high | xhigh`를 최종 판정합니다. Medium은 모든 boundedness
  조건의 positive evidence가 있을 때만, XHigh는 mandatory semantic signal 또는 structural deep composite가 있을 때만
  선택하며 나머지 substantial work는 High입니다. Child는 GPT-6 Astra만 사용하고 parent XHigh/Max는 사용자가 session에서
  선택합니다.
- **기각**: lookup Low, taskKind/risk shortcut, leader effort의 무조건 상속, keyword/path/file-count/LOC 기반 XHigh,
  repository가 parent effort를 추천하는 방식.
- **검증**: stable source/fact/evidence binding, duplicate fact amplification 방지, same-request/different-evidence fixture,
  child effort allowlist, parent-effort isolation을 검사합니다.

## DA-010 — Developer request와 agent obligation 분리

- **문제**: 사람에게 필요한 요청 예시와 agent가 따라야 할 실행 schema를 한 문서에 섞으면 양쪽 모두 읽기 어렵습니다.
- **결정**: `getting-started.md`는 사람용 예시, `agent-execution-contract.md`는 agent 의무를 소유하고 canonical rule을
  링크합니다.
- **기각**: 도구별 instruction 사본 — 서로 다른 agent에서 drift가 발생합니다.
- **검증**: Codex 자동 discovery와 generic bootstrap prompt가 같은 authority와 acceptance로 수렴해야 합니다.

## DA-011 — Child 수는 독립성과 semantic benefit으로 제한

- **문제**: child 수를 최소 2개처럼 고정하거나 가능한 lane을 모두 fan-out하면 단일 evidence lane도 배제하거나 context·충돌
  비용을 불필요하게 키웁니다.
- **결정**: 기본 child 수는 0이며 독립적인 bounded lane 하나도 허용합니다. Proactive 경로는 보통 최대 2개이고 current
  Pass 2 evidence에 직접 연결된 high-value benefit이 있을 때만 세 번째를 허용합니다. Owner가 명시적으로 확장해도 hard
  cap은 6이며 write-capable child는 하나만 선택합니다.
- **Trigger**: 결과 dependency와 write scope가 분리되고 completeness·latency·specialist evidence·risk review 순이익이
  검증된 lane입니다.
- **기각**: minimum-two, more-agents-is-better, shared-write fan-out, 모든 작업에 execution graph 생성.
- **검증**: zero/one/two/evidence-backed-three/owner-directed-six와 one-write fixture를 검사합니다.
- **재검토**: 실제 품질·walltime·conflict 측정이 다른 count boundary를 지속적으로 지지할 때입니다.

## DA-012 — Active runtime은 reported evidence와 live reconfirmation으로 판정

- **문제**: tracked role TOML이나 user config가 존재해도 현재 native/OMX dispatch surface가 그 role·model·effort를 실제로
  제공한다는 뜻은 아닙니다.
- **결정**: Native는 current-turn host tool schema, OMX는 current-session runtime overlay와 host-exposed role roster를
  bounded evidence로 사용합니다. GPT-6 Astra와 `medium | high | xhigh`, role availability, effective effort, explicit-effort support,
  dispatch permission이 모두 맞아야 descriptor를 추천합니다. Evidence는 leader-reported이며 host-authenticated authority로
  표현하지 않고 실제 호출 직전에 leader가 다시 확인합니다.
- **Trigger**: validated delegation을 existing native child surface로 전달하려는 순간입니다.
- **기각**: boolean capability assertion, local config inspection만으로 active authority 주장, generic role prompt label,
  stale session metadata 재사용.
- **검증**: Native/OMX success, Luna/Low, Terra, fixed-effort conflict, unavailable role, stale/unknown provenance와 permission
  fallback fixture를 검사합니다.
- **재검토**: host가 직접 인증된 immutable runtime capability token이나 동등한 dispatch contract를 제공할 때입니다.

## Evidence inventory

- [OpenAI Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md)
- [OpenAI Codex best practices](https://learn.chatgpt.com/guides/best-practices.md)
- [OpenAI practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)
- [OpenAI running Codex safely](https://openai.com/index/running-codex-safely/)
- [Anthropic building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Google Research scaling agent systems](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)
- [Google DeepMind AI agent security](https://deepmind.google/blog/securing-the-future-of-ai-agents/)

외부 자료는 원칙의 근거이며 repository code, test, policy보다 높은 현재 구현 권한을 갖지 않습니다.

## Decision traceability

각 Decision의 짧은 본문은 읽기 흐름을 유지하고, 구현 영향과 재검토 기준은 아래 표에서 빠짐없이 추적합니다.

| ID     | 근거                                                       | Trigger / non-trigger                                                       | 구현 영향                                        | 재검토 조건                                                         |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| DA-001 | OpenAI practical guide, Anthropic effective agents         | 독립 lane이 있을 때만 병렬화 / 단일 owner·결정론적 작업은 직접 수행         | direct-first routing과 child 생성 억제           | 반복 측정된 context·처리량 병목                                     |
| DA-002 | Google scaling agent systems, Anthropic effective agents   | 독립 evidence lane / dependency chain                                       | sequential dependency, bounded fan-out           | 병렬 결과가 충돌 없이 지속적으로 더 나은 evidence를 만들 때         |
| DA-003 | OpenAI practical guide, Anthropic context engineering      | 파일 owner가 겹치지 않을 때 / shared write owner가 필요할 때                | leader synthesis와 one-write-owner               | 분산 merge가 더 낮은 충돌률로 검증될 때                             |
| DA-004 | Anthropic demystifying evals, OpenAI best practices        | 검증 가능한 environment outcome / self report만 존재                        | command·test·diff 기반 완료 판정                 | 더 강한 자동 acceptance surface가 생길 때                           |
| DA-005 | Anthropic context engineering                              | task-specific 정보가 필요할 때만 load / transcript 전체 주입 금지           | bounded checkpoint와 progressive disclosure      | startup context가 필수 규칙을 누락하거나 budget을 초과할 때         |
| DA-006 | Anthropic writing tools, OpenAI agent guide                | 명확한 owner/action/schema / 중복 tool buffet                               | 좁은 tool contract와 bounded output              | tool 선택 오류나 context 비용이 다시 증가할 때                      |
| DA-007 | DeepMind agent security, OpenAI running Codex safely       | deterministic guard 위 reviewer / reviewer-only guard 금지                  | static·type·sandbox·test 우선                    | model verifier가 독립적 강제력을 제공할 때                          |
| DA-008 | DeepMind agent security, OpenAI running Codex safely       | destructive·credential·production action / reversible local work            | authority gate와 safe auto-continue              | 권한 또는 rollback model이 바뀔 때                                  |
| DA-009 | Google scaling agent systems, repository semantic evidence | Pass 1 intent/risk 뒤 current evidence Pass 2 / label·keyword shortcut 금지 | child-only two-pass routing과 normalized fixture | 실제 품질·비용 측정 또는 native runtime contract가 tier를 반박할 때 |
| DA-010 | OpenAI AGENTS.md, repository onboarding evidence           | 사람 요청 예시와 agent 의무가 모두 필요 / tool별 규칙 복제 금지             | getting-started와 execution contract 분리        | generic agent가 동일 authority로 수렴하지 못할 때                   |
| DA-011 | Google scaling agent systems, repository lane evidence     | 독립·bounded·positive-benefit lane / dependency·shared write                | adaptive bounded fan-out과 one-write limit       | count별 품질·walltime·conflict 실측이 현재 경계를 반박할 때         |
| DA-012 | OpenAI native surface, OMX runtime, repository smoke       | dispatch 직전 fresh reported evidence / config·과거 session만 존재          | dual-runtime compatibility와 sequential fallback | host-authenticated runtime capability contract가 제공될 때          |
