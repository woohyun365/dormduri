# Dependency update operations

## 책임

이 문서는 GitHub에서 dependency update 후보를 승인하고 PR을 검토·병합·복구하는 일상 절차를 소유한다. Provider 선택
근거는 [Dependency automation architecture](../../architecture/platform/dependency-automation.md), App permission과 revoke
경계는 [Hosted Renovate provider boundary](./renovate-provider-readiness.md)를 따른다.

## Owner map

| Ecosystem                       | Owner                                               | Target |
| ------------------------------- | --------------------------------------------------- | ------ |
| npm/pnpm dependency versions    | Mend-hosted Renovate                                | `dev`  |
| GitHub Actions                  | Mend-hosted Renovate                                | `dev`  |
| Docker images(Dockerfile)       | Mend-hosted Renovate                                | `dev`  |
| Docker Compose images           | Mend-hosted Renovate                                | `dev`  |
| Security updates(alert 기반 PR) | Mend-hosted Renovate                                | `dev`  |
| Vulnerability alerts            | Dependabot(alert 전용)                              | 없음   |
| pnpm package-manager            | Mend-hosted Renovate(Dashboard 승인 줄, 사람 merge) | `dev`  |
| `.node-version`(nodenv)         | Mend-hosted Renovate                                | `dev`  |

두 bot은 기본 branch(`main`)의 설정을 읽는다. Dependabot 쪽(`.github/dependabot.yml` 삭제)은 `dev` → `main` 승격으로
기본 branch에 올라간 뒤 효력을 갖는다. Renovate 쪽은 [base branch 설정 합치기](../../architecture/platform/dependency-automation.md#현재-구조)를
따른다. manager 추가(`.node-version` 행)는 `dev` merge 뒤에 효력을 갖는다. `dev`에서 지운 `packageRules` 값은 다른 `dev` 규칙이
다시 정하지 않으면 승격 뒤에 효력을 갖는다.

## Routine Renovate flow

1. Renovate가 non-major update(npm owner group, GitHub Actions, image)와 security update PR을 직접 연다. Patch·minor는 release
   뒤 3일을 기다린다.
2. Security·patch·minor PR과 Docker image digest PR은 `CI summary`가 통과하고 `dev`에 최신이면 Renovate가 squash merge한다.
   `dev`가 움직이면 Renovate가 branch를 rebase하고 CI가 다시 돈다. 사람은 이 PR을 merge하지 않는다.
3. Major와 pnpm 승인 줄은 [Dependency Dashboard #353](https://github.com/woohyun365/dormduri/issues/353)에서 한 후보만 체크해
   PR을 연다. pnpm은 아래 [pnpm package-manager 변경](#pnpm-package-manager-변경)의 비교를 먼저 한다.
   `Create all pending approval PRs at once`는 체크하지 않는다. 취약점을 고치는 version이 major뿐인 security update PR은
   승인 없이 바로 열린다.
4. Major PR과 GitHub Actions digest PR(같은 tag가 다른 commit을 가리킴)은 아래 checklist로 읽고 사람이 squash merge한다.
5. CI가 실패한 bot PR은 자동 merge되지 않는다. Bot branch에 사람 commit을 더하지 않고, 호환성 수정은 fresh `dev` 기반 branch에서
   한다. 실패 원인이 bot이 갱신한 값을 복제한 test면 [CI README](../ci/README.md)의 기준대로 test를 구조 검사로 바꾼다.
6. Dashboard edit webhook이 job을 시작하지 않으면 Mend Portal에서 Run Renovate Scan을 한 번 실행한다.

Mend Portal Automated PRs의 운영값은 ON이다(목표와 마지막 확인 값은
[Remote repository settings](./remote-repository-settings.md)). Dashboard issue는 Renovate가 추가·제거·병합된 후보를 자동으로 갱신하므로 수동으로
close하거나 본문을 재작성하지 않는다.

### npm owner groups

| Group                | 책임                                                           |
| -------------------- | -------------------------------------------------------------- |
| `lint-tooling`       | repository lint, formatter, compiler와 local developer tooling |
| `web-framework`      | Web framework, rendering과 browser UI runtime                  |
| `web-test-storybook` | Web test, Storybook과 Vite test toolchain                      |
| `api-framework`      | NestJS framework, platform adapter와 Nest test/CLI tooling     |
| `api-persistence`    | Prisma CLI/client/adapter와 PostgreSQL driver/type             |
| `api-runtime`        | API provider, config, security, logging과 realtime runtime     |
| `api-observability`  | API metric client와 observability runtime                      |
| `shared-contract`    | Shared contract schema dependencies used by Web and API        |
| `api-test-tooling`   | API HTTP test client와 corresponding type packages             |

Dashboard에서 여러 group이 같은 작업처럼 보여도 framework, persistence, observability, shared contract와 test tooling을
한 PR로 다시 합치지 않는다. 각 group은 독립된 review·rollback·verification clock을 가진다.

### Workflow·image groups

| Group                  | 책임                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `actions-minor-patch`  | GitHub Actions minor/patch(full commit SHA와 version 주석을 함께 갱신) |
| `postgres-image`       | local·CI·rehearsal이 공유하는 PostgreSQL image                         |
| `node-image`           | API·Web runtime과 fixture가 공유하는 Node image와 `.node-version`      |
| `observability-images` | `infra/observability/**` Compose image                                 |

Image tag와 digest는 owner 파일 하나가 소유한다. `infra/image-inventory.json`은 image 이름, owner 파일, repository만
기록하므로 image PR이 inventory를 바꾸지 않는다.

## PR review checklist

```bash
gh pr view <number> --json author,baseRefName,headRefName,files,commits,statusCheckRollup
gh pr diff <number> --patch
gh pr checks <number>
```

- Author가 `app/renovate` / commit author `renovate[bot]`인가?
- Base가 `dev`, head가 `renovate/<bounded-owner>`인가?
- Catalog, owning manifest, lockfile, image·workflow owner 파일 밖의 unrelated file이 없는가?
- GitHub Actions digest PR이면 같은 tag가 가리키는 새 commit을 upstream release·tag 이력에서 확인했는가?
- Lockfile diff가 approved package group과 transitive resolution으로 설명되는가?
- Major와 pnpm 승인 줄 update가 다른 group update와 섞이지 않았는가?
- Shared·API·Web·Infra·repository policy와 CI summary가 모두 통과했는가?
- Production dependency라면 release note, runtime behavior, migration 필요성을 별도로 검토했는가?

기존 semver range가 새 minor/patch를 이미 허용하면 manifest가 바뀌지 않고 lockfile만 달라질 수 있다. 이를 강제로
manifest diff로 만들지 않는다.

## Dashboard controls

- Major·pnpm checkbox: 해당 branch를 다음 job에서 승인한다. pnpm은 cold lockfile 비교 뒤에만 체크한다.
- `Create all ...`: 사용하지 않는다.
- Manual job checkbox: queue가 비어 있을 때만 한 번 사용한다.
- Silent mode: incident나 installation 검증용 scan-only 경계다.
- Automated PRs: 운영값 ON. 자동 merge는 security·patch·minor와 Docker image digest PR만 한다.

Checkbox를 선택해도 job이 실행되기 전까지 branch와 PR은 생성되지 않는다. Portal job이 장시간 pending이면 반복
클릭하지 않고, Silent mode에서 manual scan 한 번으로 provider path를 분리 검증한다.

Approved job이 pnpm lockfile command를 시작한 뒤 completion 없이 `kernel-out-of-memory`로 끝나면 compatibility 실패로
처리하지 않는다. [Mend-hosted Renovate pnpm lockfile OOM](../troubleshooting/tooling/renovate-pnpm11-hosted-oom.md)의 한 번의
bounded resource retry와 exact-candidate fallback을 따른다.

## 자동 merge 멈춤

merge를 하는 것은 Renovate뿐이므로 Renovate를 멈춘다.

1. Mend Portal Dependency Updates를 OFF로 하거나 GitHub App을 Suspend한다.
2. `gh api repos/woohyun365/dormduri --jq .allow_auto_merge`가 `false`인지 확인한다. GitHub에 걸린 자동 merge가 없다는
   뜻이다. Allow auto-merge OFF만으로는 Renovate 자체 merge가 멈추지 않는다.
3. 계속 멈출 group은 `renovate.json`에서 그 group의 `automerge`를 `false`로 바꾸는 사람 PR을 `dev`에 merge한 뒤 Renovate를
   다시 켠다. 이미 merge된 PR은 revert PR로 되돌린다.

## Merge 후 확인

1. PR merge commit이 `origin/dev`에 반영됐는지 확인한다.
2. Open Renovate PR과 remote branch를 확인한다.
3. Dashboard에서 사용한 approval이 제거됐는지 확인한다.
4. 같은 dependency를 갱신하는 Dependabot PR이 남아 있지 않은지 확인한다.
5. `dev → main` promotion은 제품 release/integration cadence에 따라 별도 green PR로 수행한다.

## Transitive override lifecycle

Root `pnpm-workspace.yaml` override는 일반적인 dependency update 수단이 아니라, 현재 parent package의 declared range만으로
안전한 버전을 선택할 수 없을 때 쓰는 임시 경계다. Dashboard에 더 높은 버전이 보인다는 이유만으로 transitive major를
강제하지 않는다.

1. lockfile과 parent manifest에서 실제 owner와 declared range를 확인한다.
2. selector를 먼저 제거하고 current package-manager로 lockfile을 재생성한다.
3. 자연 해소된 버전이 security floor 이상이며 parent range 안인지 확인한다.
4. 가장 가까운 runtime/build/test regression을 실행한다.
5. 제거가 불가능할 때만 같은 major의 최소 안전 버전을 유지한다.
6. 유지 selector에는 owner, mitigation, 제거 trigger를 security fixture와 workspace 주석에 남긴다.

현재 retained selector와 해결된 version 하한은 dependency-health fixture와 security test가 검증한다. Renovate가 override
값을 올리는 것은 허용하고, 하한 미만 version과 고친 취약 version의 재등장을 막는다. 병합 뒤 한 번의 Mend scan에서 제거된
selector 후보가 Dashboard에서 사라졌는지 확인하되, provider 결과가 source·lockfile 검증을 대신하지 않는다. Parent가
지원하지 않는 major 후보는 체크하지 않고 fresh bounded migration으로 넘긴다.

## Alert inventory 점검

Renovate [SECURITY] PR은 direct dependency만 고치므로 transitive alert는 사람이 확인한다. Dependency security owner가 월
1회, 그리고 Renovate 보안 PR이 merge되지 않거나 실패할 때 `pnpm security:dependabot:inventory`를 실행한다.

- 분류 ledger(`scripts/security/fixtures/dependency-alert-classification.json`)에 없는 package가 있으면 script가 그 package를
  모두(alert 수·최고 severity) 적고 실패한다. 각 package를 정책 3절 상태로 분류해 ledger에 더한 뒤 다시 실행한다.
- High·critical alert는 owner와 `unknown`이 아닌 분류가 있어야 통과한다. Patch가 없는 alert는 정책 5절 예외 필드를 ledger
  `mitigation`·`revisit`에 둔다.
- 열린 alert가 없는 분류는 `staleClassifications`로 출력되고 실패가 아니다. Alert는 기본 branch 기준이므로, 승격 뒤 기본
  branch에서 닫힘을 확인한 다음 retained override·예외의 근거가 아닌 항목을 지운다.
- 월 1회 점검 때 [날짜 snapshot 재확인](../../README.md#날짜-snapshot-재확인) 대상 문서의 마지막 확인일도 본다.

## 남은 Dependabot PR

`.github/dependabot.yml` 삭제가 승격으로 기본 branch에 올라가면 Dependabot은 version update PR을 더 열지 않는다. 이미 열린
Dependabot PR은 같은 변경의 Renovate PR이 merge되거나 생긴 뒤 댓글과 함께 닫는다. PostgreSQL local/rehearsal처럼 같은
runtime version을 공유하는 image는 `postgres-image` group 하나로 함께 갱신되고, image PR을 npm update와 묶지 않는다.

## Provider outage와 rollback

일시적인 provider queue 지연에서는 Dependabot version update를 다시 활성화하지 않는다. 필요한 update는 fresh `dev` 기반
manual branch에서 owner 파일(catalog·manifest·lockfile 또는 image·workflow)을 하나의 change로 갱신하고 전체 CI를
통과시킨다.

지속적인 provider 중단 또는 permission 변경으로 Renovate를 철회할 때만 다음 atomic rollback을 사용한다.

1. Portal Dependency Updates를 중단한다.
2. App을 Suspend 또는 repository access에서 제거한다.
3. 하나의 `dev` PR에서 Renovate kill switch(또는 그 manager 끄기)와 그 ecosystem의 Dependabot owner 복원을 함께 수행한다.
   Renovate 전체를 철회하면 저장소 Settings의 Dependabot security updates도 다시 켠다.
4. Zero/dual owner repository policy와 full CI를 확인하고 그 PR을 승격으로 기본 branch에 올린다.
5. Provider branch·PR을 정리한다.

Provider 장애를 이유로 개인 PAT 기반 bot이나 repository-owned lifecycle engine을 즉시 도입하지 않는다.

## pnpm package-manager 변경

pnpm CLI는 일반 owner group에 섞지 않는다. Root `packageManager`, CI reference, lockfile semantics와 cold-resolution
memory가 하나의 compatibility unit이기 때문이다. `pnpm-package-manager` group이 root `packageManager`와
`pnpm/action-setup`의 `version` 입력(`github-actions` manager가 `pnpm` 의존성으로 읽음)의 모든 update type을 한 Dashboard
승인 줄·한 branch로 묶고 자동 merge하지 않는다. Root `packageManager`가 version을 소유하므로 다른 곳에 exact version
사본을 두지 않는다.

1. 승인 전: 현재 pin, upstream memory-fix floor와 승인 줄의 후보를 동일한 isolated cache/store workload로 비교하고 exit
   status, wall time, peak RSS를 기록한다. 재현 가능한 비교는 `pnpm dependency:pnpm:cold-benchmark`를 사용하며 결과
   artifact는 `.artifacts/tools/dependency-automation/`에만 둔다. 이 benchmark는 dependency update를 승인하거나 provider
   credential을 사용하지 않으며 disposable workspace만 변경한다.
2. 비교가 통과하면 Dashboard에서 그 줄 하나만 체크한다.
3. Renovate PR의 bot branch에 사람 commit을 더하지 않는다. CI가 통과하면 사람이 위 checklist로 리뷰하고 squash merge한다.
   CI가 실패하면 Routine flow 5번대로 fresh `dev` 기반 branch에서 고친다.
4. Hosted job이 lockfile command에서 `kernel-out-of-memory`로 끝나면 Owner가 그때 문제 해결 이슈를 만들어 처리한다.
   [Mend-hosted Renovate pnpm lockfile OOM](../troubleshooting/tooling/renovate-pnpm11-hosted-oom.md)의 기록과 fallback은
   그 이슈의 입력이다.

pnpm 12는 native binary라 `toolSettings.nodeMaxMemory`가 pnpm을 제한하지 않으므로 merge 전 memory 신호는 1번 비교의
peak RSS뿐이다. Local RSS 감소와 full CI 성공은 repository compatibility 증거이지 hosted lockfile 생성의 증거가 아니다.

## Repository formatter supported-line migration

Prettier처럼 repository 전체의 텍스트를 다시 쓰는 formatter는 일반 minor/patch 묶음과 분리합니다. 버전 입력과 그 버전이
생성한 deterministic output을 같은 rollback boundary로 검토하되, 의미 변경과 단순 출력 변경을 구별할 수 있는 증거를
먼저 고정합니다.

1. 구버전과 후보 버전의 `--list-different` 및 disposable copy의 실제 byte diff를 비교해 exact path allowlist를 고정합니다.
2. Markdown처럼 rendered meaning이 바뀔 수 있는 입력 결함은 formatter migration 전에 별도 PR로 교정합니다.
3. formatter write는 allowlist 밖 파일, generated code, migration, local artifact를 변경하면 실패시킵니다.
4. TypeScript/TSX 변경은 AST parse/printer parity, typecheck, owner test와 production build로 semantic no-op을 검증합니다.
5. dependency fingerprint가 바뀌면 이전 CI cohort를 닫고 새 measurement epoch를 엽니다.

Formatter migration은 ESLint rule 재설계나 unrelated dependency update의 운반 수단이 아닙니다. 호환성 교정, 버전 입력,
결과 포맷 diff, CI measurement epoch를 각각 독립적으로 설명할 수 있어야 합니다.
