# 트러블슈팅: Subagent 완료 후 thread limit reached

**상태**: Current
**마지막 검증 환경**: Codex native collaboration surface; 지원 기능은 current-turn schema로 재확인
**현재 owner**: [Parent-owned subagent lifecycle](../../agent-workflows/subagent-lifecycle.md)

## 증상

새 child 생성 또는 기존 child follow-up에서 다음 오류가 발생합니다. 완료된 child가 목록에 보이는데도 나타날 수 있습니다.

```text
agent thread limit reached
```

이 오류와 OpenAI 사용량/주간 한도, role-routing/permission 거절은 다른 문제입니다. 원문 operation과 응답부터 확인합니다.

## 원인

작업 완료와 thread 종료가 다를 수 있습니다. 공식 문서는 `agents.max_concurrent_threads_per_session`을 부모를 제외한
동시에 열린 child thread 상한으로 설명하고 완료 thread 종료를 안내합니다. 다만 native surface별 실제 노출 도구와
목록의 historical/completed 표시만으로 현재 점유 슬롯·특정 오류 원인을 단정할 수는 없습니다.

현재 repository의 6 설정과 advisory hard cap을 늘려서 해결하지 않습니다. 공식 기본값과 모든 환경의 절대 한도가
6이라는 뜻도 아닙니다. 실행 중 writer, 완료 후 아직 열린 thread, 정리/조회 기능 부재를 분리해 확인합니다.

## 해결

[완료 시 절차와 Capacity error 복구](../../agent-workflows/subagent-lifecycle.md)를 Parent가 실행합니다.

- 현재 schema에 status 조회와 close 기능이 **둘 다** 있으면: 결과를 회수한 현재 소유 terminal child만 재확인하여
  정확히 종료하고 반환 증거를 확인합니다. 필요 dispatch만 bounded 재시도하며 dummy spawn으로 용량을 시험하지 않습니다.
- status/interrupt만 있고 close가 없으면: `cleanup-unavailable` / `release-unverified`를 기록합니다. interrupt, CLI archive,
  history 삭제를 슬롯 반환으로 가장하지 않습니다. 정상적인 parent 로컬 작업은 계속하고 필요한 독립 review는 실제 가능한
  fresh-context 대안 또는 명시적 gap으로 처리합니다.
- 모든 child가 실행 중이거나 follow-up 예정이면: 필요한 작업 완료를 기다린 뒤 결과 회수·정리합니다. 슬롯을 만들려고
  무관한 작업을 중단하거나 다른 parent의 thread를 닫지 않습니다.
- 실패 follow-up 대상이 roster에 없으면: 이름만으로 존재·소유·재사용을 가정하지 않습니다. 추가 recursive spawn이나
  전역 daemon/session 조작 대신 원문 오류와 지원 기능을 남깁니다.

새 session에서 진행해야만 하는 경우에도 상한 우회로 조용히 launch하지 않습니다. 현재 작업의 evidence·미정리 target·
필수 review gap을 보존하고 지원되는 환경의 handoff로 구분합니다. 더 자세한 상태/retry 계약을 이 문서에 복제하지 않습니다.

## 검증

```bash
node --test scripts/ci/subagent-lifecycle-contract.test.mjs scripts/ci/orchestration-policy.test.mjs
pnpm test:repo-policy
```

정적 문서/정책 테스트는 실제 thread 종료나 슬롯 반환을 증명하지 않습니다. 실제 검증은 다음을 별도로 기록합니다.

1. 완료 결과 보존 → exact target/status → 지원 close의 응답 → fresh status/capacity.
2. 실제 필요한 다음 dispatch의 성공/실패(과거 특정 thread의 반환 여부와 구분).
3. 기능 미지원·정리 실패·보존 대상의 reason/revisit 및 cap/config 불변.

정리가 확인되지 않으면 “정리 완료” 대신 `cleanup-unavailable`, `cleanup-failed`, `retained-with-reason` 또는
`release-unverified`를 사용합니다. 개별 상태/결과는 task evidence이지 저장소의 영구 runtime 사실이 아닙니다.

## 참고

- [OpenAI Subagents: thread orchestration and limits](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Orchestration recovery ceiling](../../agent-workflows/request-intake/orchestration-recovery.md#recovery-ceiling)
- [Independent review disposition](../../agent-workflows/qa.md#independent-review-disposition)
