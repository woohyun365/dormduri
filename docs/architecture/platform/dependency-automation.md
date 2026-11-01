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
│   ├── ESLint core pair major: one eslint-major approval line
│   └── pnpm package-manager: one approval line for every update type (root + CI setup input)
├── github-actions manager (full commit SHA + version comment)
├── dockerfile + docker-compose managers (tag@sha256 digest)
├── nodenv manager (.node-version, node-image group with the Docker Node image)
├── security updates from GitHub vulnerability alerts
├── security·patch·minor·Docker digest: Renovate self-merge after CI summary
└── major: Dependency Dashboard approval (a security fix opens at once), human review

GitHub Dependabot
└── vulnerability alerts only
```

한 version-update surface에 두 updater를 동시에 활성화하지 않는다. `renovate.json`은 npm, `github-actions`,
`dockerfile`, `docker-compose`, `nodenv` manager를 활성화하고 `dev`를 base branch로 사용한다. `.github/dependabot.yml`은
두지 않고 저장소 Settings의 Dependabot security updates는 끈다. Repository policy는 ecosystem마다 owner가 0개이거나
2개인 상태를 모두 거부한다. `nodenv`(`.node-version`)는 대응하는 Dependabot ecosystem이 없어 Renovate가 유일한 owner다.

Renovate와 Dependabot은 기본 branch(`main`)의 설정을 읽는다. Renovate는 `useBaseBranchConfig: "merge"`로 `dev` base
branch를 처리할 때 `main` 설정 위에 `dev`의 `renovate.json`을 합친다. 합치는 방식은 option마다 다르다.

- `enabledManagers`처럼 dependency 처리에 쓰는 mergeable이 아닌 option은 `dev` 값이 `main` 값을 바꾼다. 그래서 manager
  추가는 `dev` merge 뒤 Renovate 실행부터 효력을 갖고, `nodenv`의 `.node-version`도 그때부터 Dashboard Detected
  Dependencies에 보인다.
- `packageRules`처럼 mergeable인 배열은 `main` 규칙 뒤에 `dev` 규칙을 이어 붙이고, 같은 key는 뒤 규칙의 값이 이긴다. `dev`에서
  더한 규칙과 `dev` 규칙이 다시 정하는 값은 바로 효력을 갖는다. `dev`에서 지운 규칙의 값은 그 key를 다시 정하는 `dev` 규칙이
  없을 때만(예: `enabled: false`, 지운 group의 `groupName`) `main` 사본이 계속 적용되어 `dev` → `main` 승격 뒤에 효력을
  갖는다. 지운 group 규칙의 `automerge: false`처럼 다른 `dev` 규칙(minor·patch `automerge: true`)이 다시 정하는 값은 `dev` merge
  직후 바뀐다.
- Base branch 목록(`baseBranchPatterns`)은 합친 뒤 기본 branch 값으로 되돌리고, Dependency Dashboard는 기본 branch 설정으로
  만든다. 이런 repository 수준 설정은 승격 뒤에 효력을 갖는다.
- `.github/dependabot.yml` 삭제처럼 Dependabot 설정은 기본 branch에서만 효력을 갖는다.

## pnpm catalog와 lockfile 결정

Catalog는 Next·React·TypeScript·Storybook·Vitest처럼 함께 움직여야 하는 버전의 단일 source of truth다. Provider 편의를
위해 버전을 각 package manifest에 중복하거나 workspace를 분리하지 않는다.

Renovate npm update는 다음 변경만 허용한다. Image·workflow update는 그 image나 action을 pin한 owner 파일만 바꾼다.

- `pnpm-workspace.yaml`의 catalog·override
- dependency를 직접 소유한 `package.json`
- canonical `pnpm-lock.yaml`

기존 semver range가 새 버전을 이미 허용하면 manifest는 바뀌지 않고 lockfile resolution만 갱신될 수 있다. 이는 누락이
아니라 정상적인 inline dependency no-change 결과다. pnpm CLI 자체는 lockfile format, CI action, cold lockfile
benchmark와 함께 검토해야 하므로 일반 dependency group에서 자동 갱신하지 않는다. Root `packageManager`가 pnpm
version을 소유한다. CI의 `pnpm/action-setup` `version` 입력은 같은 exact version을 적고 test가 대조한다.
`pnpm-package-manager` group은 두 표면의 모든 update type을 한 Dashboard 승인 줄·한 branch로 묶는다. 승인과 merge는
사람이 한다. Provider-independent dry-run fixture는 root `packageManager`를 읽으므로 version을 따로 적지 않는다.
Node 26에는 Corepack이 없으므로 Docker image와 restore drill은 root `packageManager` 값을 읽어 npm으로 설치하며
version을 따로 적지 않는다.

pnpm pin은 업데이트 신규성만으로 고르지 않는다. 같은 workspace와 lockfile-only command를 isolated cache/store에서
세 번씩 실행한 cold comparison(2026-10-30)에서 이전 pin 11.24.0은 median 1.94 GB, 12.x memory-fix floor 12.15.0은
1.09 GB, release-age-eligible 12.16.1은 1.15 GB(최대 1.19 GB) peak RSS를 기록했다. 12.16.1은 floor 대비 10%
regression 한도 안에 있고 11.24.0보다 40.6% 낮다. 측정은 macOS arm64에서 `/usr/bin/time -l`로 pnpm command 하나의
peak RSS를 잰 값이라 Mend-hosted Linux container의 memory 사용량이나 3.0 GB ceiling 여유를 직접 보여 주지 않고, 같은
host에서 version끼리 비교한 상대 신호다. pnpm 12는 Node로 실행되지 않는 native binary라
`toolSettings.nodeMaxMemory`가 pnpm을 제한하지 않으므로, merge 전 memory 신호는 이 비교의 peak RSS뿐이다. 이 실험은
package-manager owner가 자동 dependency group과 분리되어야 하는 이유를 보여 준다. 11.x 시기의 비교(11.7.0 3.42 GB,
11.15.1 2.18 GB, 11.24.0 1.93 GB)와 hosted OOM의 전체 과정·제약·disposition은
[Mend-hosted Renovate pnpm lockfile OOM](../../development/troubleshooting/tooling/renovate-pnpm11-hosted-oom.md)이
소유한다.

## 검증된 runtime·tooling 지원선

Repository가 직접 검증한 지원선은 다음과 같다. 행마다 검증 시점이 다르며, runtime·framework 행은 지원 종료 일정과
다음 전환 trigger를 함께 적는다.

| 책임              | 지원선                                                                  | 결정 근거                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node runtime      | Node 26 LTS(`.node-version` patch)                                      | local·CI·Docker를 한 줄로 검증; `.node-version`과 Docker Node image patch는 `node-image` group이 한 PR로 옮긴다(두 datasource의 숙성 시각이 달라 한쪽이 잠깐 앞설 수 있고, policy test는 major만 대조한다); maintenance 2027-10-20, EOL 2029-04-30; Node 27 LTS 시작(2027-10-20)이 전환 plan trigger                               |
| backend framework | NestJS 12.3.2                                                           | API unit·integration·e2e와 lifecycle hook 순서 test 검증; NestJS는 지원 종료 일정을 발표하지 않으므로 NestJS 13 stable release가 전환 plan trigger                                                                                                                                                                                 |
| ESLint core       | 9.39.5                                                                  | shared/API lint와 전체 CI 통과; ESLint 10은 `eslint`·`@eslint/js` pair의 `eslint-major` Dashboard 승인 줄로 보이고, plugin peer support가 완성되면 승인해 fresh migration으로 옮긴다                                                                                                                                               |
| TypeScript ESLint | 8.69.0                                                                  | parser·plugin·meta package를 같은 owner group으로 검증                                                                                                                                                                                                                                                                             |
| Node type         | 26.6.5                                                                  | Node 26 runtime line과 일치                                                                                                                                                                                                                                                                                                        |
| SWC resolution    | `@swc/core` 1.16.20, `unplugin-swc` 2.0.0                               | lockfile exact-candidate와 API compiler boundary 검증                                                                                                                                                                                                                                                                              |
| staged-file gate  | lint-staged 17.4.1                                                      | Node/Git engine과 partial-stage·failure rollback 계약 검증                                                                                                                                                                                                                                                                         |
| formatter         | Prettier 3.9.6                                                          | formatter-only migration과 repository-wide format 검증을 분리해 지원선 전환                                                                                                                                                                                                                                                        |
| compiler          | TypeScript 6.0.3                                                        | TypeScript 7은 일반 major Dashboard 승인 줄로 보이고, ESLint ecosystem 호환이 확인되면 승인해 fresh migration으로 옮긴다                                                                                                                                                                                                           |
| package manager   | pnpm 12(root `packageManager`)                                          | 11.24.0 대비 동일 cold lockfile workload median peak RSS 40.6% 감소와 frozen install 검증; `pnpm-package-manager` 승인 줄이 root와 CI 입력을 함께 옮긴다; pnpm 13 출시나 hosted Renovate의 pnpm 12 설치·lockfile 실패가 재검토 trigger                                                                                             |
| container base OS | Debian 13 trixie(`node:<patch>-trixie-slim`)                            | API·Web·ingress fixture image build, API ready·SIGTERM, Web `GET /`, native load(sharp·Prisma adapter-pg·`@node-rs/argon2`)를 arm64 local smoke로 검증(amd64는 production 배포 전 release rehearsal에서 확인); 정규 보안 지원 2028-08-09, LTS 2030-06-30; Debian 14 release 뒤 Node 공식 slim 기본이 바뀌는 것이 전환 plan trigger |
| CI runner         | GitHub 표준 `ubuntu-<YY.MM>`(product job), `ubuntu-slim`(orchestration) | 모든 PR CI가 검증; 현재 label은 workflow `runs-on`이 소유; 새 Ubuntu LTS label은 Dashboard major 승인 줄로 두고 쓰는 label의 deprecation 공지가 승인 기한 trigger다; runner 단언과 단가는 구조 검사라 label 전환 PR이 test를 고치지 않는다                                                                                         |

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
- `postgres-image`, `node-image`: 여러 파일이 공유하는 PostgreSQL·Node image의 minor/patch/digest. `node-image`는
  `.node-version`(nodenv, `node-version` datasource)도 같은 PR로 옮긴다. CI `actions/setup-node`의 `node-version` 입력은
  major(`26`)만 적고 `github-releases` datasource로 추출되어 이 group에 들지 않는다. Node 27 major는 일반 major 승인
  규칙이 받는다.
- `observability-images`: `infra/observability/**` Compose image의 minor/patch/digest

Image tag와 digest는 owner 파일(Dockerfile·Compose·workflow) 하나가 소유하고 `infra/image-inventory.json`은 image 이름,
owner 파일, repository만 소유한다. CI는 bot이 갱신하는 version·digest 값을 복제하지 않고 pin 형식과 owner 일치만
검사한다([CI README](../../development/ci/README.md)).

Major update는 group에 섞지 않고 Dependency Dashboard 승인 뒤에 독립 PR로 연다. 예외는 함께 움직여야 하는 ESLint core
pair 하나다. `eslint-major` group이 `eslint`·`@eslint/js` major를 한 승인 줄·한 branch(`renovate/major-eslint-major`)로
묶는다. Update type으로 major를 고르는 group은 이것뿐이고 policy test가 다른 이름·package·manager를 거부한다.
`pnpm-package-manager` group은 update type을 가리지 않고 pnpm의 모든 update를 한 승인 줄로 묶으므로 이 major 예외와
다르다. 취약점을 고치는 version이 major뿐이면 security update PR은 Renovate `vulnerabilityAlerts`
기본값(`dependencyDashboardApproval: false`)대로 승인 없이 열리고, major 규칙이 자동 merge를 막아 사람이 검토한다.
현재 toolchain이 지원하지 않는 major(TypeScript 7, ESLint 10)도 config에서 끄지 않고 승인 줄로 남긴다. 호환 조건이
충족되면 Owner가 승인해 fresh migration으로 옮긴다.

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

위 표는 2026-08-24 config 기준이다. 지금은 TypeScript 7, ESLint core pair, pnpm package-manager update를 차단하지 않고
Dashboard 승인 줄로 보인다.

원본 hosted job log는 Git으로 추적하지 않는 `.artifacts/tools/dependency-automation/`에 둔다. 재현 가능한 account-free
lookup과 canonical lockfile rehearsal은 `pnpm dependency:renovate:dry-run`과 `scripts/dependencies/`가 소유한다.

## Provider-independent 검증

Credential 없이 실행하는 dry-run은 두 경계를 결합한다.

1. Renovate local platform `lookup`
   - catalog와 API/Web inline dependency 후보를 추출한다.
   - owner group과 Dashboard 승인 대기 후보(major와 `pnpm-package-manager` 승인 줄)를 가른다.
   - branch가 없는 후보, 곧 비활성 규칙이 숨긴 update가 있으면 실패한다.
2. canonical pnpm artifact rehearsal
   - lookup에서 승인된 target만 임시 workspace에 적용한다.
   - `pnpm install --lockfile-only --ignore-scripts`를 두 번 실행한다.
   - 두 번째 lockfile hash가 같아야 통과한다.

Local platform은 branch 생성을 지원하지 않으므로 이 검증은 hosted App을 대체하지 않는다. Provider permission 없이
config·package-manager correctness를 빠르게 회귀 검증하기 위한 보조 경계다. Dry-run은 checkout의 `renovate.json` 하나만
읽고 기본 branch 설정과 합치지 않는다. 그래서 `dev`에서 지웠지만 승격 전 `main`에 남은 규칙(예: `enabled: false`)이 hosted
후보를 숨기는 기간은 dry-run이 통과해도 [현재 구조](#현재-구조)의 합치는 방식으로 판단한다.

Renovate CLI는 `engines.node`를 `^24.11.0`으로만 선언하고, 그 밖의 Node에서는 "Unsupported node environment" error를
남긴 뒤 non-zero로 끝난다. 그래서 Renovate가 Node 26을 선언할 때까지 local dry-run은 Node 24 runtime으로 실행한다(예:
`fnm exec --using=24 pnpm dependency:renovate:dry-run`). Lockfile 작업은 PATH의 pnpm 12 native binary가 맡으므로 hosted
Renovate와 같은 조합이다. Hosted Renovate는 Mend runtime의 Node로 실행되어 이 제약을 받지 않는다.

- [Renovate useBaseBranchConfig](https://docs.renovatebot.com/configuration-options/#usebasebranchconfig)
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
- Renovate가 root `packageManager`와 CI `pnpm/action-setup` `version` 입력을 한 `pnpm-package-manager` branch로 묶지
  못한다(다른 depType으로 추출되는 등).
- Renovate가 `useBaseBranchConfig: "merge"`의 합치는 방식(`enabledManagers`는 `dev` 값으로 바꾸고, `packageRules`는 `main`
  규칙 뒤에 이어 붙이고, `baseBranchPatterns`는 기본 branch 값으로 되돌림)을 바꾼다. [현재 구조](#현재-구조)의 효력 시점 서술을
  다시 확인한다.
- Renovate CLI가 `engines.node`에 Node 26을 선언한다. Local dry-run의 Node 24 실행 안내를 지운다.
- Provider job이 반복적으로 timeout되거나 branch/lockfile이 비결정적으로 생성된다.
- 현재 pnpm pin이 동일 cold workload에서 fix floor보다 10% 넘게 memory regression을 보이거나 hosted lockfile OOM signature가
  서로 다른 bounded owner group에서 다시 발생한다.
