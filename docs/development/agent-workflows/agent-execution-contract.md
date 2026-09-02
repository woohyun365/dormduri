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
