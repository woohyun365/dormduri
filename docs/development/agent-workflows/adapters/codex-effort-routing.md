# Codex effort routing

[Codex adapter](./codex.md)의 `## Reasoning effort routing` 세부입니다. Parent-high 운영과 quality stop은 진입 문서가
소유합니다.

## Effort routing 세부

Reasoning routing은 Parent와 child를 분리합니다. Parent effort는 사용자가 session에서 선택하며 repository는 Parent
effort를 계산하거나 변경했다고 보고하지 않습니다. 사용자가 고른 Parent model은 multi-agent 엔진도 정합니다(catalog v2 model은 V2,
`gpt-5.6-luna` 같은 catalog v1 model은 V1). 위임은 V2 Parent에서만 되며 project hook이 로드된 세션에서는 V1 root의 spawn을 [hook guard](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)가 막습니다.

1. Pass 1은 intent, authority, impact risk, candidate shape만 정합니다.
2. Direct/deterministic work 또는 Medium child보다 직접 수행이 저렴한 work는 child-free로 유지합니다.
3. Pass 2는 current ContextPack의 source/fact/predicate evidence를 정규화하고 child 계층과 역할 변형을 판정합니다(effort는 그 역할의 pin).
4. 모든 boundedness predicate가 positive evidence로 확인되면 Medium, mandatory state/trust/concurrency/migration signal 또는
   structural deep composite가 확인되면 XHigh, 그 외 substantial work는 High입니다.

Child model은 profile이 정합니다. Admission을 통과한 bounded 읽기는 GPT-6.1 Sol, 고정 입력 추출은 GPT-6 Luna이고
([후보 표](./codex-model-profiles.md#quality-gated-model-advice)), 그 밖의 child와 독립 리뷰는 GPT-6 Astra입니다. Child effort는 `medium | high | xhigh`이고 역할 파일이 정합니다.
각 `.codex/agents` 역할은 `model_reasoning_effort`를 pin하고 이 값이 spawn의 explicit effort보다 우선하므로, Parent는 effort
인자가 아니라 역할을 골라 effort를 정합니다. Routing은 Pass 2 계층과 impact로 역할 변형과 `profileId`를 함께 출력합니다.
`effort`는 그 역할이 pin한 값이고 spawn model은 profile의 model입니다. Candidate가 없을 때의 배정은 다음과 같습니다.

| 작업                                       | Medium    | High            | XHigh    | Impact high |
| ------------------------------------------ | --------- | --------------- | -------- | ----------- |
| 읽기·조사(`knu_explorer`·`knu_researcher`) | `_medium` | 기본 역할(high) | `_xhigh` | `_xhigh`    |

독립 리뷰는 계층과 무관하게 `knu_reviewer`(xhigh)와 `review`이고, 표의 칸은 `astra-fallback`입니다. 두 profile 모두 Astra입니다. 구현·디버깅·test는
child 경로가 없어 Lead가 맡습니다(`bounded-child` 요청은 spawn 없이 `lead-task-kind` gap). `_medium`·`_xhigh` 변형의 prompt·sandbox는
기본 역할과 같고 이름·설명·effort만 다르며 test가 이를 결속합니다. Keyword, path, file count, LOC, broad verification
하나만으로 계층을 올리지 않으며 같은 fact를 여러 composite category로 중복 계산하지 않습니다. Role 이름 자체는 live runtime
지원 증거가 아닙니다. 호출 시점의 역할·(역할, model) 쌍·fork는 [hook guard](./codex-native-registry.md#subagent-hook-guardrail과-완료-관측)가 검사합니다. Low와 `max/ultra`는 일반 repository child route에 사용하지 않습니다. Low 역할도 없습니다.
실패한 lane의 재시도는 한 번입니다. 결과 품질 실패는 같은 역할로 사다리 한 단 위 model(Luna → 6.1 Sol, 6.1 Sol → Astra)에서,
근거·도구 실패와 Astra lane은 같은 contract에서 approach만 바꿔 실행하며 연쇄 상향은 없습니다([Recovery ceiling](../request-intake/orchestration-recovery.md#recovery-ceiling)).
Role routing을 증명하지 못하면 역할을 prompt label로 가장하지 않고 single/sequential fallback을 사용합니다.

Dispatch descriptor는 contract에서 `spawnArguments`(역할, profile model, 역할 pin effort, `fork_turns: none`)를 정하고, leader가
보고하는 runtime evidence를 받지 않습니다. Host가 실제로 받은 역할·model은 호출 시점에 hook guard가 검사하고, 완료는 hook 기록을
lane 계약과 대조합니다([Native dispatch gate](../request-intake/orchestration-recovery.md#native-dispatch-gate)).
