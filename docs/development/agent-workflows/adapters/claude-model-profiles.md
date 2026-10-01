# Claude native model profiles

[Claude Code adapter](./claude-code.md)의 reference입니다. 진입 절차와 routine 운영은 그 문서를 먼저 읽습니다.

## Finite native-subagent model candidates

[Claude model policy](../../../../scripts/agents/claude/model-policy.mjs)는 공통 risk/complexity·task authority를 소비합니다.
Lead가 현재 facts를 근거로 선택하며 role 이름·토큰 잔량만으로 자동 결정하지 않습니다.

| Task profile         | 요청 family alias | 조건                                      |
| -------------------- | ----------------- | ----------------------------------------- |
| `bounded-extraction` | `haiku`           | 낮은 위험·고정 입력·단일 추출·명시 oracle |
| `bounded-standard`   | `sonnet`          | bounded read/build·scope·검증·독립 QA     |
| `complex-critical`   | `opus`            | 복잡/고위험 또는 독립 review              |

이는 finite 후보이지 가용성·동등 품질·routine admission 보장이 아닙니다. `selectedBy/approvedBy` 문자열과 caller가
공급한 runtime report는 인증된 host grant가 아닙니다. 현재 static descriptor는 `dispatchAllowed:false`, `applied:false`,
`runtimeQualification:not-run`입니다. Source/config/scope/expiry·writer 충돌·missing/child-chosen/free-form 모델·unknown
runtime·unapproved fallback은 거부합니다. Source가 바뀌면 이전 binding을 재사용하지 않습니다.

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
