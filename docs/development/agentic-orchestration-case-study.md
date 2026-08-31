# Repository-guided parent–subagent orchestration case study

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 `AGENTS.md`나 agent workflow를 대체하는 instruction owner가 아닙니다. 현재 실행 규칙은
> [Agent orchestration](./agent-workflows/orchestration.md)과 연결된 tracked contract가 소유합니다.

## 요약

KNU Roommate는 처음부터 multi-agent를 기본값으로 두지 않았습니다. 먼저 single-agent가 현재 request, code, contract,
test와 policy를 읽고 직접 구현·검증할 수 있는 repository harness를 만들었습니다. 이후 작업 규모가 커지면서 다음 문제가
분명해졌습니다.

- 사용자 개인 설정에 따라 child role·model·effort가 달라질 수 있었습니다.
- 요청 문구의 위험 단어와 실제 repository semantic complexity를 같은 축에서 판단했습니다.
- 독립 lane이 하나뿐인 경우를 배제하면서도, 반대로 여러 child의 shared write를 충분히 제한하지 못했습니다.
- 설치된 role이나 boolean capability만 보고 active runtime이 실제 model·effort를 제공한다고 오인할 수 있었습니다.
- exploration log와 중간 결과가 parent context를 오염시키는 문제를 줄이면서도 최종 판단은 한 곳에 남겨야 했습니다.

이를 해결하기 위해 repository는 **Repository-guided parent–subagent orchestration with adaptive child reasoning**을
구성했습니다. Parent의 XHigh/Max 선택은 사람과 현재 session에 남기고, repository는 Sol child의 Medium/High/XHigh만
현재 repository evidence로 판정합니다. Direct work는 child-free이며, 독립성과 순이익이 확인된 lane만 bounded child
contract가 됩니다. 이 contract는 자동 spawn engine이 아니고, 실제 dispatch 직전의 live runtime 확인과 leader의 최종
판단을 대신하지 않습니다.

## 권한과 evidence 경계

이 문서의 목적은 구현 경험을 설명하고 현재 evidence로 다시 검증할 수 있게 하는 것입니다.

- **Instruction authority:** `AGENTS.md`, `docs/development/agent-workflows/`, current code와 test
- **Human authority:** 제품·보안·법적 결정, provider/credential, 최종 UX, merge, production과 비용 수용
- **Agent responsibility:** bounded exploration, 공식 근거 조사, 구현, review, test와 evidence handoff
- **Evidence priority:** current tracked source/test → merged PR/commit → external engineering context
- **제외:** raw chat, 개인 설정, local artifact, 확인되지 않은 생산성·채용·운영 효과

## 이전 상태에서 확인한 문제

기준점은 PR #385 직전의 tracked tree와 그 당시 orchestration contract입니다. 아래 command는 개인 설정이나 local
artifact 없이 과거 Git tree에서 다시 실행할 수 있습니다.

```bash
git ls-tree -r --name-only e8624c65 .codex
git show e8624c65:docs/development/agent-workflows/orchestration.md
git show e8624c65:docs/development/agent-workflows/request-intake/delegation.md
```

| 확인한 상태                       | Engineering consequence                                                                                   | 재현 가능한 evidence                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| project `.codex`가 없음           | clone마다 user/global role·model·effort가 달라질 수 있고 repository가 같은 child baseline을 보장하지 못함 | 위 `git ls-tree`와 [.codex tracking 도입 PR #385](https://github.com/woohyun365/knu_roommate/pull/385)                                                                                                      |
| lookup은 Low                      | 큰 repository의 symbol 관계·owner 탐색도 lexical task kind만으로 낮은 effort에 고정될 수 있음             | [이전 orchestration contract](https://github.com/woohyun365/knu_roommate/blob/e8624c65e99e65da014f62be12d5c04f0bf90276/docs/development/agent-workflows/orchestration.md)                                   |
| 독립 lane 최소 2개 요구           | independently valuable lane 하나는 사용하지 못하고, count가 value보다 먼저 판단됨                         | [이전 delegation contract](https://github.com/woohyun365/knu_roommate/blob/e8624c65e99e65da014f62be12d5c04f0bf90276/docs/development/agent-workflows/request-intake/delegation.md)                          |
| architecture만 제한적 XHigh       | transaction·migration·lifecycle·trust boundary 같은 deep non-architecture work가 High에서 멈출 수 있음    | 같은 이전 delegation contract의 role/effort table                                                                                                                                                           |
| lexical risk와 complexity 결합    | “실패 시 위험함”과 “추론이 어려움”이 한 route에 섞여 keyword가 effort의 대리 신호가 됨                    | [routing contract 전환 PR #386](https://github.com/woohyun365/knu_roommate/pull/386)과 [routing regression](../../scripts/ci/routing-policy.test.mjs)                                                       |
| repository inspection 재평가 없음 | 같은 request라도 실제 transaction·contract·state evidence에 따라 effort를 다시 고를 구조가 없음           | [Pass 1/Pass 2 decision](./agent-workflows/agentic-architecture-decisions.md#da-009--child-reasoning은-repository-evidence로-두-번-판정)과 [same-request fixture](../../scripts/ci/routing-policy.test.mjs) |
| boolean 중심 runtime 판정         | 설치 파일이나 caller assertion을 active role/model/effort authority로 오인할 수 있음                      | [runtime evidence 전환 PR #387](https://github.com/woohyun365/knu_roommate/pull/387)과 [runtime capability fixture](../../scripts/ci/fixtures/runtime-capability-cases.json)                                |
| sequential route의 effort `null`  | child-free route의 값이 parent routing인지 “child를 선택하지 않음”인지 책임이 불분명함                    | [parent-effort isolation regression](../../scripts/ci/routing-policy.test.mjs)과 [current parent/child boundary](./agent-workflows/orchestration.md#reasoning-effort-routing)                               |
| prose와 runtime 경계 중복         | 여러 guide의 설명과 advisory code가 실제 spawn/lifecycle authority처럼 해석될 여지가 있음                 | [current delegation ownership boundary](./agent-workflows/request-intake/delegation.md#ownership-boundary)와 [runtime recovery contract](./agent-workflows/request-intake/orchestration-recovery.md)        |

“개인 설정 drift”는 특정 개인 파일의 내용을 durable evidence로 보존한다는 뜻이 아닙니다. Tracked project default가 없으면
clean clone이 user/global setup에 의존한다는 구조적 문제를 뜻합니다.

## 문제를 engineering system으로 재정의

목표는 “AI가 더 많은 코드를 쓰게 하기”가 아니었습니다. 다음 trade-off를 명시적으로 다루는 실행 환경을 만드는 것이었습니다.

1. **Portability:** clean clone도 같은 project role과 child default를 발견해야 합니다.
2. **Context budget:** 탐색·로그·외부 조사 중간 산출물을 parent conversation에 모두 쌓지 않습니다.
3. **Delegation cost:** child는 추가 token, latency, coordination 비용이 있으므로 direct path보다 이득일 때만 사용합니다.
4. **Write conflict:** parallel read는 허용해도 proactive write owner는 하나로 제한합니다.
5. **Runtime honesty:** config에 role이 있다는 사실과 현재 host가 그 role/model/effort를 제공한다는 사실을 구분합니다.
6. **Human authority:** model이 잘할 수 있는 일과 사람에게 남겨야 하는 결정을 별도로 판단합니다.

## Architecture label과 실제 mapping

외부 개념을 비교하기 위한 분석 표현은 다음과 같습니다.

> **Repository-aware hierarchical orchestrator–worker architecture with adaptive inference allocation**

이는 provider가 정의한 고유 제품명이나 이 repository가 그대로 구현한 표준 architecture name이 아닙니다. 다음 요소를
비교하기 위한 **synthesized analytical label**입니다.

| 분석 표현                     | Repository implementation                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Repository-aware              | current request → `AGENTS.md` → `TaskEnvelope` → `ContextPack` → current code/contract/test evidence                |
| Hierarchical                  | owner-facing parent가 child를 선택하고, child는 sibling이나 global plan을 지휘하지 않으며 결과는 leader-only fan-in |
| Orchestrator–worker           | parent의 model-mediated lane 선택과 Codex native child surface를 결합하지만 별도 scheduler를 구현하지 않음          |
| Adaptive inference allocation | parent는 사람이 XHigh/Max를 선택하고, repository는 Sol child에 한해 Pass 2 evidence로 Medium/High/XHigh를 선택      |

Repository canonical label을 더 좁게 정한 이유는 구현 범위를 정확히 드러내기 위해서입니다.

> **Repository-guided parent–subagent orchestration with adaptive child reasoning**

- “repository-guided”는 repository가 recommendation과 guard를 제공하지만 host runtime을 대체하지 않음을 나타냅니다.
- “parent–subagent”는 owner-facing parent가 user interaction과 synthesis authority를 유지함을 나타냅니다.
- “adaptive child reasoning”은 parent effort가 아니라 child effort만 evidence에 따라 달라짐을 나타냅니다.

## 선택한 구조

```text
human request and authority
  → parent session (manually selected XHigh or Max)
    → Pass 1: intent / authority / impact risk / candidate shape
      → direct-first gate
        ├── deterministic or dependent work → parent direct/sequential
        └── independent candidate lane
              → ContextPack and current repository inspection
                → Pass 2: source / fact / predicate evidence
                  → Sol child role + Medium / High / XHigh recommendation
                    → live runtime compatibility reconfirmation
                      ├── compatible → bounded dispatch
                      └── missing or mismatched → sequential fallback
                            → leader-only conflict resolution, verification, and response
```

### Risk와 reasoning complexity 분리

Impact risk는 실패했을 때의 피해와 필요한 사람의 authority를 나타냅니다. Reasoning complexity는 current repository
evidence를 이해하고 올바른 결론을 내리는 난이도입니다. 보안·production처럼 risk가 높은 작업도 단순 확인일 수 있고,
반대로 표면상 harmless한 refactor도 transaction·concurrency·lifecycle invariant 때문에 XHigh가 필요할 수 있습니다.

- Pass 1은 request의 intent, authority, impact risk와 candidate shape만 보존합니다.
- Pass 2는 current `ContextPack` source에 연결된 fact와 predicate를 검증합니다.
- 모든 boundedness evidence가 positive면 Medium, mandatory semantic signal 또는 deep composite면 XHigh, 그 외 substantial
  work는 High입니다.
- keyword, path, file count, LOC, task label만으로 XHigh를 선택하지 않습니다.

### Count와 write ownership

- 기본값은 0 child입니다.
- 독립적이고 가치 있는 lane 하나도 허용합니다.
- 일반 proactive recommendation은 최대 2개입니다.
- Pass 2 evidence에 연결된 high-value third lane만 3개까지 허용합니다.
- owner가 명시적으로 확장한 native/manual capacity는 최대 6개입니다.
- proactive write-capable child는 최대 하나이며 scope가 겹치면 sequential fallback입니다.

이 count는 “많을수록 좋다”는 성능 주장이 아닙니다. 현재 contract를 반박하는 품질·wall time·conflict evidence가 축적되면
재검토할 operational boundary입니다.

### Runtime truthfulness

Tracked `.codex`는 portable default와 role contract를 제공하지만 active authority를 만들지 않습니다. Dispatch 직전에는
current host surface가 보고한 role availability, effective Sol model, requested effort, explicit-effort support와 permission을
다시 확인합니다.

현재 runtime evidence는 `leader-reported-not-host-authenticated`입니다. 즉 repository validator가 typed input의 모순을
검사할 수는 있지만, provider가 서명한 immutable effective metadata는 아닙니다. 조금이라도 불일치하면 role을 prompt label로
가장하지 않고 direct/sequential로 돌아갑니다.

## 대안과 결정

| 대안                                            | 결정        | 근거                                                                                                         |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| user/global child config만 유지                 | 기각        | clean clone portability와 reviewable project role contract를 보장하지 못함                                   |
| project child default와 role만 추가             | 불충분      | lexical routing, count/write conflict, runtime truthfulness 문제를 해결하지 못함                             |
| 모든 lookup을 Low로 비용 최적화                 | 기각        | repository owner·contract 관계 탐색을 task label 하나로 축소함                                               |
| 최소 2개 또는 가능한 lane 전부 fan-out          | 기각        | 한 lane의 가치와 direct path를 배제하고 context·coordination 비용을 키움                                     |
| 0~2개, evidence-backed third, owner max 6       | 채택        | 독립성·semantic benefit과 native capacity를 분리하면서 한 개 child도 허용                                    |
| 여러 write-capable child                        | 기각        | shared contract와 owner conflict 비용이 병렬화 이득보다 큼                                                   |
| parent effort도 repository가 자동 선택          | 기각        | owner session 선택을 침범하고 XHigh/Max 사용 의도를 repository가 추측하게 됨                                 |
| Sol child + adaptive Medium/High/XHigh          | 채택        | model family는 고정하고 current semantic evidence만 reasoning allocation에 반영                              |
| boolean 또는 config 존재를 runtime proof로 사용 | 기각        | current host role/model/effort/permission과 다를 수 있음                                                     |
| reported evidence + live reconfirmation         | 조건부 채택 | 현재 surface에서 가능한 보수적 경계이며 immutable host-authenticated metadata가 생기면 교체                  |
| custom classifier/scheduler/lifecycle engine    | 기각        | Codex native lifecycle과 책임이 중복되고 모든 prompt를 deterministic하게 분류한다는 잘못된 확신을 만듦       |
| Ultra emulation 또는 autonomous factory         | 기각        | 목표는 parent autonomy 확대가 아니라 수동 XHigh/Max parent 아래 bounded child reasoning과 evidence hygiene임 |

## Decision lineage

설계는 한 번의 prompt에서 확정되지 않았습니다.

1. 독립적인 외부 GPT planning session을 critic으로 사용해 기존 routing contract를 당연한 전제로 받아들이는 circular review를
   피했습니다.
2. 그 분석은 two-pass reasoning, risk/complexity 분리, semantic predicate와 domain signal이라는 hypothesis를 제시했습니다.
3. 이후 owner directive가 repository-selected parent effort와 child Max/Ultra 방향을 명시적으로 폐기했습니다.
4. Retained design은 수동 XHigh/Max parent 아래 Sol child의 Medium/High/XHigh만 조절하도록 좁혀졌습니다.
5. 모든 hypothesis는 current repository source, test, owner directive, official documentation과 native smoke로 다시
   검증했습니다. Raw chat은 durable authority나 evidence로 사용하지 않습니다.

## 구현 chronology와 evidence

| Merge                                                                                                                                                                     | 구현 책임                                                                                                                                    | Tracked evidence                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PR #385](https://github.com/woohyun365/knu_roommate/pull/385) / [`6c9d1a52`](https://github.com/woohyun365/knu_roommate/commit/6c9d1a52153babb5bf4bf5f1b589691d7b5c17de) | project `.codex` allowlist, Sol/High child default, four bounded roles, parent config exclusion                                              | [.codex/config.toml](../../.codex/config.toml), [.codex/agents](../../.codex/agents), [project config contract](../../scripts/ci/project-codex-config.test.mjs), [tracking fixtures](../../scripts/ci/fixtures/project-codex-tracking-cases.json)                                                                |
| [PR #386](https://github.com/woohyun365/knu_roommate/pull/386) / [`fa819dca`](https://github.com/woohyun365/knu_roommate/commit/fa819dca9e6d8a5e35f0d20263e3cfb20204217e) | Pass 1/Pass 2 separation, semantic effort predicates, one-to-three proactive lanes, owner-directed six, one-writer recommendation            | [routing policy](../../scripts/agents/routing-policy.mjs), [child contract](../../scripts/agents/child-task-contract.mjs), [routing regression](../../scripts/ci/routing-policy.test.mjs), [child regression](../../scripts/ci/child-task-contract.test.mjs)                                                     |
| [PR #387](https://github.com/woohyun365/knu_roommate/pull/387) / [`24b74185`](https://github.com/woohyun365/knu_roommate/commit/24b74185913580365bf55f82efc0c90271b5f4e4) | bounded reported runtime evidence, model/effort/permission compatibility, live reconfirmation, one alternate recovery, leader-only synthesis | [orchestration policy](../../scripts/agents/orchestration-policy.mjs), [runtime fixtures](../../scripts/ci/fixtures/runtime-capability-cases.json), [orchestration regression](../../scripts/ci/orchestration-policy.test.mjs), [fresh-session regression](../../scripts/ci/agent-intake-fresh-session.test.mjs) |

각 PR은 product runtime을 바꾸지 않는 repository agent harness 변경입니다. PR 설명과 merge commit은 검증 command와 결과를
보존하며, 현재 behavior는 언제나 위 tracked source와 test를 다시 읽어 판정합니다.

## Verification에서 드러난 실패와 repair

초기 runtime compatibility 구현은 semantic reviewer에서 두 가지 gap이 발견되었습니다.

1. caller가 `workspace-edit`, `readOnly=false`, 빈 `writeOwnership`을 함께 보고하면 one-write limit을 우회할 수 있었습니다.
2. retired workflow name 검사가 Markdown/JavaScript만 보고 tracked role TOML instruction을 포함하지 않았습니다.

PR #387은 두 gap을 expected-red regression으로 고정한 뒤 fail-closed boundary와 tracked TOML scan을 보강했습니다. 최종
merge evidence는 targeted agent suite 49/49, repository policy 297/297, clean-clone suite 36/36과 selected Monorepo CI를
기록합니다. 숫자는 해당 merge 시점의 test inventory이며 보편적인 품질·생산성 비율을 의미하지 않습니다.

현재 checkout에서 최소 재검증은 다음과 같습니다.

```bash
node --test \
  scripts/ci/project-codex-config.test.mjs \
  scripts/ci/routing-policy.test.mjs \
  scripts/ci/child-task-contract.test.mjs \
  scripts/ci/orchestration-policy.test.mjs \
  scripts/ci/agent-intake-fresh-session.test.mjs
pnpm test:repo-policy
```

Native smoke는 current host/runtime가 필요한 live evidence입니다. 과거 smoke 결과를 새 session의 authority로 재사용하지
않고 dispatch 직전에 현재 surface를 다시 확인합니다.

## Human과 agent의 책임 분리

| Human owner                                                                | Parent agent                                                                                | Child agent                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 제품 정책, legal/privacy, provider/credential, 비용, 최종 UX, merge/deploy | request와 evidence 통합, direct/delegation 판단, conflict 해결, 최종 edit·verification·응답 | 하나의 bounded objective, 허용된 read/write scope, facts/inferences/gaps/verification handoff |

Child는 global plan, 최종 사용자 답변, 최종 architecture decision을 소유하지 않습니다. Parent의 결과도 사람의 production
authority를 대체하지 않습니다.

## Industry context

아래 자료는 이 repository의 현재 implementation authority가 아니라 설계 trade-off를 비판적으로 비교한 context입니다.

- [Toss — 개발자는 AI에게 대체될 것인가](https://toss.tech/article/will-ai-replace-developers): code production보다 system
  design, agent direction, verification, 그리고 무엇을 사람에게 남길지 결정하는 책임 변화를 논의합니다.
- [MUSINSA — The Philosophy: AI Native Hiring](https://techblog.musinsa.com/the-philosophy-ai-native-hiring-c002c2775b3a): AI 사용
  금지보다 problem definition, ambiguity handling, executable outcome과 제출물의 testability를 평가하는 관점을 제시합니다.
- [OpenAI — A practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/):
  single agent의 capability를 먼저 확장하고, central manager가 user interaction과 synthesis를 유지해야 하는 경우의 manager
  pattern과 guardrail을 설명합니다.
- [OpenAI Codex — Subagents](https://developers.openai.com/codex/subagents): read-heavy independent work의 parallelization,
  context pollution 감소, write-heavy conflict 주의, per-agent model/reasoning configuration을 설명합니다.
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents): 가장 단순한 해법에서
  시작하고, input에 따라 subtask가 달라지는 복잡한 작업에 orchestrator-workers를 적용하되 latency/cost trade-off를
  고려합니다.
- [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):
  context curation과 focused subagent가 상세 탐색을 격리하고 parent에는 distilled summary를 반환하는 구조를 설명합니다.

이 자료가 이 repository 설계를 보증하거나 각 회사의 보편적 채용 기준을 의미하지는 않습니다.

## Interview evidence map

다음 질문은 암기할 답변이 아니라 current source와 Git history를 다시 읽기 위한 entry입니다.

| 질문                                                                                | 먼저 확인할 evidence                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 왜 single-agent harness 이후에 multi-agent를 도입했는가?                            | [Agentic Engineering methodology](./agentic-engineering-methodology.md), [orchestration direct-first gate](./agent-workflows/orchestration.md)                                                |
| 왜 direct-first와 benefit-gated delegation인가?                                     | [DA-001~003](./agent-workflows/agentic-architecture-decisions.md), [delegation single-first gate](./agent-workflows/request-intake/delegation.md)                                             |
| impact risk와 reasoning complexity를 왜 분리했는가?                                 | [DA-009](./agent-workflows/agentic-architecture-decisions.md#da-009--child-reasoning은-repository-evidence로-두-번-판정), [routing regression](../../scripts/ci/routing-policy.test.mjs)      |
| architecture가 아닌 transaction·migration·lifecycle·trust work도 왜 XHigh가 되는가? | [semantic predicates](../../scripts/agents/routing-policy.mjs), [deep non-architecture fixtures](../../scripts/ci/routing-policy.test.mjs)                                                    |
| parent는 왜 수동 XHigh/Max이고 child만 adaptive한가?                                | [.codex parent exclusion test](../../scripts/ci/project-codex-config.test.mjs), [reasoning effort routing](./agent-workflows/orchestration.md#reasoning-effort-routing)                       |
| model·effort·count·write ownership을 어떻게 통제했는가?                             | [.codex config](../../.codex/config.toml), [delegation contract](./agent-workflows/request-intake/delegation.md), [runtime fixture](../../scripts/ci/fixtures/runtime-capability-cases.json)  |
| hallucinated role/capability claim을 어떻게 막았는가?                               | [reported runtime evidence](./agent-workflows/request-intake/orchestration-recovery.md#reported-runtime-evidence), [orchestration regression](../../scripts/ci/orchestration-policy.test.mjs) |
| context pollution과 delegation cost를 어떻게 제한했는가?                            | direct-first, bounded lane, facts/inferences/gaps output, leader-only fan-in contract                                                                                                         |
| 무엇이 실패했고 어떻게 고쳤는가?                                                    | [PR #387 review/repair history](https://github.com/woohyun365/knu_roommate/pull/387), caller-expanded write boundary와 TOML regression                                                        |
| 무엇을 의도적으로 자동화하지 않았는가?                                              | custom scheduler/classifier, child lifecycle engine, automatic parent effort, merge/deploy authority 기각 표                                                                                  |
| 어떤 evidence가 redesign을 촉발하는가?                                              | 아래 limitation과 [DA-009~012 revisit triggers](./agent-workflows/agentic-architecture-decisions.md)                                                                                          |

## 한계와 재검토 조건

- Comparable task cohort에 대한 productivity, quality, token, latency 개선률은 아직 측정하지 않았습니다.
- Provider가 인증한 immutable effective model/effort metadata는 현재 repository가 보유하지 않습니다.
- Native surface나 Codex config schema가 바뀌면 role/model/effort evidence contract를 다시 검증합니다.
- Sol allowance, cost 또는 latency가 현재 child tier를 반박하면 model/effort allocation을 fresh evidence로 재설계합니다.
- count별 품질·wall time·conflict 측정이 지속적으로 다른 boundary를 지지하면 0~3 proactive limit을 재검토합니다.
- durable mailbox, long-lived task ownership, operator-visible coordination이 필요해질 때만 Team/tmux runtime을 별도 검토합니다.
- 자동 fan-out, deterministic prompt classifier, 무제한 retry/reallocation과 autonomous merge/deploy는 현재 목표가 아닙니다.
- 실제 사용자·production impact는 향후 운영 evidence 없이는 주장하지 않습니다.

마지막 검토일: 2026-08-31
