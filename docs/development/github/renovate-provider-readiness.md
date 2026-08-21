# Hosted Renovate provider readiness

## 책임과 현재 상태

이 문서는 Mend가 운영하는 Renovate GitHub App을 이 저장소에 연결하기 전에 repository owner가 검토할 권한·데이터 처리·운영·철회 경계를 소유한다.

현재 상태는 **CONDITIONAL GO / Scan Only 설치 완료 / repository activation 대기**다.

- Local cutover branch의 `renovate.json`은 `enabled: true`이며 Dependabot npm block이 함께 제거됐다.
- Default `main`에 cutover가 병합되기 전 원격 npm version update owner는 Dependabot이다.
- 2026-08-20 repository owner가 GitHub에서 `Only select repositories`로 `woohyun365/knu_roommate`에 Renovate App을
  설치했다. GitHub installations UI에 Renovate가 표시된다.
- Mend Developer Portal onboarding은 Renovate Only + Scan Only로 완료됐다.
- Default `main`에는 비활성 `renovate.json`이 존재한다. 이 kill switch를 유지한 상태에서 초기 provider job과 config
  log를 먼저 검증한다.

PR #349는 2026-08-20 `main`에 merge됐고 `origin/main:renovate.json`의 `enabled=false`, npm-only manager, `dev` base,
no-automerge가 확인됐다. 현재 Portal의 실제 mode 선택지는 `Scan Only` / `Scan and Alert`다. Initial onboarding은
`Scan Only`로 완료해 provider repository/config/log를 먼저 검증하고, alert/update 활성화는 별도 cutover evidence 뒤에
재검토한다.

Mend Portal repository row의 initial evidence는 `IAC: Disabled`, `Renovate: Enabled`, `Renovate Status: disabled`다. 이는
Renovate-only product 연결은 완료됐지만 repository config의 `enabled=false`가 update engine을 차단하는 기대 상태다. IaC
engine은 이 범위에서 활성화하지 않는다. Mode activation 뒤에는 Portal의 canonical engine terminology인 `Silent` 또는
`Interactive`와 repository config 상태를 함께 확인한다.

- 로컬 lookup과 pnpm artifact rehearsal만 통과했다.
- Repository owner는 현재 공식 App manifest와 provider 문서를 기준으로 설치 GO를 결정하고 selected repository 하나에
  App을 설치했다. 두 initial Recent jobs가 `DONE`으로 종료됐지만 로그 내용은 아직 검토하지 않았으며, Scan and Alert와
  repository `enabled=true` 활성화는 수행하지 않았다.
- 두 initial job log는 Renovate `44.33.2`, exact `main` commit `489e5c9a`, repository config load, config migration 불필요,
  Warn/Error/Fatal 부재, 기대한 `disabled-by-config` 종료를 독립적으로 확인했다. `enabled=false`이므로 dependency
  extraction·lookup·PR 생성은 수행되지 않았으며 repository cutover 후 Scan Only 증거가 여전히 필요하다.
- Local cutover branch에서는 `renovate.json.enabled=true`와 Dependabot npm block 제거가 하나의 변경 단위로 구현됐다.
  `dev`와 `main` 병합 전에는 원격 owner가 바뀌었다고 간주하지 않으며 Portal은 Scan Only로 유지한다.

## 설치 후보와 freshness 확인

공식 후보는 GitHub App [`mend/renovate`](https://github.com/apps/renovate)이며 다른 이름의 app이나 개인 PAT 기반 bot으로 대체하지 않는다.

설치 검토 직전에 다음 read-only 명령을 실행한다.

```bash
pnpm dependency:renovate:provider-preflight
```

이 명령은 `gh api /apps/renovate` 결과를 현재 baseline과 비교하고 `artifacts/local/dependency-automation/renovate-provider-preflight.json`에 기록한다. App identity, permission, webhook event가 달라지면 owner 판단 전에 실패한다. 설치·suspend·uninstall·repository 설정 변경은 수행하지 않는다.

## 현재 요청 권한

2026-08-20 GitHub App manifest 기준이다. GitHub 설치 화면이 아래와 다르면 **NO-GO**로 중단하고 문서와 baseline을 먼저 재검토한다.

| Permission        | Level | App이 설명하는 용도와 검토 위험                                                                              |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| Administration    | read  | branch protection과 repository 설정 확인; repository 관리 쓰기 권한은 없어야 한다                            |
| Checks            | write | update branch status/check 작성                                                                              |
| Contents          | write | dependency branch와 manifest/lockfile commit 생성; 가장 핵심적인 source write 권한                           |
| Issues            | write | Dependency Dashboard와 config warning 관리                                                                   |
| Pull requests     | write | update PR 생성·갱신·종료                                                                                     |
| Commit statuses   | write | Renovate branch status 작성                                                                                  |
| Workflows         | write | workflow dependency 갱신 지원을 위한 broad 권한; 현재 npm-only config라도 app installation 권한에는 포함된다 |
| Dependabot alerts | read  | vulnerability update 후보 확인                                                                               |
| Packages          | read  | GitHub Packages metadata 접근 가능성; 현재 저장소는 private registry credential이 필요하지 않다              |
| Members           | read  | team/reviewer resolution 등에 사용될 수 있는 organization metadata                                           |
| Email addresses   | read  | 사용자가 Mend App dashboard에 로그인하며 별도 user authorization을 할 때 요청될 수 있다                      |
| Metadata          | read  | GitHub App 필수 repository metadata                                                                          |

Write 권한은 `checks`, `contents`, `issues`, `pull_requests`, `statuses`, `workflows`다. Hosted App의 고정 permission을 repository가 임의로 축소할 수 없으므로 **Only select repositories → `woohyun365/knu_roommate` 하나만 선택**하는 것이 기본 containment다.

현재 event baseline:

- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review_comment`
- `push`
- `repository`

## 데이터 처리 경계

Renovate 공식 security guidance가 공개한 Hosted App 동작은 다음과 같다.

- 작업 중 source code를 임시 clone하지만 job 완료 후 source clone을 보관하지 않는다고 설명한다.
- App database에는 repository별 dependency·version 목록과 Renovate가 만든 PR의 기본 정보가 남는다.
- package 사용과 update 성공률을 익명화·집계해 Merge Confidence에 사용한다.
- Hosted App 사용자는 Mend Terms of Service와 Privacy Policy의 적용을 받는다.
- GitHub Actions에서 실행되지 않으며 Actions secret 전체를 읽는 구조를 요구하지 않는다. Private registry credential이 필요할 때는 별도 Mend credential 경계가 필요하지만 현재 저장소에는 추가하지 않는다.

공식 자료:

- [Renovate Security and Permissions](https://docs.renovatebot.com/security-and-permissions/)
- [Installing and onboarding Renovate](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [Mend Terms of Service](https://www.mend.io/terms-of-service/)
- [Mend Privacy Policy](https://www.mend.io/privacy-policy/)
- [Mend Legal Center](https://www.mend.io/legal-center/)

공개 자료만으로 이 GitHub App edition의 **숫자로 고정된 dependency metadata/job log 보존 기간**을 확정하지 않는다. 설치 승인자는 Legal Center의 최신 retention 자료와 실제 Developer Portal의 log 접근 범위를 확인하고, 명시적 기간이 없다는 사실까지 포함해 수용 여부를 결정해야 한다.

## Current owner decision

Repository owner는 공식 Hosted App의 동작을 최대한 유연하게 따르는 방향으로 다음을 승인했다.

- installation scope는 selected repository 하나로 제한한다.
- 2026-08-20 baseline과 일치하는 현재 permission·event manifest를 수용한다.
- 설치 시점의 최신 Terms of Service와 Privacy Policy revision을 다시 확인하고 수용한다.
- temporary source clone, dependency/version·PR metadata 저장, anonymized aggregate Merge Confidence 사용을 수용한다.
- 숫자로 고정된 보존 기간이 공개되지 않았더라도 현재 provider-managed retention/log 정책을 수용한다.
- operator와 revoke owner는 `woohyun365`로 둔다.
- private registry credential, lifecycle script, plugin은 활성화하지 않는다.
- Renovate 활성화와 Dependabot npm block 제거는 하나의 repository 변경 단위로 유지하고, 활성 Scan Only 검증 전에는
  Portal을 Scan and Alert로 전환하지 않는다.

이 결정은 설치를 시작할 수 있는 GO이며 설치 완료 증거가 아니다. 다음 항목은 설치 직전에 반드시 재확인한다.

- App identity와 permission/event manifest에 drift가 없는지
- `Only select repositories`에 이 저장소 하나만 선택했는지
- Terms/Privacy revision이 검토한 범위를 벗어나지 않는지
- dashboard job log에 operator가 접근할 수 있는지
- Suspend·Uninstall control을 owner가 실제로 사용할 수 있는지

어느 하나라도 예상과 다르면 GO는 자동으로 무효화되고 NO-GO로 전환한다.

## Owner decision checklist

아래 증거가 전부 확인되기 전에는 GO가 아니다.

### Repository scope

- [ ] 설치 화면에서 `Only select repositories`를 선택했다.
- [ ] 선택 목록에 `woohyun365/knu_roommate` 하나만 존재한다.
- [ ] App owner가 `mend`, slug가 `renovate`다.
- [ ] preflight permission/event drift가 없다.

### Terms, privacy, and data

- [ ] 검토 시점의 Terms of Service와 Privacy Policy revision을 기록했다.
- [ ] temporary source clone과 job 후 삭제 설명을 수용했다.
- [ ] dependency/version 및 Renovate PR metadata 저장을 수용했다.
- [ ] anonymized aggregate Merge Confidence 사용을 수용했다.
- [ ] dependency metadata와 job log의 보존·삭제·열람 조건을 수용했다.

### Operator and recovery

- [ ] GitHub App installation owner를 기록했다.
- [ ] Mend dashboard에 로그인할 operator와 email authorization 여부를 기록했다.
- [ ] repository access 변경, Suspend, Uninstall을 수행할 owner를 기록했다.
- [ ] provider outage 동안 npm update를 manual batch로 수행할 owner를 기록했다.
- [ ] Renovate 활성화와 Dependabot npm block 제거가 같은 변경 단위이며 zero/dual owner policy가 통과한다.

## GO / NO-GO

### GO

다음 조건을 모두 만족할 때만 실제 설치 작업으로 넘긴다.

- preflight가 `ready-for-owner-review`이고 permission/event drift가 없다.
- selected repository 하나만 접근하도록 확인했다.
- permission 표의 read/write 범위를 owner가 명시적으로 수용했다.
- Terms·Privacy·source/metadata 처리·retention/log 접근을 수용했다.
- operator와 suspend/uninstall owner가 정해졌다.
- 현재 저장소에 private registry secret이나 script/plugin 실행이 필요하지 않다.

### NO-GO

다음 중 하나라도 발생하면 App을 설치하지 않는다.

- All repositories 또는 예상 외 organization 접근만 허용된다.
- 새로운 permission/event가 추가되었거나 level이 강화되었다.
- source clone 삭제, metadata 저장, aggregate 사용, retention/log 조건을 수용할 수 없다.
- 예상 외 private registry credential, plugin, lifecycle script 실행이 필요하다.
- dashboard/job log를 필요한 operator가 확인할 수 없거나 revoke owner가 없다.
- App identity가 `mend/renovate`와 다르다.

NO-GO에서도 현재 CI와 manual npm dependency update는 계속 동작해야 한다. 자체 hosted bot이나 장기 PAT를 즉시 대안으로 도입하지 않는다.

## Installation and revoke handoff

GO가 명시적으로 기록된 뒤의 설치 세션은 다음 순서를 따른다.

1. preflight를 다시 실행한다.
2. GitHub App 설치 화면에서 effective permission을 다시 읽는다.
3. `Only select repositories`로 이 저장소 하나만 선택한다.
4. 설치 직후 repository access와 operator를 기록한다.
5. `renovate.json` 활성화와 Dependabot npm block 제거를 하나의 repository PR로 수행한다.
6. 실제 `dev` 대상 catalog/inline 후보와 lockfile capability가 Scan Only에서 검증되기 전에는 Portal을 Scan and Alert로
   전환하지 않는다.

긴급 중단 순서:

1. GitHub **Settings → Applications → Installed GitHub Apps → Renovate → Configure**에서 repository access를 제거하거나 **Suspend**한다.
2. 필요하면 App을 **Uninstall**한다.
3. dashboard user authorization을 별도로 부여했다면 Authorized GitHub Apps에서도 철회한다.
4. `renovate.json` 비활성화와 Dependabot npm block 복원을 하나의 rollback 변경으로 수행한다.
5. 생성된 branch/PR은 provenance를 확인한 뒤 개별 close한다.

GitHub는 installed App의 permission 확인, repository scope 수정, Suspend/Uninstall을 별도 관리 화면에서 제공한다: [Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps).
