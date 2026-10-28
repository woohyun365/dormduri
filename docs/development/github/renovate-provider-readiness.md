# Hosted Renovate provider boundary

## 책임과 현재 상태

이 문서는 Mend-hosted Renovate GitHub App의 permission, data processing, operator, fail-closed 설정과 revoke 경계를
소유한다. Dependency grouping과 pnpm architecture는
[Dependency automation architecture](../../architecture/platform/dependency-automation.md), 일상 운영은
[Dependency update operations](./dependency-updates.md)를 따른다.

2026-08-24 현재 상태는 **selected-repository 설치·active extraction·controlled PR 검증 완료**다.

- App identity: GitHub App `mend/renovate`
- Repository scope: `woohyun365/dormduri` 하나
- Product: Renovate Only; IaC 비활성
- Repository config: `renovate.json.enabled=true`, npm-only, base `dev`, automerge 없음
- Portal: Dependency Updates ON, Silent mode OFF, Automated PRs OFF, Require config file ON, onboarding PR OFF
- Dashboard: [Issue #353](https://github.com/woohyun365/dormduri/issues/353)
- Verified PR: #354, `renovate/web-test-storybook` → `dev`, full CI green 후 squash merge

## Effective permission baseline

GitHub 설치 화면이 아래와 다르면 update 작업을 중단하고 App manifest와 이 문서를 먼저 재검토한다.

| Permission        | Level | 용도와 위험                                                            |
| ----------------- | ----- | ---------------------------------------------------------------------- |
| Administration    | read  | branch protection과 repository 설정 확인                               |
| Checks            | write | update branch check 작성                                               |
| Contents          | write | dependency branch와 manifest·lockfile commit 생성                      |
| Issues            | write | Dependency Dashboard와 config warning 관리                             |
| Pull requests     | write | update PR 생성·갱신·종료                                               |
| Commit statuses   | write | Renovate branch status 작성                                            |
| Workflows         | write | workflow dependency 갱신 지원; 현재 npm-only config보다 넓은 설치 권한 |
| Dependabot alerts | read  | vulnerability 후보 확인                                                |
| Packages          | read  | package metadata 접근; private registry credential은 현재 없음         |
| Members           | read  | reviewer/team resolution 가능성                                        |
| Email addresses   | read  | Mend dashboard user authorization 시 요청 가능                         |
| Metadata          | read  | GitHub App 필수 repository metadata                                    |

Current event baseline:

- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review_comment`
- `push`
- `repository`

Hosted App의 고정 permission을 repository가 세밀하게 축소할 수 없으므로 selected repository 한 개가 핵심 containment다.
설치 범위를 `All repositories`로 넓히지 않는다.

## Data processing 경계

Renovate의 공개 security guidance에 따라 다음 처리를 수용한다.

- Job 중 source를 임시 clone하고 완료 후 clone을 보관하지 않는 provider 동작
- Dependency·version 목록과 Renovate PR 기본 metadata의 provider 저장
- Package 사용과 update 결과의 익명 집계 및 Merge Confidence 활용
- Mend Terms of Service와 Privacy Policy 적용

숫자로 고정된 dependency metadata·job log 보존 기간은 공개 자료만으로 확정하지 않는다. Operator는 provider 정책 변경
또는 계약 검토 시 최신 Legal Center와 Portal log 접근 범위를 다시 확인한다. Private registry token, repository lifecycle
script, plugin은 추가하지 않는다.

공식 자료:

- [Renovate Security and Permissions](https://docs.renovatebot.com/security-and-permissions/)
- [Installing and onboarding Renovate](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [Mend Terms of Service](https://www.mend.io/terms-of-service/)
- [Mend Privacy Policy](https://www.mend.io/privacy-policy/)
- [Mend Legal Center](https://www.mend.io/legal-center/)

## Operational safety settings

| Setting                          | Expected value       | 실패 시 영향                                                        |
| -------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Dependency Updates               | ON                   | 후보 추출 중단                                                      |
| Silent mode                      | OFF                  | ON이면 Dashboard/PR 처리 없이 scan-only로 제한                      |
| Automated PRs                    | OFF                  | ON이면 승인하지 않은 compatible group이 자동 생성될 수 있음         |
| Require config file              | ON                   | OFF이면 repository config가 사라진 상황을 fail-closed로 막지 못함   |
| Create onboarding PRs            | OFF                  | 기존 tracked config 대신 불필요한 onboarding PR 생성 가능           |
| Disable Repo-level Override      | OFF                  | ON이면 tracked `renovate.json`보다 Portal override가 우선할 수 있음 |
| Base Branches / Release Branches | Portal override 없음 | tracked `baseBranchPatterns: ["dev"]` 유지                          |

Dashboard의 `Create all pending approval PRs at once`는 사용하지 않는다. Manual job checkbox 또는 Portal의 Run Renovate
Scan은 다른 Pending/Running job이 없을 때 한 번만 사용한다.

## Verification evidence

Active provider path에서 다음을 독립적으로 확인했다.

- Silent-mode scans: npm 7 files / 133 dependencies, `dev` base, no warnings/errors, branch·PR 없음
- Interactive scan: Dashboard #353 생성, 11 approval 후보, 선택되지 않은 branch 생성 없음
- One-group approval: `web-test-storybook` 하나만 선택해 PR #354 생성
- PR provenance: `renovate[bot]`, base `dev`, catalog와 lockfile만 변경
- Hosted verification: stability-days와 전체 Monorepo CI 통과
- Reconciliation: merge 후 approval과 branch 제거, Dashboard candidate 재계산
- Ownership: duplicate npm Dependabot PR 종료; Actions·Docker·Compose owner는 유지

Raw logs are local evidence under `.artifacts/tools/dependency-automation/`; tracked source에는 provider credential이나 raw
configuration dump를 저장하지 않는다.

## Freshness preflight

Permission이나 repository scope를 변경하기 전 다음 read-only command로 App identity와 manifest drift를 확인한다.

```bash
pnpm dependency:renovate:provider-preflight
```

Preflight는 `.artifacts/tools/dependency-automation/renovate-provider-preflight.json`에 secret-free 결과를 기록하며 설치,
Suspend, repository access 변경을 수행하지 않는다.

## NO-GO conditions

다음 중 하나라도 발생하면 새 approval과 PR merge를 중단한다.

- App owner/slug가 `mend/renovate`가 아니다.
- Repository access가 예상 외 저장소 또는 전체 계정으로 확장됐다.
- Permission/event가 baseline보다 강화되거나 누락됐다.
- Private registry credential, plugin, lifecycle script 실행이 새로 필요하다.
- Job log를 operator가 열람할 수 없거나 Suspend·Uninstall owner가 없다.
- Catalog·manifest·lockfile 밖의 source 변경이 dependency PR에 포함된다.
- PR base가 `dev`가 아니거나 automerge가 활성화된다.

## Suspend, uninstall, rollback

1. GitHub **Settings → Applications → Installed GitHub Apps → Renovate → Configure**에서 repository access를 제거하거나
   Suspend한다.
2. 필요하면 App을 Uninstall한다.
3. Authorized GitHub Apps에 별도 dashboard authorization이 있으면 함께 철회한다.
4. `renovate.json.enabled=false`와 Dependabot npm block 복원을 하나의 reviewed repository PR로 수행한다.
5. Repository policy와 full CI를 통과시킨다.
6. 열린 Renovate branch·PR은 provenance를 확인한 뒤 close한다.

Rollback 전후에 npm updater owner가 0개 또는 2개인 상태를 merge하지 않는다.
