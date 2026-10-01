# Claude native model profiles

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## Finite native-subagent model candidates

[Claude model policy](../../../../scripts/agents/claude/model-policy.mjs)는 공통 risk/complexity·task authority를 소비합니다.
Lead가 현재 facts를 근거로 선택하며 role 이름·토큰 잔량만으로 자동 결정하지 않습니다.

| Task profile         | 요청 family alias | 조건                                                      |
| -------------------- | ----------------- | --------------------------------------------------------- |
| `bounded-extraction` | `haiku`           | 낮은 위험·고정 입력·단일 추출·명시 oracle(routine 미사용) |
| `bounded-standard`   | `sonnet`          | bounded extract/read/build·scope·검증·독립 QA             |
| `complex-critical`   | `opus`            | 복잡/고위험 또는 독립 review                              |

이는 finite 후보이지 가용성·동등 품질·routine admission 보장이 아닙니다. `selectedBy/approvedBy` 문자열과 caller가
공급한 runtime report는 인증된 host grant가 아닙니다. 현재 static descriptor는 `dispatchAllowed:false`, `applied:false`,
`runtimeQualification:not-run`입니다. Source/config/scope/expiry·writer 충돌·missing/child-chosen/free-form 모델·unknown
runtime·unapproved fallback은 거부합니다. Source가 바뀌면 이전 binding을 재사용하지 않습니다.

### 역할 effort와 executor 단계

Effort는 역할 파일의 `effort`가 정하고 Parent 세션 effort를 상속하지 않습니다([subagent 설정](https://code.claude.com/docs/en/sub-agents)).
Agent 호출에는 effort 입력이 없으므로 같은 책임의 effort 변형은 별도 역할로 둡니다.

| 역할                 | Effort  | 쓰는 곳                                                                         |
| -------------------- | ------- | ------------------------------------------------------------------------------- |
| `knu_explorer`       | `high`  | 고정 입력 추출·repository 읽기(`bounded-standard` Sonnet)                       |
| `knu_researcher`     | `high`  | 공식 근거 조사                                                                  |
| `knu_executor`       | `high`  | bounded build(`bounded-standard` Sonnet), 복잡한 build(`complex-critical` Opus) |
| `knu_executor_xhigh` | `xhigh` | impact `high` build(강제), Recovery 상향(`complex-critical` Opus만)             |
| `knu_reviewer`       | `xhigh` | 독립 review(`complex-critical` Opus)                                            |

Model policy는 impact `high` build를 `knu_executor_xhigh`·`complex-critical`로만 받고, 그 역할을 `complex-critical` build
밖에서는 거부합니다(`effort-tier`). 등록은 역할 effort를 기대값으로 기록하고, `settle`·`complete`가 관측할 때마다 child
transcript의 assistant 행 `effort`와 대조합니다. SubagentStop의 `effort.level`은 child 값과 세션 값을 구별하지 못한
관측(CLI 2.1.286)이 있어 쓰지 않습니다. Routine 추출은 `bounded-standard`(Sonnet)입니다. `bounded-extraction`은 등록할 수
있게 남지만 routine에서 쓰지 않습니다.

공개하는 한계:

- Intake가 보안·인증·migration·삭제 같은 keyword로 요청 risk를 `high`로 정하면 task impact를 낮출 수 없어 그 build는 xhigh가
  됩니다. Codex는 keyword 하나로 effort를 올리지 않습니다. 이 차이는 Owner의 성능 우선 결정(2026-10-01)으로 받아들입니다.
- 공식 권장은 xhigh를 측정된 향상이 있을 때 쓰는 것입니다. Reviewer와 high-risk build의 xhigh는 같은 결정으로 측정 전에
  채택했고 high 대비 향상은 측정하지 않았습니다.
- Effort가 있는 역할로 Haiku를 부를 때의 동작은 관측하지 않았습니다. Haiku를 다시 routine으로 쓰기 전에 관측합니다.
- Foreground 완료의 child transcript 위치(부모 transcript 옆 `<session>/subagents/`)는 background child에서만 관측했습니다.
  위치가 다르면 foreground task는 수명이 끝난 뒤 `effort-unobserved`로 거부되며, 통과로 남지 않습니다.
- 역할 effort를 덮어쓰는 설정(effort 환경변수·상한)이 있으면 관측이 `effort-mismatch`로 드러납니다.

### Frontmatter 필드 처분

KNU 역할 파일은 `name`·`description`·`tools`·`effort`만 씁니다. 공식 필드 목록(2026-10-01 기준)의 처분은 다음과 같고,
`scripts/ci/agent-native-adapter-contract.test.mjs`가 이 목록을 복사본으로 고정합니다. 공식 필드가 늘면 이 표를 갱신합니다.

| 필드              | 처분 | 근거                                                   |
| ----------------- | ---- | ------------------------------------------------------ |
| `name`            | 채택 | 필수                                                   |
| `description`     | 채택 | 필수                                                   |
| `tools`           | 채택 | 역할 도구 경계, 등록이 task 도구와 대조                |
| `effort`          | 채택 | 세션 effort 상속 차단, 관측 대조의 기대값              |
| `model`           | 기각 | 호출 alias가 우선하며 profile이 task마다 고름          |
| `disallowedTools` | 기각 | `tools` allowlist로 충분                               |
| `maxTurns`        | 기각 | 부분 결과를 완료로 혼동할 위험, 수명은 registry가 묶음 |
| `skills`          | 기각 | KNU skill은 Parent 절차                                |
| `permissionMode`  | 기각 | 권한 설정을 바꾸지 않음                                |
| `isolation`       | 기각 | 단일 writer가 현재 working tree에서 씀                 |
| `memory`          | 기각 | memory는 source of truth가 아님                        |
| `background`      | 기각 | 호출 방식은 Parent가 정함                              |
| `hooks`           | 기각 | project hook이 소유                                    |
| `mcpServers`      | 기각 | project 설정이 소유                                    |
| `omitClaudeMd`    | 기각 | child도 `AGENTS.md`를 따름                             |
| `color`           | 기각 | 해당 없음                                              |
| `initialPrompt`   | 기각 | 등록 prompt를 hook이 주입                              |
| `experimental`    | 기각 | 해당 없음                                              |

### 요청·차단·관측의 세 경계

1. **요청 선택:** 명시 task profile/binding으로 어떤 모델을 요청했는지 결정합니다.
2. **호출 전 차단:** 실제 host가 잘못되거나 누락된 모델 요청을 막았는지 별도로 입증합니다.
3. **호출 후 관측:** 해석된 시작 모델·실행 중 변경·완료와 같은 run의 결과를 연결합니다.

모든 오류 시 실행 자체를 막는 native strict admission은 일반 auto에서 보장하지 않습니다. 정상 hook의 deny 성공만으로
startup failure/crash/malformed output/timeout 때도 차단된다고 주장하지 않습니다. Command hook 실패는 일반 permission
판정으로 진행될 수 있습니다. 이것이 모든 default-deny 조합의 허용을 의미하지는 않습니다. 다만 `ask:Agent`와 `dontAsk`에
PreToolUse allow를 더하는 조합은 matching ask가 남아 정상 허용 경로도 입증되지 않습니다.
역할 이름을 지정한 `Agent(<role>)` ask 규칙과 PermissionRequest hook으로 hook 장애를 사람 승인으로 넘기는 구성도 일반 auto의
gate로 사용하지 않습니다. 공식 문서는 explicit ask 규칙이 auto에서도 prompt를 띄운다고 설명하지만, CLI 2.1.283 새 auto 세션
(owner Home 설정과 OMC 5.5.0 plugin 로드)에서 project `Agent(knu_explorer)` ask 규칙은 승인 prompt와 PermissionRequest 이벤트
없이 child를 시작했습니다. 이 관측은 문서화된 ask 동작과 다르므로 문서만으로 gate를 주장하지 않습니다. Bare `Agent` ask, 다른 mode,
Home·plugin이 없는 조합은 이 관측으로 판정하지 않습니다. 따라서 일반 auto에서 hook 장애 시 남는 보장은 완료 판정 거부입니다
([hook 장애 troubleshooting](../../troubleshooting/tooling/claude-native-hook-failure-and-completion-refusal.md)).
[Permission과 hooks](https://code.claude.com/docs/en/permissions#extend-permissions-with-hooks),
[hook 실패 처리](https://code.claude.com/docs/en/hooks)를 확인합니다.

공식 parameter rule의 `Agent(model:opus)`는 literal 입력 비교이며 model 누락은 그 값 규칙에 매치되지 않습니다.
이를 task별 정확한 하나의 모델·provider-effective identity 강제로 과장하지 않습니다. Native invocation → frontmatter →
env default → parent 우선순위 외에도 FORCE override·managed 허용 모델 대체가 있습니다. Managed exact allowlist 역시
허용 집합 제한과 개별 task 선택은 별개입니다. [Model 설정](https://code.claude.com/docs/en/model-config)과
[env 규칙](https://code.claude.com/docs/en/env-vars)을 현재 설치 버전에서 확인합니다.

### 결과와 observation 경계

기록 원칙은 [Execution evidence](../qa.md#execution-evidence)를 따릅니다. 요청 모델과 관측 모델이 다르면 그대로 남기고 성공으로 바꾸지 않습니다.

Agent PostToolUse의 `resolvedModel`은 시작 또는 background 전환 시점 모델이고 `modelsUsed`는 변경 관측입니다.
Parent modelUsage나 응답 문장을 child model 입증으로 사용하지 않습니다.

같은 tool ID라도 다른 parent/session/run/source/config/binding의 record를 합치지 않습니다. Child session ID가 parent와
다를 수 있으므로 단순 ID 동일성도 올바른 관계 검사의 대체물이 아닙니다. 누락·중복·역순·취소·불명확 provenance는 gap으로
남깁니다. 임의 JSON receipt를 actual host observation으로 취급하지 않습니다.
[qualification matrix](../../../../scripts/ci/fixtures/claude-subagent-model-qualification-matrix.json)는 test scenario이지
현재 세션의 PASS 증거가 아닙니다.
