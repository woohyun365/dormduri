# Request intake

이 디렉터리는 사용자 요청을 repository-aware 작업 입력으로 변환하는 tracked contract를 소유합니다.
특정 모델의 prompt template이나 실행 상태를 저장하지 않습니다.

## 문서

- [Decisions](./decisions.md): intake, authority, disclosure, orchestration의 채택 결정
- [TaskEnvelope](./task-envelope.md): request를 표현하는 immutable advisory value contract
- [Output contracts](./output-contracts.md): Answer·Analyze·Plan 결과의 서로 다른 완료 계약
- [Ambiguity and authority](./ambiguity-and-authority.md): 모호함, 사용자 확인, OQ, release handoff,
  mutation 권한 경계
- [ContextPack](./context-pack.md): repository evidence에서 domain candidate와 최소 tracked guide를 발견하는 계약
- [Delegation](./delegation.md): independent lane, one-writer, source-bound handoff 공통 책임
- [Codex child policy](../adapters/codex-delegation.md): typed child handoff, role·effort·model recommendation
- [Codex orchestration and recovery](./orchestration-recovery.md): Codex/OMX native dispatch gate, one-alternate ceiling,
  leader-only synthesis 계약. Claude 기본값이 아님.

## Regression surface

- `scripts/ci/fixtures/agent-intake-cases.json`: Analyze, Plan, direct, ambiguity, recovery 대표 입력과 기대 계약
- `scripts/ci/agent-intake-integration.test.mjs`: intake부터 dispatch 또는 handoff까지의 조합, source freshness,
  no-write 경계
- `scripts/agents/codex/fresh-session-smoke.mjs`: local session memory 없이 Codex/OMX 대표 route를 확인하는
  read-only smoke
- `scripts/ci/agent-intake-fresh-session.test.mjs`: generic bootstrap, domain-owner conflict, runtime role-routing fallback,
  stale handoff 참조 방지

```bash
node scripts/agents/codex/fresh-session-smoke.mjs --json
```

## 적용 순서

```text
current request
→ TaskEnvelope
→ ambiguity / authority gate
→ ContextPack
→ output contract
→ direct·sequential·clarify·OQ handoff·bounded lane 추천
```

- `TaskEnvelope`는 advisory다. 자체적으로 tool을 실행하거나 child를 생성하지 않는다.
- explicit user request와 repository safety rule만 action authority를 부여한다.
- 분석 요청은 구현이 아니며, 계획 요청은 계획 자료와 구현을 동시에 승인하지 않는다.
- 세부 domain guide는 필요할 때만 발견하며, 이 디렉터리에 product policy를 복사하지 않는다.
- Plan 결과가 승인된 경우에만 [Plan authoring](../plan-authoring/README.md)의 core와 primary domain guide를
  선택한다.

## 권한 서열

1. 현재 사용자 요청
2. tracked `AGENTS.md`의 안전·소유·검증 경계
3. current code·contract·test·policy evidence
4. advisory intake 결과
5. local plan·checkpoint·memory

Intake 결과가 상위 근거와 충돌하면 결과를 폐기하고 다시 작성합니다.
