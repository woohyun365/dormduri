# Parent-owned subagent lifecycle

Parent가 child 작업 완료 후 결과 회수·thread 정리·슬롯 해제 확인과 `agent thread limit reached` 복구를 소유합니다.
호출 거절만 보고 종료하지 않고, 아래의 안전한 정리와 bounded 대안을 먼저 수행합니다. 새 scheduler나 runtime hook을
구현하는 문서가 아닙니다. 배정/권한은 [Orchestration](./orchestration.md), 독립성은 [QA](./qa.md)를 따릅니다.

## Trigger와 고정 경계

- child 작업 완료/final result 도착, fan-in 완료, 추가 dispatch 전, capacity error 발생, parent turn 종료 시 확인합니다.
- repository child 상한 6 및 현재 runtime의 더 엄격한 제한을 유지합니다. 설정 증액·새 session/외부 agent를 만드는
  상한 우회는 복구가 아닙니다. Runtime이 허용한 dispatch만 실행하며 과거 roster 길이로 잔여 슬롯을 계산하지 않습니다.
- 현재 session의 실제 tool schema와 fresh status를 확인합니다. 문서에 close가 설명되어 있거나 CLI가 설치돼 있다는
  사실만으로 지금 호출 가능한 기능이라고 단정하지 않습니다.
- native thread, OS process, 저장된 session, OMX Team task는 다른 자원입니다. 각 owner의 lifecycle을 혼용하지 않습니다.

## 완료·종료·해제 구분

| 관찰/기록              | 의미와 다음 행동                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `completed`            | child의 한 작업 결과가 도착함. thread 종료 또는 슬롯 해제 증거는 아님                   |
| `closed-confirmed`     | 정확한 대상에 대한 지원 close가 성공/종료 상태를 반환함. 슬롯 정보가 없으면 별도 미확인 |
| `release-confirmed`    | runtime이 해당 슬롯 반환을 명시적으로 확인함                                            |
| `release-unverified`   | close가 성공해도 슬롯 반환 여부를 확인할 기능/응답이 없음                               |
| `retained-with-reason` | 구체적인 후속 질문/delta review 때문에 일시 보존. reason, owner, revisit 조건을 명시    |
| `cleanup-unavailable`  | 현재 surface에 종료 기능이 없거나 대상 소유·상태를 증명할 수 없어 안전한 close 불가     |
| `cleanup-failed`       | 지원된 정확한 close가 실패. 원문 오류와 현재 상태를 보존하고 성공으로 기록하지 않음     |

`interrupt_agent`는 실행 중 turn의 중단이지 thread 종료/슬롯 해제 증거가 아니다. 일반 `completed`나 UI의 Done 표기도
마찬가지입니다. `archive`가 현재 native thread의 `close`와 동등하다고 추측하지 않습니다. 다른 API의 유사 이름이나
saved-session UUID를 native child ID로 임의 매핑하지 않습니다.

## 완료 시 절차

1. **결과 보존**: final result, source snapshot, 실행 evidence, 미해결 finding/gap을 parent가 회수하고 통합합니다.
   필요한 요약/포인터만 task artifact에 남기며 secret·긴 transcript를 복사하지 않습니다. 아직 결과가 없으면 먼저 회수합니다.
2. **대상 재확인**: current parent에 속한 정확한 child ID, 현재 terminal 상태, pending follow-up/도구 실행 없음,
   결과 회수 완료를 fresh runtime으로 확인합니다. 이름·cwd·과거 로그만으로 소유를 증명하지 않습니다.
   running/waiting/unknown 대상은 슬롯 확보만을 위해 닫지 않는다. 다른 parent·다른 session·Team 대상도 건드리지 않습니다.
3. 보존이 필요하면 `retained-with-reason`에 reason과 revisit를 기록합니다(예: 특정 수정의 delta review 뒤 종료).
   막연한 “나중에 재사용”은 무기한 보존 사유가 아닙니다. 같은 reviewer 재사용은 최초 context-isolated review 뒤
   그 finding의 delta 확인에 한정할 수 있으며 builder를 독립 reviewer로 바꾸는 방법은 아닙니다.
4. **지원 close 호출**: 보존할 이유가 없는 eligible child는 Parent가 지금 노출된 native close 기능으로 정확한 ID만
   종료합니다. 예를 들어 `close_agent`가 실제 schema에 있을 때만 그 schema대로 호출합니다. 실행 직전 identity/status가
   바뀌거나 지원/권한이 불명확하면 mutation을 중단하고 `cleanup-unavailable`을 기록합니다. 일상적인 authorized close를
   사용자에게 대신 시키거나 허가를 다시 묻지 않습니다. 이 지침 자체가 새 종료 권한을 부여하지는 않습니다.
5. **해제 확인**: 응답과 fresh status/capacity를 대조합니다. close와 release를 따로 기록하며 관측하지 못한 필드는
   `release-unverified`입니다. 후속 필요 dispatch가 성공하면 그 성공만 기록합니다. 성공 하나를 과거 모든 thread가
   해제됐다는 증거나 특정 thread의 slot 반환 증거로 바꾸지 않습니다. 시험용 dummy child는 생성하지 않습니다.

## Capacity error 복구

1. 오류가 난 실제 operation/target과 응답, 현재 tools/roster/status를 한 번 수집합니다. 실패 응답에 유효한 child ID가
   없으면 생성 성공으로 등록하지 않습니다. 반대로 pending/부분 성공이면 runtime 결과를 먼저 확인해 중복 spawn을 피합니다.
2. 위 절차로 완료·회수된 **현재 소유 child만** 정리합니다. 재사용 중인 lane, 진행 중 작업, 소유 미확인 대상은 보호합니다.
3. close 성공/새 capacity 등 상태 변화 evidence가 있으면 필요한 post-cleanup dispatch를 최대 1회 재시도합니다.
   이것은 [Recovery ceiling](./request-intake/orchestration-recovery.md#recovery-ceiling)의 distinct alternate 한 번을
   소비합니다(`approachId: post-cleanup`, `alternateOf: 원래 시도`). 같은 상태의 spawn/follow-up 반복 재시도는 금지합니다.
4. 종료 기능이 없거나 실패/슬롯 미확인이고 유효한 복구 evidence도 없으면 같은 호출 대신 parent의 안전한 sequential
   작업을 계속합니다. 현재 존재·권한·상태가 확인된 child의 bounded 재사용은 실제 runtime이 허용하고 작업/독립성 계약에
   맞을 때만 대안입니다. cleanup 후 retry, 재사용, 별도 reviewer를 차례로 모두 시도하는 무제한 ladder는 만들지 않습니다.
5. 독립 review가 필수이면 self-review로 독립 검토를 대체하지 않습니다. 실제 지원·권한이 확인된 fresh-context surface가
   있을 때만 같은 alternate budget 안에서 [QA packet](./qa.md#portable-qa-packet)을 전달합니다. 상한 우회 목적의 외부
   CLI/session spawn은 금지합니다. 대안도 실패/없음이면 안전한 로컬 검증만 마치고 independent-review gap과 필요한 기능을
   보고합니다. 그 상태를 merge-ready로 표현하지 않습니다.

권한·credential·외부 production 거절은 capacity error로 재분류하지 않습니다. Runtime DB/SQLite·session JSON 수동 수정은
금지하며 transcript 삭제, 전역 process kill, 임의 Team shutdown/cancel, 설정 증액도 복구 수단으로 사용하지 않습니다.
지원이 없는 종료를 shell/internal endpoint 추측으로 우회하지 않습니다. 환경/도구 지원이 실제로 바뀐 후 새 요청에서
재판정할 수 있지만 같은 turn에서 새 task 이름으로 retry ceiling을 초기화하지 않습니다.

## Parent closeout

최소 기록: `child ID / parent scope evidence / result pointer / last status / close tool+result / slot evidence /
retained reason+revisit / next action`. task-local artifact/checkpoint에 기록하되 hidden runtime state를 대신하지 않습니다.

모든 시작한 child는 결과 회수 및 closure disposition을 가져야 합니다. 실행 중 child가 있으면 대기/명시된 진행 소유자를
남기고 완료라고 하지 않습니다. `cleanup-unavailable`은 “모두 정리됨”이 아닙니다. 기능이 노출되면 Parent가 eligible 대상의
정리를 다시 수행하며, 제품 검증 결과와 thread 정리의 공백을 분리해 보고합니다.

문서 계약 검사는 링크/불변 규칙의 퇴행을 잡을 뿐 native runtime 실행·슬롯 반환·agent의 지침 준수를 강제하지 않습니다.
진단 예시는 [Thread limit troubleshooting](../troubleshooting/tooling/agent-thread-limit-reached.md)을 참고합니다.
