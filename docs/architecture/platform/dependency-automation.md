# Dependency automation architecture

## 책임

이 문서는 pnpm monorepo의 dependency version-update owner, catalog·manifest·lockfile 경계와 provider 선택 근거를
설명한다. 일상적인 승인·PR·장애 복구 절차는
[Dependency update operations](../../development/github/dependency-updates.md), Hosted App의 권한·데이터·철회 경계는
[Hosted Renovate provider boundary](../../development/github/renovate-provider-readiness.md)가 소유한다.

## 현재 구조

```text
Mend-hosted Renovate (base branch: dev)
├── npm manager
│   ├── pnpm catalog + workspace manifests + one lockfile
│   ├── nine minor/patch owner groups
│   ├── unsupported TypeScript/@eslint majors disabled
│   └── pnpm package-manager upgrade remains manual (root + CI setup input)
├── github-actions manager (full commit SHA + version comment)
├── dockerfile + docker-compose managers (tag@sha256 digest)
├── security updates from GitHub vulnerability alerts
├── security·patch·minor·Docker digest: Renovate self-merge after CI summary
└── major: Dependency Dashboard approval (a security fix opens at once), human review

GitHub Dependabot
└── vulnerability alerts only
```

한 version-update surface에 두 updater를 동시에 활성화하지 않는다. `renovate.json`은 npm, `github-actions`,
`dockerfile`, `docker-compose` manager를 활성화하고 `dev`를 base branch로 사용한다. `.github/dependabot.yml`은 두지 않고
저장소 Settings의 Dependabot security updates는 끈다. Repository policy는 ecosystem마다 owner가 0개이거나 2개인 상태를
모두 거부한다.

Renovate와 Dependabot은 기본 branch(`main`)의 설정을 읽는다. `useBaseBranchConfig: "merge"`는 `dev` base branch에
`dev`의 `renovate.json`을 합쳐 적용하므로, 이 설정이 `main`에 올라간 뒤의 `dev` 설정 변경은 승격 없이 효력을 갖는다.
`.github/dependabot.yml` 삭제와 manager 추가처럼 기본 branch 설정이 정하는 변경은 `dev` → `main` 승격 뒤에 효력을
갖는다.

## pnpm catalog와 lockfile 결정

Catalog는 Next·React·TypeScript·Storybook·Vitest처럼 함께 움직여야 하는 버전의 단일 source of truth다. Provider 편의를
위해 버전을 각 package manifest에 중복하거나 workspace를 분리하지 않는다.

Renovate npm update는 다음 변경만 허용한다. Image·workflow update는 그 image나 action을 pin한 owner 파일만 바꾼다.

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
| TypeScript ESLint | 8.69.0                                    | parser·plugin·meta package를 같은 owner group으로 검증                                            |
| Node type         | 24.13.3                                   | Node 24 runtime line과 일치                                                                       |
| SWC resolution    | `@swc/core` 1.16.2, `unplugin-swc` 1.5.11 | lockfile exact-candidate와 API compiler boundary 검증                                             |
| staged-file gate  | lint-staged 17.4.1                        | Node/Git engine과 partial-stage·failure rollback 계약 검증                                        |
| formatter         | Prettier 3.9.6                            | formatter-only migration과 repository-wide format 검증을 분리해 지원선 전환                       |
| compiler          | TypeScript 6.0.3                          | TypeScript 7은 ESLint ecosystem 호환 전까지 Issue #335가 소유                                     |
| package manager   | pnpm 11.24.0                              | 11.7.0 대비 동일 cold lockfile workload peak RSS 43.4% 감소와 frozen install 검증                 |

Web framework가 소유하는 `eslint-config-next`는 lint-tooling group에서 분리한다. Formatter는 Prettier CLI가 소유하며
ESLint 안에서 동일 formatting 책임을 중복 실행하는 `eslint-plugin-prettier`는 두지 않는다.

## Update grouping과 승인 경계

npm minor/patch update는 현재 owner boundary에 따라 다음 group으로 나눈다.

- `lint-tooling`
- `web-framework`
- `web-test-storybook`
- `api-framework`
- `api-persistence`
- `api-runtime`
- `api-observability`
- `shared-contract`
- `api-test-tooling`

Image와 workflow update는 다음 group으로 나눈다.

- `actions-minor-patch`: GitHub Actions minor/patch. 커밋 제목은 `ci(deps):`를 쓴다.
- `postgres-image`, `node-image`: 여러 파일이 공유하는 PostgreSQL·Node image의 minor/patch/digest
- `observability-images`: `infra/observability/**` Compose image의 minor/patch/digest

Image tag와 digest는 owner 파일(Dockerfile·Compose·workflow) 하나가 소유하고 `infra/image-inventory.json`은 image 이름,
owner 파일, repository만 소유한다. CI는 bot이 갱신하는 version·digest 값을 복제하지 않고 pin 형식과 owner 일치만
검사한다([CI README](../../development/ci/README.md)).

Major update는 group에 섞지 않고 Dependency Dashboard 승인 뒤에 독립 PR로 연다. 취약점을 고치는 version이 major뿐이면
security update PR은 Renovate `vulnerabilityAlerts` 기본값(`dependencyDashboardApproval: false`)대로 승인 없이 열리고,
major 규칙이 자동 merge를 막아 사람이 검토한다. TypeScript 7과 현재 ESLint toolchain이 지원하지 않는 major는
compatibility revisit 조건이 충족될 때까지 config에서 차단한다.

## 자동 merge 경계

Security·patch·minor update와 Docker image digest update는 Renovate가 직접 `dev`에 squash merge한다(`automergeType:
"pr"`, `platformAutomerge: false`). Renovate는 required check `CI summary`가 통과하고 `dev`에 최신인 branch만 merge하고,
`dev`가 움직이면 branch를 rebase해 CI를 다시 돈다. GitHub 자동 merge는 뒤처진 branch를 다시 검사하지 않고 merge할 수
있어 쓰지 않는다. GitHub Actions digest update(같은 tag가 다른 commit을 가리킴)와 major update는 사람이 검토한다.
자동 merge 규칙은 `packageRules` 맨 앞에 둔다. Renovate는 일치하는 규칙을 순서대로 모두 적용하고 뒤 규칙이 이기므로 한
group 규칙에 `automerge: false`를 두면 그 group만 멈춘다. Policy test가 이 순서를 단언한다.

Patch·minor는 `minimumReleaseAge` 3일을 기다린다. Security update는 Renovate 기본값대로 release 대기·schedule·일반 PR 한도를 건너뛰고
`vulnerabilityAlerts.prConcurrentLimit`이 동시 PR 수를 제한한다. `dev` → `main` 승격과 production 배포는 사람이 하고, 승격
PR은 Owner가 확인한 head SHA로만 merge한다.

Mend Portal은 Dependency Updates ON, Silent mode OFF, Automated PRs ON, Require config file ON, Create onboarding PRs OFF를
운영값으로 사용한다. 저장소 Settings의 Allow auto-merge는 OFF로 둔다. Renovate는
[Dependency Dashboard](https://github.com/woohyun365/dormduri/issues/353)를 갱신하고 major 후보는 owner가 체크한 것만 PR로
만든다. `create all`은 사용하지 않는다.

자동 merge를 멈출 때는 merge를 하는 Renovate를 멈춘다. Mend Portal Dependency Updates를 OFF로 하거나 GitHub App을
Suspend하고, 계속 멈출 group은 `renovate.json`에서 그 group의 `automerge`를 끄는 사람 PR로 바꾼다. 이미 merge된 PR은 revert
PR로 되돌린다.

## 검증된 provider 경계

2026-08-24 기준 실제 hosted path에서 다음을 확인했다.

| 경계                | 증거                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| selected repository | `mend/renovate` App이 `woohyun365/dormduri` 하나에 설치됨                        |
| active extraction   | Renovate 44.39.0이 `dev`의 npm package file 7개와 dependency 133개를 추출        |
| grouping            | owner별 bounded group과 독립 major 후보 생성                                     |
| blocked updates     | TypeScript 7, `@eslint/js` 10, pnpm package-manager branch가 생성되지 않음       |
| approval model      | Dashboard #353의 선택되지 않은 후보는 branch·PR을 만들지 않음                    |
| real branch         | PR #354가 `renovate/web-test-storybook`에서 `dev`로 생성됨                       |
| canonical diff      | `pnpm-workspace.yaml`과 `pnpm-lock.yaml`만 변경됨                                |
| correctness         | PR #354의 Shared·API·Web·Infra·repository policy·CI summary 통과                 |
| reconciliation      | merge 후 사용한 approval과 branch가 제거되고 Dashboard가 남은 후보를 다시 계산함 |

원본 hosted job log는 Git으로 추적하지 않는 `.artifacts/tools/dependency-automation/`에 둔다. 재현 가능한 account-free
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

Hosted provider나 한 manager를 중단할 때 기본 branch 설정에 owner가 없는 ecosystem이나 두 updater가 겹치는 ecosystem을
만들지 않는다.

1. Mend Portal에서 Automated PRs와 Dependency Updates를 중단해 Renovate 실행과 자동 merge를 먼저 멈춘다. Renovate 전체를
   철회하면 같은 날 저장소 Settings의 Dependabot security updates를 다시 켜 보안 PR owner를 복원한다.
2. 필요하면 GitHub App repository access를 Suspend 또는 제거한다.
3. 하나의 `dev` PR에서 그 manager 끄기(전체면 `renovate.json.enabled=false`)와 그 ecosystem의 `.github/dependabot.yml`
   block 복원을 함께 수행한다.
4. Repository policy와 full CI를 통과시키고 그 PR을 `dev` → `main` 승격으로 기본 branch에 올린다. Dependabot 설정은 기본
   branch에서만 효력을 갖는다. Bot이 갱신하는 값을 복제하지 않는 구조 검사 test는 되돌리지 않는다.
5. 승격 뒤 Renovate를 다시 켜고, Renovate가 만든 열린 branch·PR은 provenance를 확인한 뒤 정리한다.

## Revisit triggers

- Hosted App permission·event·retention 범위가 승인 baseline을 벗어난다.
- Dashboard 수동 승인 비용이 반복적으로 실제 update 가치보다 커진다.
- Renovate가 한 ecosystem의 PR을 두 주기 넘게 만들지 못한다.
- 같은 package의 security PR이 일주일에 두 번 넘게 merge되거나, 자동 merge된 PR이 `dev`를 깬다. 그 group의 자동 merge를
  끈다.
- Bot PR 하나가 merge까지 rebase로 CI를 세 번 넘게 다시 돌거나 생성부터 merge까지 일주일을 넘긴다.
- pnpm catalog 또는 lockfile update semantics가 변경된다.
- pnpm CLI와 Corepack·CI action을 원자적으로 갱신할 owner boundary가 마련된다.
- Provider job이 반복적으로 timeout되거나 branch/lockfile이 비결정적으로 생성된다.
- 현재 pnpm pin이 동일 cold workload에서 fix floor보다 10% 넘게 memory regression을 보이거나 hosted lockfile OOM signature가
  서로 다른 bounded owner group에서 다시 발생한다.
