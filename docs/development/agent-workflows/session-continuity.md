# Session continuity

새 session은 이전 transcript를 복제하는 대신 현재 repository evidence로 작업을 재구성합니다.

Repository 상태의 읽기 전용 요약은 `pnpm agent:preflight`를 사용합니다. Resume 작업에서는
`node scripts/agents/session-preflight.mjs --resume --plan <repository-relative-plan> --json`으로 선택한 계획과 관련된
bounded context 진단을 확인합니다. 파싱 성공과 현재 작업에 사용할 수 있다는 판단은 다릅니다. 진단 결과도 실제
code/test/git evidence 및 최신 사용자 요청과 대조하며, 실행 권한이나 완벽한 기억을 보장하지 않습니다.

## Fresh task

1. current user request를 읽습니다.
2. branch, `HEAD`, `git status --short`를 확인합니다.
3. 요청과 직접 관련된 production code, contract, test, tracked docs만 읽습니다.
4. 사용자가 plan을 명시했거나 작업 복잡도가 요구할 때만 active plan을 읽습니다.
5. notepad, context snapshot, wiki, project memory, finished plan을 기본 입력으로 읽지 않습니다.

## Resume task

다음 중 하나가 참일 때만 resume 경로를 사용합니다.

- 사용자가 `이어서`, 특정 plan 또는 phase 재개를 명시함
- current request가 같은 task를 계속하는 내용이고, 그 task의 active OMX mode, team 또는 goal이 존재함
- current request가 interruption 또는 compaction 이후 같은 task의 계속을 요구하고, bounded checkpoint가 존재함

notepad priority, context snapshot 또는 active runtime이 존재한다는 사실만으로 fresh request를 resume으로 바꾸지 않습니다.
항상 current request가 같은 task의 연속성을 나타내는지 먼저 확인합니다.

Resume 순서:

```text
current request
→ branch / HEAD / working tree
→ explicit selected plan / task identity
→ bounded priority / context diagnostics
→ relevant plan checkpoint (사용 가능성 확인 후)
→ code/test/git log freshness verification
→ relevant tracked policy/architecture/runbook
```

checkpoint가 working tree나 최신 요청과 충돌하면 현재 판단 근거로 사용하지 않습니다. 다른 작업/세션의 파일을
자동 수정·삭제하지 않으며, 현재 작업 소유권과 권한이 확인된 경우에만 해당 checkpoint를 갱신합니다.

## Diagnostic contract

기존 CLI 옵션, `schemaVersion: 1`, `resume.plan.{path,exists}`, `contextSnapshots: string[]`와 priority 출력은 유지합니다.
Fresh 모드의 `resume`은 `null`이며 notepad나 context 본문을 읽지 않습니다. `activePlans`는 `.omx/plans` root의
파일 목록이지 자동 lifecycle 필터가 아닙니다. 상태가 불명확하면 기존 호환 값인 `unspecified`로 표시합니다.

Resume의 추가 필드는 다음과 같습니다.

```text
resume.diagnostics
  taskId / taskIdSource: plan-id | filename-hint | unknown
  planStatus
  priority: taskMatch / freshness / reasons[]
  snapshots[]: path / taskMatch / freshness / reasons[]
  recommendedContextPath: path | null
  limitations[]
```

`snapshots`는 `contextSnapshots`와 같은 경로·순서이며 최대 5개입니다. 출력은 포인터와 고정 진단 코드만 담고
checkpoint의 objective, 요청 본문, nextAction 또는 raw notepad/JSON을 복제하지 않습니다.

| 진단                     | 의미                                                                                           | 후속 행동                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| priority `valid`         | 기존 priority JSON 구조가 파싱됨; 빈 priority의 기존 `valid: true`도 유지                      | taskMatch/freshness와 별개로 해석                                 |
| context parser `valid`   | 필수 구조·타입·금지 필드·절대 만료 검사를 통과                                                 | 현재 요청과의 동일성이나 live phase 증명은 아님                   |
| `taskMatch: matched`     | 선택한 계획 경로와 task metadata가 충돌 없이 일치                                              | 현재 code/test evidence 추가 확인                                 |
| `mismatched` / `unknown` | 서로 다른 작업 / 비교할 충분한 근거 없음                                                       | 과거 작업을 임의로 이어가지 않음                                  |
| `freshness: current`     | 알려진 비종료 계획, 절대 만료 전, 유효한 시각, 같은 branch/HEAD, clean tree와 관련 경로를 확인 | 선택 후보일 뿐 실행 허가나 정확성 보장은 아님                     |
| `needs-review`           | branch/HEAD 변경, dirty tree 또는 archived plan                                                | 관련 변경을 확인; HEAD가 다르다는 이유만으로 기억을 삭제하지 않음 |
| `expired`                | 절대 기한 도달 또는 선택한 계획이 명확히 completed/cancelled                                   | active continuation으로 추천하지 않음                             |
| `unknown`                | 잘못된/누락된 identity·시각·경로·SHA, 불명확한 계획/만료 등                                    | 부족한 정보를 재조사하고 중요한 결정만 재확인                     |

여러 사유가 있으면 `expired > unknown > needs-review > current` 순으로 판정하며 사유들은 함께 남깁니다.
`recommendedContextPath`는 검사한 후보 중 가장 최신의 `matched/current` 경로입니다. 해당 후보가 없으면 `null`이고,
priority가 항상 추천되는 것은 아닙니다. 실패한 priority와 별개의 정상 후보는 독립적으로 검사하되, 동일 경로에 대한
priority/checkpoint 충돌을 중복 제거로 숨기지 않습니다.

### Identity and freshness

- 첫 level-two section 전, fenced block 밖의 top-level `- Status:` / `- 상태:`와 `- Plan ID:`만 metadata로 읽습니다.
  상태값의 plain/backtick 표기와 세미콜론 뒤 설명을 지원합니다. `done/완료`, `진행 중`, `취소` 등의 동등 상태를
  정규화하지만 서로 충돌하거나 알 수 없는 선언은 unknown입니다. 본문/체크박스의 완료 단어로 추측하지 않습니다.
- 명시한 계획 경로가 anchor입니다. 유효한 단일 kebab-case Plan ID가 있으면 context의 `taskSlug`도 일치해야 합니다.
  Plan ID가 없을 때만 파일명에서 `.md`와 말미 `-plan`을 뺀 값을 검색 힌트로 사용합니다. 잘못되거나 충돌하는 ID를
  filename fallback으로 덮지 않습니다. `activePlan` 경로는 항상 일치해야 하며, priority `task`와 context task의 충돌도
  다른 일치값보다 우선합니다. `--plan`이 없으면 저장된 기억에서 현재 작업을 추론하거나 추천하지 않습니다.
- 이동/삭제된 계획은 missing으로 남깁니다. 전역 archive 검색, 자동 경로 재작성이나 task alias를 만들지 않습니다.
  명시적으로 선택한 `finished/` 경로는 읽을 수 있지만 active context로 추천하지 않습니다.
- `createdAt`은 파일명 UTC 초와 일치하고 미래가 아니어야 합니다. 잘못된 달력 날짜/시각 불일치는 진단합니다.
  축약 SHA는 로컬에서 유일한 commit으로 해석할 수 있어야 하며 이를 위해 fetch하지 않습니다.
- `expiresAt: on-phase-completion`에는 live phase oracle이 없습니다. 저장된 `currentPhase`, `completed`, `planStatus`나
  OMX mode만으로 현재 phase 종료 여부를 확정하지 않습니다. 선택한 계획의 명확한 종료는 expired, 그렇지 않으면
  `expiry-unknown`입니다. 동일 `workingTreeSummary`도 diff hash가 아니므로 dirty tree는 항상 재검토 대상입니다.

### Bounded reads and failure handling

- `.omx/context`는 filename만 비재귀적으로 열거합니다. 계약에 맞는 파일명과 유효한 시각을 가진 관련 task를 우선합니다.
  안전하고 구조적으로 유효한 priority 대상에 한 슬롯을 배정한 뒤, 관련 후보를 filename 시각 내림차순·동률 경로
  오름차순으로 채웁니다. 누락된 priority 경로도 진단하며, 본문은 총 5개 이내로 검사하고 실패 슬롯을 재충전하지 않습니다.
- 검증된 `createdAt` 내림차순으로 결과를 정렬하고 유효하지 않은 시각은 뒤에 둡니다. 관련 없는 검색 후보의 본문은
  읽지 않습니다. `candidate-limit`은 검색이 부분적임을 뜻하며 과거 기억 전체를 조사했다고 주장하지 않습니다.
- Plan/context는 lexical 및 realpath containment, symlink·owner-directory·일반 파일 여부를 확인하고 파일당 64 KiB까지만
  읽습니다. 관련 파일은 경로/존재만 확인합니다. 안전하지 않은 `--plan`은 CLI 오류, 선택적 context 문제는 진단 gap입니다.
- 선택적 OMX 호출은 각각 5초·64 KiB로 제한합니다. 실패·malformed·oversized 결과는 `omx-unavailable` 등으로 표시하며
  정상적인 fresh 조사 자체를 차단하지 않습니다. `plan-metadata-unknown`, `identity-conflict`, `context-invalid`,
  `unsafe-path`, `head-changed`, `dirty-tree` 등은 조사 이유이지 state 변경 명령이 아닙니다.
- Preflight는 `.omx/state`, notepad, checkpoint, 전역 설정을 쓰거나 정리하지 않습니다. 자동 실행/dispatch 권한도 없습니다.

## Portable handoff

로컬 context 파일이 있다고 다른 clone/기기가 재개할 수 있는 것은 아닙니다. 장기 결정과 불변 조건은 기존 policy/architecture
문서에, 구현·검증 evidence는 PR/테스트/CI에, 미해결 작업은 기존 Issue에 둡니다. 필요한 경우 outcome, acceptance,
evidence 링크, blocker와 다음 행동만 이 owner들에 연결합니다. raw plan/transcript/checkpoint 전체를 추적하지 않습니다.

로컬 기억이 없으면 tracked code/contract/test와 Issue/PR에서 재구성합니다. 필요한 portable evidence가 없으면 gap으로
명시하고 재조사하며, 결과를 바꾸는 중요한 결정이 빠졌을 때만 질문합니다. 과거 답변이나 pointer만으로 채우지 않습니다.

## Bounded checkpoint

Checkpoint는 다음 경우에만 만듭니다.

- context가 compaction에 가까움
- session interruption이나 handoff 직전
- multi-phase 작업의 commit/stage 경계를 완료함
- 다른 session이 즉시 이어받아야 함

내용은 [Agent execution contract](./agent-execution-contract.md)의 handoff schema를 따릅니다. 일반 turn마다 만들지
않으며 완료 시 priority pointer를 비웁니다. tracked 문서나 commit으로 승격된 context snapshot은 제거할 수 있습니다.

## Active plan lifecycle

- `.omx/plans/` root에는 authoring handoff와 active plan만 둡니다.
- 완료 상태는 changed files, verification, commit/stage state와 blocker를 가리켜야 합니다.
- 현재 결정할 수 없는 provider/account/domain/instance 값은 tracked readiness/evidence handoff로 옮깁니다.
- 완료 plan은 `finished/YYYY/MM/<domain>/`으로 이동하고 current priority에서 제거합니다.

## Closeout

작업 종료 시 plan과 notepad를 진행 결과처럼 보고하지 않습니다. 실제 파일 변경, 검증 결과와 blocker를 보고하고 active
runtime을 닫습니다. local state가 tracked source of truth를 대신하지 않게 정리합니다.

`omx_wiki/`는 명시적으로 승격한 재사용 지식만 소유합니다. 세션 종료 메타데이터는 repository
`.omx-config.json`의 `wiki.autoCapture: false`로 자동 생성하지 않으며, `session-log-*.md`는 Git 방어선에서도
제외합니다.
