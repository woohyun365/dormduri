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
