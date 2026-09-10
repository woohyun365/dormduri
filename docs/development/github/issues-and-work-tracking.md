# Issues and work tracking

GitHub Issue는 repository 밖의 대화나 세션이 끝나도 유지되어야 하는 **durable work item**을 소유합니다. Commit과 PR은
구현·review·integration evidence를 소유하고, Issue는 outcome, acceptance, blocker, dependency와 completion lifecycle을
소유합니다.

## Issue를 만드는 경우

- 독립적으로 실행 가능한 defect, feature, refactor, performance 또는 documentation outcome
- 현재 PR에서 제외하기로 결정한 `independent-follow-up`
- blocked work, cause, owner, unblock evidence와 revisit trigger가 있는 blocker
- provider·release·account decision처럼 다음 세션이나 외부 상태 변경까지 살아 있어야 하는 handoff
- sub-issue, dependency, Milestone 또는 이후 assignment가 필요한 작업

다음은 Issue로 만들지 않습니다.

- transient local diagnostic, raw log 또는 한 세션 안에서만 유효한 메모
- 모든 plan Phase, commit 또는 테스트 실패를 기계적으로 변환한 항목
- 현재 evidence나 revisit trigger가 없는 speculative idea
- 같은 bounded PR에서 이미 구현과 acceptance까지 완료된 작업

## Work item contract

`work-item.yml`은 다음 정보를 최소 입력으로 받습니다.

- Outcome: 한 가지 사용자·운영·개발 결과
- Acceptance: 완료를 증명할 observable evidence
- Non-scope: 현재 Issue가 소유하지 않는 인접 작업
- Evidence: current code, policy, test, incident 또는 사용자 요청
- Dependency/follow-up: predecessor, successor 또는 related Issue

Issue title이나 긴 본문만으로 구현 권한을 추론하지 않습니다. 구현은 current repository와 authority를 다시 확인하고
fresh `dev` 기반 bounded branch에서 시작합니다.

효과가 불확실한 사용자-facing 결과에는 기존 Outcome·Acceptance·Evidence로 가설, 관찰 방법, 관측 결과와
keep/change/stop 결정을 연결합니다. 미래 관찰은 owner·trigger·필요 evidence가 있는 follow-up으로 남기며, 미관측 이익이나
production success를 만들지 않습니다. [Lifecycle 예시](../agent-workflows/development-lifecycle.md#verification과-value-validation)처럼
수동 관찰도 가능하고 모든 기술 변경에 analytics나 별도 Issue form을 요구하지 않습니다.

## 이어받을 work item 찾기

- 요청에 지정한 Issue가 있으면 현재 본문·최신 결정 댓글·연결 PR을 우선 확인한다. 없으면 GitHub Issues에서 open 상태,
  기존 area/type label과 outcome 키워드로 범위를 좁힌다. Shell-capable session은 아래처럼 `gh`로 조회하며, no-shell
  session은 [인증·접근 owner](./authentication-and-operator-access.md)의 Connector 경로를 따른다.
- 검색 결과의 full title·outcome·AC·dependency·완료 근거를 대조한다. 번호/최근 수정일/`open` 표시만으로 진행 순서를
  추측하지 않는다. 후보가 여러 개이고 현재 요청으로 구별되지 않으면 Owner에게 다음 outcome을 확인한다.
- 댓글은 원래 결정을 무조건 덮는 지시가 아니다. 같은 작업의 승인된 decision delta인지 source·authority·시점과 함께
  확인한다. closed 또는 superseded 항목은 연결된 후속 work item과 종료 근거를 읽고, 과거 작업을 자동 재개하지 않는다.
- 조회 실패/불완전한 검색은 결과 없음과 다르다. 최신 remote 상태를 확인하지 못했다고 보고하고 접근 또는 필요한
  sanitized 본문을 요청한다. 권한을 넓히거나 archived conversation에서 작업 순서를 추정하지 않는다.

```bash
gh issue list --repo <owner/repository> --state open --label area:api --limit 50
gh issue view <number> --repo <owner/repository> --comments
```

실제 검색 범위·조회 시점을 기록하고 limit에 도달하면 필요한 owner 범위에서만 추가 조회한다. 이 명령은 수동/agent의
bounded read 예시이며 매 prompt마다 실행하는 자동 검색이나 repo-wide backlog dump가 아니다.

여러 후속 작업의 맥락을 인계할 필요가 있으면 적합한 기존 Issue를 재사용하거나 **execution handoff/index Issue 하나**에
연결한다. 각 단위의 전체 이름·outcome·결정·AC·non-scope·source/test·dependency·실행 순서·완료/보류 조건을 보존한다.
동일 선행자를 공유해도 별도 검증·rollback·PR 경계를 합치지 않는다. 단위마다 Issue나 plan 원문을 기계적으로 복제하지
않으며, 독립 assignment/lifecycle 추적이 실제로 필요해질 때 기존 단위를 별도 work item으로 연결한다.

Index가 언제 닫히는지도 명시한다. 게시 완료와 하위 구현 완료는 별개이고, 조건부 단위는 trigger/Owner/evidence와
미활성 disposition을 남긴다. 작은 PR 하나로 전체 index를 `Closes`하지 않는다. 개인 archive 경로·ignored 원문·비밀값 없이도
다음 작업을 이해할 수 있게 source commit permalink와 검증/결정 근거를 연결한다. 새 상태 저장소나 label taxonomy는 만들지 않는다.

## Blocker contract

`blocker.yml`은 다음을 명시합니다.

- Blocked work: 진행할 수 없는 현재 outcome
- Cause: missing authority, dependency, external state 또는 재현 가능한 defect
- Owner: unblock evidence를 확인할 책임자나 repository owner
- Unblock evidence: 다시 시작할 수 있음을 증명할 구체적 결과
- Revisit trigger: 날짜가 아니라 확인 가능한 상태 변경을 우선 사용

Blocker에는 기존 `status:blocked` label을 사용합니다. 원인이 해결되면 원래 work item을 갱신하고, blocker는 final evidence와
함께 닫습니다. 단순히 어렵거나 시간이 오래 걸린다는 이유로 blocker를 만들지 않습니다.

## Dependency와 completion

- 하나의 outcome 안에서 별도 acceptance가 필요한 하위 작업은 GitHub sub-issue로 연결할 수 있습니다.
- 현재 work가 독립 선행 조건에 의존하면 predecessor Issue/PR을 연결하고 현재 작업을 blocked로 표시합니다.
- 현재 결과 없이도 가치가 유지되는 후속 작업은 successor 또는 related Issue로 연결합니다.
- `dev` 대상 PR은 `Refs #N` 또는 Development sidebar로 연결하며 자동 종료를 약속하지 않습니다.
- `main` 대상 promotion PR은 promoted tree에 Issue의 전체 acceptance가 있을 때만 `Closes #N`을 사용합니다.
- development-only outcome을 `dev`에서 끝내기로 했다면 owner가 final verification comment를 남기고 수동 종료합니다.
- 하나의 broad promotion PR이 참조한 모든 Issue를 무조건 닫지 않습니다.

## Label 책임

기존 type, area, scope, priority, `status:blocked`, `qa:atdd`, dependency 관련 label을 재사용합니다. 상태 표현을 위해 새로운
label taxonomy를 만들지 않습니다. Issue form은 outcome 정보를 수집하고, 실제 label 선택은 current owner가 repository의
기존 label 중에서 수행합니다.

## Scheduling adoption trigger

Issues와 dependency link가 기본 scheduling surface입니다.

새 outcome 또는 blocked handoff 전에는 진행 중인 결과, review backlog, dependency부터 확인합니다. Child 수나 backlog의
모든 계획을 active WIP로 세지 않으며, 기존 [scope disposition](./branch-and-pr-strategy.md#scope-drift-disposition)으로
인접 작업을 분리합니다. 반복된 실패/재작업은 현재 PR에서 해결하면 그곳에 evidence를 남기고, 독립 후속이면 Issue의
Evidence/follow-up에 `관측 → 한 가지 수정 → 효과 확인 조건 → keep/revise/drop`을 연결합니다. 별도 회고 ledger는 만들지 않습니다.

- 세 개 이상의 Issue 또는 PR이 하나의 **dated release**나 public delivery target을 공유할 때 Milestone을 사용합니다.
- 다섯 개보다 많은 active **independently scheduled** work item이 동시에 존재하고 owner·date·dependency를 filtered Issue와
  Milestone만으로 이해하기 어려울 때 GitHub Projects 도입을 검토합니다.
- 한 명의 maintainer와 하나의 active bounded outcome만 있는 상태에서는 sprint board, roadmap field, D-n label을 만들지
  않습니다.

현재 repository의 GitHub Projects는 비활성 상태가 정상입니다. 이 trigger가 충족되기 전에는 provider 설정을 바꾸지
않습니다.

## Human-team trigger

현재는 한 명의 human maintainer가 diff와 CI evidence를 검토합니다. 반복적으로 production area를 소유하는 두 번째 human
contributor가 생기면 CODEOWNERS와 non-author approval을 검토합니다. Agent review는 semantic evidence를 제공할 수 있지만
human approval을 충족한 것으로 기록하지 않습니다.
