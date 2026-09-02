# Dependency automation architecture

## 책임

이 문서는 pnpm monorepo의 dependency version-update owner, catalog·manifest·lockfile 경계와 provider 선택 근거를
설명한다. 일상적인 승인·PR·장애 복구 절차는
[Dependency update operations](../../development/github/dependency-updates.md), Hosted App의 권한·데이터·철회 경계는
[Hosted Renovate provider boundary](../../development/github/renovate-provider-readiness.md)가 소유한다.

## 현재 구조

```text
Mend-hosted Renovate
└── npm manager
    ├── pnpm catalog + workspace manifests + one lockfile
    ├── five minor/patch owner groups
    ├── Dependency Dashboard approval
    ├── independent major approval
    ├── unsupported TypeScript/@eslint majors disabled
    └── pnpm package-manager upgrade remains manual

GitHub Dependabot
├── GitHub Actions
├── Docker
├── Docker Compose
└── security alerts / security-update boundary
```

같은 npm version-update surface에 두 updater를 동시에 활성화하지 않는다. `renovate.json`은 npm manager만 활성화하고
`dev`를 base branch로 사용한다. `.github/dependabot.yml`에는 npm ecosystem을 두지 않는다. Repository policy는 npm
owner가 0개이거나 2개인 상태를 모두 거부한다.

## pnpm catalog와 lockfile 결정

Catalog는 Next·React·TypeScript·Storybook·Vitest처럼 함께 움직여야 하는 버전의 단일 source of truth다. Provider 편의를
위해 버전을 각 package manifest에 중복하거나 workspace를 분리하지 않는다.

Renovate가 승인된 group을 처리할 때 다음 변경만 허용한다.

- `pnpm-workspace.yaml`의 catalog·override
- dependency를 직접 소유한 `package.json`
- canonical `pnpm-lock.yaml`

기존 semver range가 새 버전을 이미 허용하면 manifest는 바뀌지 않고 lockfile resolution만 갱신될 수 있다. 이는 누락이
아니라 정상적인 inline dependency no-change 결과다. pnpm CLI 자체는 lockfile format, Corepack, CI action과 함께 검토해야
하므로 일반 dependency group에서 자동 갱신하지 않는다. 현재 pin은 `pnpm@11.24.0`이며 root manifest, CI setup과
provider-independent fixture가 같은 exact version을 사용한다.

11.24.0은 업데이트 신규성만으로 선택하지 않았다. 같은 workspace와 lockfile-only command를 isolated
cache/store에서 실행한 단일 cold comparison에서 11.7.0은 3.42 GB, memory-fix floor 11.15.1은 2.18 GB,
release-age-eligible 11.24.0은 1.93 GB peak RSS를 기록했다. 이 실험은 package-manager owner가 자동 dependency
group과 분리되어야 하는 이유를 보여 준다. 전체 과정·제약·hosted disposition은
[Mend-hosted Renovate pnpm 11 OOM](../../development/troubleshooting/tooling/renovate-pnpm11-hosted-oom.md)이 소유한다.

## 검증된 lint/tooling 지원선

2026-09-01 기준 repository가 직접 검증한 지원선은 다음과 같다.

| 책임              | 지원선                                    | 결정 근거                                                                                         |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ESLint core       | 9.39.5                                    | shared/API lint와 전체 CI 통과; ESLint 10은 plugin peer support가 완성될 때까지 Issue #395가 소유 |
| TypeScript ESLint | 8.68.0                                    | parser·plugin·meta package를 같은 owner group으로 검증                                            |
| Node type         | 24.13.3                                   | Node 24 runtime line과 일치                                                                       |
| SWC resolution    | `@swc/core` 1.16.1, `unplugin-swc` 1.5.11 | lockfile exact-candidate와 API compiler boundary 검증                                             |
| staged-file gate  | lint-staged 17.4.1                        | Node/Git engine과 partial-stage·failure rollback 계약 검증                                        |
| formatter         | Prettier 3.8.4                            | 3.9.6 적용 시 55개 source file churn이 발생해 dependency-only rollback 경계를 훼손하므로 보류     |
| compiler          | TypeScript 6.0.3                          | TypeScript 7은 ESLint ecosystem 호환 전까지 Issue #335가 소유                                     |
| package manager   | pnpm 11.24.0                              | 11.7.0 대비 동일 cold lockfile workload peak RSS 43.4% 감소와 frozen install 검증                 |

Web framework가 소유하는 `eslint-config-next`는 lint-tooling group에서 분리한다. Formatter는 Prettier CLI가 소유하며
ESLint 안에서 동일 formatting 책임을 중복 실행하는 `eslint-plugin-prettier`는 두지 않는다.

## Update grouping과 승인 경계

Minor/patch update는 현재 owner boundary에 따라 다음 group으로 나눈다.

- `lint-tooling`
- `web-framework`
- `web-test-storybook`
- `api-framework`
- `api-persistence`
- `api-runtime`
- `api-observability`
- `shared-contract`
- `api-test-tooling`

Major update는 group에 섞지 않고 독립 후보로 유지한다. TypeScript 7과 현재 ESLint toolchain이 지원하지 않는 major는
compatibility revisit 조건이 충족될 때까지 config에서 차단한다.

Mend Portal은 Dependency Updates ON, Silent mode OFF, Automated PRs OFF, Require config file ON, Create onboarding PRs OFF를
기본 운영값으로 사용한다. 따라서 Renovate가 [Dependency Dashboard](https://github.com/woohyun365/knu_roommate/issues/353)를
자동 갱신하지만, owner가 체크한 한 group만 branch와 PR로 만든다. 자동 merge와 `create all`은 사용하지 않는다.

## 검증된 provider 경계

2026-08-24 기준 실제 hosted path에서 다음을 확인했다.

| 경계                | 증거                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| selected repository | `mend/renovate` App이 `woohyun365/knu_roommate` 하나에 설치됨                    |
| active extraction   | Renovate 44.39.0이 `dev`의 npm package file 7개와 dependency 133개를 추출        |
| grouping            | owner별 bounded group과 독립 major 후보 생성                                     |
| blocked updates     | TypeScript 7, `@eslint/js` 10, pnpm package-manager branch가 생성되지 않음       |
| approval model      | Dashboard #353의 선택되지 않은 후보는 branch·PR을 만들지 않음                    |
| real branch         | PR #354가 `renovate/web-test-storybook`에서 `dev`로 생성됨                       |
| canonical diff      | `pnpm-workspace.yaml`과 `pnpm-lock.yaml`만 변경됨                                |
| correctness         | PR #354의 Shared·API·Web·Infra·repository policy·CI summary 통과                 |
| reconciliation      | merge 후 사용한 approval과 branch가 제거되고 Dashboard가 남은 후보를 다시 계산함 |

원본 hosted job log는 Git으로 추적하지 않는 `artifacts/local/dependency-automation/`에 둔다. 재현 가능한 account-free
lookup과 canonical lockfile rehearsal은 `pnpm dependency:renovate:dry-run`과 `scripts/dependencies/`가 소유한다.

## Provider-independent 검증

Credential 없이 실행하는 dry-run은 두 경계를 결합한다.

1. Renovate local platform `lookup`
   - catalog와 API/Web inline dependency 후보를 추출한다.
   - owner group과 차단된 major를 확인한다.
2. canonical pnpm artifact rehearsal
   - lookup에서 승인된 target만 임시 workspace에 적용한다.
   - `pnpm install --lockfile-only --ignore-scripts`를 두 번 실행한다.
   - 두 번째 lockfile hash가 같아야 통과한다.

Local platform은 branch 생성을 지원하지 않으므로 이 검증은 hosted App을 대체하지 않는다. Provider permission 없이
config·package-manager correctness를 빠르게 회귀 검증하기 위한 보조 경계다.

- [Renovate local platform](https://docs.renovatebot.com/modules/platform/local/)
- [Renovate npm/pnpm manager](https://docs.renovatebot.com/modules/manager/npm/)

## Rollback

Hosted provider를 중단할 때 npm owner가 없는 중간 상태나 두 updater가 겹치는 상태를 만들지 않는다.

1. Mend Portal에서 Automated PRs와 Dependency Updates를 중단한다.
2. 필요하면 GitHub App repository access를 Suspend 또는 제거한다.
3. 하나의 repository PR에서 `renovate.json.enabled=false`와 Dependabot npm block 복원을 함께 수행한다.
4. Repository policy와 full CI를 통과시킨다.
5. Renovate가 만든 열린 branch·PR은 provenance를 확인한 뒤 정리한다.

## Revisit triggers

- Hosted App permission·event·retention 범위가 승인 baseline을 벗어난다.
- Dashboard 수동 승인 비용이 반복적으로 실제 update 가치보다 커진다.
- 충분한 grouped PR 성공률과 CI 비용 증거가 쌓여 Automated PRs ON이 순이익이 된다.
- pnpm catalog 또는 lockfile update semantics가 변경된다.
- pnpm CLI와 Corepack·CI action을 원자적으로 갱신할 owner boundary가 마련된다.
- Provider job이 반복적으로 timeout되거나 branch/lockfile이 비결정적으로 생성된다.
- 현재 pnpm pin이 동일 cold workload에서 fix floor보다 10% 넘게 memory regression을 보이거나 hosted lockfile OOM signature가
  서로 다른 bounded owner group에서 다시 발생한다.
