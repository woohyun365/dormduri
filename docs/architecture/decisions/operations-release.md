# Operations and release 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-10-27
**확인 근거**: [#696](https://github.com/woohyun365/dormduri/issues/696)의 Web 단계 결정 기록 댓글(release-gate의 `ops.release.rollback-mode`: 직전 digest 쌍으로 되돌림)
**근거**: [Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md), [API incident rollback decision guide](../../../infra/runbooks/incidents/release-rollback.md), [Domain/SWE/Web/operations-release pack](../../development/agent-workflows/domain/swe-web/operations-release.md)

`Domain/SWE/Web/operations-release` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## release-gate

Web image의 되돌림 절차는 [Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md)가, API·DB 되돌림 판단은
[API incident rollback decision guide](../../../infra/runbooks/incidents/release-rollback.md)가 소유합니다.

#### ops.release.rollback-mode

- 판정: Ask
- 상태: validated
- 고른 선택지: 이전 artifact로 되돌림. 규칙은 [Production runtime safety](../../policies/production-runtime-safety.md)
  `PRS-R52`(previous safe image 우선, DB는 restore escalation)다. Web 단계는 host 배포 script가 새 digest 쌍의 health·내부
  smoke 실패 때 직전 쌍으로, CD가 외부 smoke 실패 때 `rollback` 동작으로 되돌리고, operator는 직전 안전 쌍(Release 단계 기록의
  `previous_safe`)을 `workflow_dispatch(action=rollback)`로 보낸다. 직전 쌍이 없으면(첫 배포) 점검 mode로 둔다. 직전 안전
  쌍은 `deploy-` image tag로 ECR lifecycle 만료 밖에 있다
- 근거: 실패한 release가 떠 있는 시간을 가장 짧게 한다. Web 단계에는 DB가 없어 schema 호환 구간이 없다. 배포 절차·artifact
  보관·schema 변경 방식이 함께 정해지는 비가역 결정이라 Owner가 확인했다
- 기각한 대안: 수동 복귀만(실패한 release가 떠 있는 시간이 길다), forward-fix만(고치는 동안 문제가 이어진다), feature flag(Web
  단계에 끌 기능이 없다)
- 재검토 조건: API 단계가 DB를 들일 때(되돌릴 수 없는 migration 뒤에는 forward-fix 경계를 더한다), 되돌린 쌍보다 이전으로 자주
  가야 할 때
- 출처: #696, Owner 확인 2026-10-27
- pack 결정: [ops.release.rollback-mode](../../development/agent-workflows/domain/swe-web/operations-release.md#opsreleaserollback-mode)
