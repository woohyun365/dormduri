# Codex preflight diagnostics

[Codex adapter](./codex.md)의 reference입니다. `codex:preflight`의 resume 진단 필드와 identity·freshness·bounded read 규칙을
담습니다. 계획 재개 진단을 해석할 때 읽습니다. 진입 명령은 진입 문서의
[Repository workflow entry](./codex.md#repository-workflow-entry)가 소유합니다.

## Diagnostic contract

**Codex/OMX 전용 호환 계약**입니다. 다른 host에 이 필드·CLI·OMX 설치를 요구하지 않습니다.
`pnpm codex:preflight` 또는
`node scripts/agents/codex/session-preflight.mjs --resume --plan <repository-relative-plan> --json`이 소비합니다.
기본 탐색은 공통 reader의 `.plans`이고 자동 legacy fallback은 없습니다. 명시적 `.omx/plans/...` 선택만 과도기 읽기를 지원합니다.
Source caller 전환은 local plan 파일 이동의 완료 증거가 아니며, 이동은 별도 owner receipt로 확인합니다.

기존 CLI 옵션, `schemaVersion: 1`, `resume.plan.{path,exists}`, `contextSnapshots: string[]`와 priority 출력은 유지합니다.
Fresh 모드의 `resume`은 `null`이며 notepad나 context 본문을 읽지 않습니다. `activePlans`는 canonical `.plans`의
active 상태만 포함합니다. `planDiscovery.complete/issues`는 불완전한 탐색을 드러내며, unknown·duplicate ID·종료 상태를 active로 추천하지 않습니다.
선택한 canonical 계획은 `resume.planBinding`으로 공통 lifecycle 결과를 제공합니다. 명시적 legacy read의 binding은 null이고 불명확한 metadata는 `unknown`입니다. 과거 inventory용 `unspecified`는 더 이상 출력하지 않습니다.

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
  Canonical `.plans`는 명시적 ID가 필요합니다. Legacy 읽기에서만 Plan ID가 없을 때 파일명에서 `.md`와 말미 `-plan`을 뺀 값을 검색 힌트로 사용합니다. 잘못되거나 충돌하는 ID를
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
- 선택적 OMX 호출은 각각 5초·64 KiB로 제한합니다. PATH에 `omx` 실행 파일이 없으면 OMX 부재로 보아 `omx-unavailable`
  제한을 더하지 않고, priority 진단 이유도 `context-invalid`가 아닌 `context-missing`으로 둡니다. 설치된 OMX의
  실패·timeout·malformed·oversized 결과는 `omx-unavailable` 등으로 표시하며 정상적인 fresh 조사 자체를 차단하지
  않습니다. `plan-metadata-unknown`, `identity-conflict`, `context-invalid`, `unsafe-path`, `head-changed`,
  `dirty-tree` 등은 조사 이유이지 state 변경 명령이 아닙니다.
- Preflight는 `.omx/state`, notepad, checkpoint, 전역 설정을 쓰거나 정리하지 않습니다. 자동 실행/dispatch 권한도 없습니다.
