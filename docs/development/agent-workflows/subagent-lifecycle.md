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

## Capability 확인과 tool family

공식 기능 설명, 로컬 설정/설치, 현재 호출 가능한 schema, 실제 호출 결과를 별도 evidence로 기록합니다.
이 지침은 native tool을 생성하지 않습니다. 문서의 이름을 alias로 등록하거나 없는 함수를 추측해 호출하지 않습니다.

- **Codex:** [공식 설정 참조](https://learn.chatgpt.com/docs/config-file/config-reference)의 `features.multi_agent`는
  `spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, `close_agent`를 열거합니다.
  [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)는 실행 중 방향 조정/중단과 완료 thread 닫기를 안내합니다.
- **Responses API:** [공식 Multi-agent guide](https://developers.openai.com/api/docs/guides/responses-multi-agent)는
  `spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`, `list_agents`라는 hosted actions를 설명합니다.
  이 목록에는 close가 없습니다. 목록이 일치해도 도구 이름만으로 host 구현·설정 로딩·미노출 원인을 단정하지 않습니다.
- **한도 의미:** Responses API의 active turn 한도와 Codex의 open thread 한도는 다른 계약입니다. 문서상의 기본값이나
  전체 tree 허용 범위를 repository의 child 상한 6, 재위임 금지 또는 현재 host의 거절보다 우선하지 않습니다.
  오류 하나로 completed thread 누수가 원인이라고 확정하지 않습니다.

아래는 **해당 이름과 동작이 current schema에 있을 때**의 선택 기준입니다. 다른 family와 이름/인자를 임의 치환하지 않습니다.

| 목적                    | 제공되는 기능                | Parent가 확인할 의미                                                                        |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| 독립 새 작업            | `spawn_agent`                | 새 context 비용/독립성이 필요한 bounded lane에만 사용                                       |
| 실행 중 사실 전달       | `send_message`               | 메시지만 전달, idle child를 깨워 작업시키는 용도로 사용하지 않음                            |
| 기존 lane 후속 작업     | `followup_task`              | 기존 non-root에 task 부여, idle이면 turn 시작; 실행 중 전달 시점은 schema 확인              |
| 다른 family의 후속 입력 | `send_input`                 | interrupt 옵션·turn 시작 여부는 해당 schema 확인, `send_message`와 동일하다고 가정하지 않음 |
| 결과 대기/상태 조회     | `wait_agent` / `list_agents` | mailbox 알림인지 결과 반환인지 구분; 조회 목록이 실제 슬롯 계수라는 보장은 없음             |
| 작업 중단               | `interrupt_agent`            | turn 중단과 context 보존; close 대용이 아님                                                 |
| child 재개              | `resume_agent`               | 노출된 경우에만 schema의 eligible 상태·identity·권한 확인 후 사용                           |
| thread 종료             | `close_agent`                | 아래 완료 절차를 충족한 대상만 종료, 반환 근거를 따로 기록                                  |

## 후속 작업과 fan-in

Context 크기와 fork 선택은 [context delivery 계약](./request-intake/delegation.md#context-delivery)을 소비합니다.
그 추천의 `reuseTarget`은 종료/재개 권한이 아니며, 아래 live identity·pending·결과 귀속을 따로 확인합니다.
Full-history 전달이나 effort 적용을 config 파일/이전 성공만으로 주장하지 않습니다.

1. **재사용 판정:** 같은 bounded outcome의 보완·finding 수정 확인이고 기존 context가 유효하면 불필요한 spawn보다
   기존 lane을 우선 검토합니다. unrelated task나 fresh-context QA가 필요하면 재사용하지 않습니다. 이전 builder를 reviewer로
   바꾸거나 결과를 이미 본 reviewer를 새로운 독립 판정이라고 하지 않습니다. [QA](./qa.md)의 독립성 계약은 그대로입니다.
2. **정확한 대상·작업:** current owned non-root ID·상태·이전 결과를 확인하고 새 task ID, source snapshot, acceptance,
   read/write scope, 종료 조건을 전달합니다. 이는 task evidence이지 새 권한이 아닙니다. stale roster의 completed만으로
   재사용하지 않으며 pending 작업과 충돌하는 두 번째 writer를 시작하지 않습니다.
3. **전달과 시작 구분:** `send_message`는 새 turn을 시작하지 않습니다. idle child의 답변/작업이 필요하면
   `followup_task`로 existing non-root에 배정합니다. 실행 중 child에는 관련 사실만 메시지로 전달하고,
   범위 변경·중단은 Parent가 명시하여 승인된 assignment 안에서 처리합니다. `send_input`만 있으면 그 schema를 따릅니다.
4. **fan-in:** 응답의 accepted/queued는 완료가 아닙니다. `wait_agent` timeout도 작업 완료 증거가 아님을 유지하고,
   긴 bounded wait 후 실제 mailbox result를 회수합니다. 상태 알림만 반환한 surface에서는 알림 자체를 결과로 사용하지 않습니다.
   이전 final을 새 task의 완료로 재사용하지 않으며 task/target/snapshot과 결과를 대조합니다. 불명확하면 재확인하고 gap을 남깁니다.
5. **중단·재배정:** interrupt 응답은 진행 중 외부 도구의 취소·side effect rollback을 보장하지 않습니다.
   writer 재배정 전에 pending 도구/process와 파일 상태를 확인합니다. 정확히 소유한 취소가 승인된 작업만 지원 기능으로 중단하며,
   슬롯 확보용 interrupt는 하지 않습니다. child resume 성공도 새 task의 실행/완료 증거와 구분합니다.
6. **완료·한도:** 후속 결과 회수 뒤 아래 완료 절차로 돌아갑니다. 재사용은 cap 우회가 아님을 유지하고,
   follow-up/resume도 runtime 거절을 받을 수 있습니다. 실패하면 아래 동일 recovery ceiling을 소비하며 이름을 바꿔 반복하지 않습니다.

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
