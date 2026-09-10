# Agent execution contract

이 문서는 coding agent가 따라야 하는 tool-neutral 실행 계약입니다. 저장소 공통 불변 조건은 root `AGENTS.md`가
소유하며, 작업별 QA와 refactor 판단은 각각 연결 문서를 사용합니다.

## 1. Classify

현재 요청을 다음 중 하나로 분류합니다.

- `fresh`: 과거 task를 이어받지 않는 새 작업
- `resume`: 명시된 plan, phase, checkpoint 또는 active workflow를 이어받음
- `analysis`: 읽기 전용 사실·원인·책임 분석
- `plan`: 구현 전 architecture와 검증 순서 설계
- `implementation`: 승인된 범위의 edit-test-verify
- `verification`: 변경의 완료 주장과 evidence 검증

분류가 모호해도 reversible local inspection은 진행할 수 있습니다. 결과를 바꾸는 중요한 분기나 외부 side effect만
사용자에게 확인합니다.

상세 intent, action authority, ambiguity와 Answer·Analyze·Plan 경계는
[Request intake](./request-intake/README.md)를 따릅니다. Intent confidence는 수정 권한을 부여하지 않습니다.

## 2. Inspect

정보 우선순위는 다음과 같습니다.

1. current user request와 같은 thread의 최신 evidence
2. branch, `HEAD`, working tree의 code·contract·test
3. tracked policy·architecture·runbook·owner README
4. active plan/checkpoint
5. local memory, wiki, historical artifact

사실, 추론, 결정, 미확정 질문을 구분합니다. 이전 session의 완료 문구는 code/test/git 증거가 없으면 사실이 아닙니다.

현재 source/owner에서 의미 있는 관점이 필요할 때만 [선택적 domain consultation](./owner-lead-collaboration.md#필요한-관점만-참고하기)을
사용합니다. Non-Plan 요청에도 관련 부분을 참고할 수 있지만 mapper의 `selectedGuides`와 output/mutation authority는
바꾸지 않습니다. 작은 lookup이나 승인된 기지의 수정에 전체 계획 체크리스트를 강제하지 않습니다.

UI의 시각적 방향·reference·화면 비평을 다루면 Plan 여부와 무관하게
[Visual design workflow](./visual-design/README.md)를 참고합니다. 분석, 방향 제안, 계획, 승인된 구현은 각 요청의
권한을 유지합니다. 가이드를 읽었다는 이유로 prototype·제품 파일을 수정하거나 Figma를 연결하지 않습니다.
내용·동작 보존과 스타일 상속은 별도로 판단하며, 작은 기지 CSS 결함에는 전체 디자인 탐색을 강제하지 않습니다.

## 3. Route

- deterministic search/check로 해결할 수 있으면 tool을 사용합니다.
- 한 owner와 하나의 dependency chain이면 single-agent 경로를 사용합니다.
- 독립적인 evidence 또는 파일 ownership이 있을 때만 bounded child lane을 사용합니다.
- external official evidence가 설계를 바꿀 때만 research lane을 추가합니다.
- destructive, irreversible, credential, external-production action은 authority gate를 적용합니다.
- GitHub remote 작업은 shell-capable local session에서 `gh` CLI-first, ChatGPT Web/no-shell session에서 GitHub
  Connector-first로 선택합니다. Fallback과 인증 경계는
  [GitHub authentication and operator access](../github/authentication-and-operator-access.md)를 따릅니다.
- 사용자가 Connector 기반 skill/workflow를 명시적으로 호출했다면 그 documented primary surface가 일반 default보다
  우선하며, 같은 lifecycle 동안 선택을 유지합니다.

세부 선택은 [Orchestration](./orchestration.md)을 따릅니다.

## 4. Act

- 명확한 기술 작업은 승인 범위에서 진행합니다. 중요한 제품·비용·위험 선택이나 승인된 방향과 새 근거의 충돌에는
  [Owner–Lead collaboration](./owner-lead-collaboration.md)의 짧은 decision packet을 사용합니다. 합의된 기술 세부사항을
  매번 다시 승인받지 않으며, 안전한 독립 작업과 Owner 판단을 기다릴 경계를 구분합니다.
- 구현 요청은 [Branch and PR strategy](../github/branch-and-pr-strategy.md)에 따라 fresh integration branch에서 bounded
  branch를 만든 뒤 수정합니다. Plan·Analyze처럼 source mutation 권한이 없는 요청은 branch 생성을 완료 조건으로
  만들지 않습니다.
- 사용자의 unrelated working-tree 변경을 revert하거나 덮어쓰지 않습니다.
- 기존 owner와 utility를 먼저 재사용하고 dependency는 명시적 요청 없이는 추가하지 않습니다.
- cleanup/refactor는 계획과 regression protection을 먼저 마련합니다.
- child를 사용한다면 scope, evidence, output schema, stop condition과 write owner를 고정합니다.
- PR·Issue·Actions remote mutation 전에 같은 대상이 이미 존재하는지 확인하고, 한 lifecycle에서는 하나의 primary
  control plane을 유지한 뒤 같은 surface로 결과를 read back합니다. Fallback은 숨기지 않으며 같은 mutation을 재시도해
  중복 생성하지 않습니다.

## 5. Verify

완료 전에 다음을 확인합니다.

- 요구한 observable behavior가 동작함
- targeted test가 변경 contract를 실제로 보호함
- 필요한 lint/typecheck/build/integration 결과를 읽음
- 알려진 오류와 남은 검증 공백을 구분함
- plan checkbox가 아니라 environment outcome을 evidence로 사용함

검증 전략과 PASS/FAIL/BLOCKED 판정은 [QA workflow](./qa.md)를 사용합니다.

의미 있는 위험에는 QA owner의 독립 검토 trigger와 snapshot-bound packet/result를 적용합니다. Self-review, context-isolated
review, 실제 runner/test/CI와 human approval을 구분하고, 관련 snapshot 변경 후에는 영향 범위를 재검토합니다.
Read-only reviewer가 제안한 write-producing 검증은 별도 권한 있는 runner가 실행합니다. 상세 양식은 QA 문서를 재사용합니다.

의도한 사용자/운영 이익과 코드의 계약 준수는 다릅니다. 효과가 불확실하면
[Development lifecycle](./development-lifecycle.md)의 observation/follow-up과 scoped Done을 사용하며 미래 효과를 발명하지 않습니다.

## 6. Handoff

최종 결과 또는 checkpoint는 다음 schema를 사용합니다.

```text
objective
branch / HEAD
changedFiles[] / stagedFiles[]
completed[] / nextActions[] / blockers[]
decisions[] / rejectedAlternatives[]
relevantFiles[] / doNotTouch[]
verification[] / knownFailures[]
createdAt / expiresAt
```

장문의 transcript, secret, raw `.env`, 개인 식별 정보, source 없는 완료 주장, finished plan과 같은 상태의 중복 사본은
기록하지 않습니다.

로컬 context 없이 이어받아야 하는 결정·검증·미해결 작업은 기존 docs/PR/test/CI/Issue owner에 연결합니다.
[Session continuity](./session-continuity.md)의 진단은 실행 권한이나 완벽한 기억이 아니며, 부족한 근거는 재조사하거나
결과를 바꾸는 중요한 질문으로 남깁니다.
