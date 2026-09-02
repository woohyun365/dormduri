# Dependency update operations

## 책임

이 문서는 GitHub에서 dependency update 후보를 승인하고 PR을 검토·병합·복구하는 일상 절차를 소유한다. Provider 선택
근거는 [Dependency automation architecture](../../architecture/platform/dependency-automation.md), App permission과 revoke
경계는 [Hosted Renovate provider boundary](./renovate-provider-readiness.md)를 따른다.

## Owner map

| Ecosystem                     | Owner                  | Target |
| ----------------------------- | ---------------------- | ------ |
| npm/pnpm dependency versions  | Mend-hosted Renovate   | `dev`  |
| GitHub Actions                | Dependabot             | `dev`  |
| Docker images                 | Dependabot             | `dev`  |
| Docker Compose images         | Dependabot             | `dev`  |
| pnpm package-manager/Corepack | Manual reviewed change | `dev`  |

## Routine Renovate flow

1. [Dependency Dashboard #353](https://github.com/woohyun365/knu_roommate/issues/353)을 연다.
2. Pending/Running provider job과 open Renovate PR이 없는지 확인한다.
3. 한 owner group만 체크한다.
4. `Create all pending approval PRs at once`와 독립 major는 체크하지 않는다.
5. Dashboard edit webhook이 job을 시작하지 않으면 Mend Portal에서 Run Renovate Scan을 한 번 실행한다.
6. 생성된 PR의 author, base, head, files, version 범위를 읽는다.
7. Required CI와 stability-days가 모두 green인지 확인한다.
8. Squash merge하고 Dashboard가 approval과 branch를 제거했는지 확인한다.

Automated PRs는 운영 비용과 compatibility failure rate가 측정될 때까지 OFF를 유지한다. Dashboard issue는 Renovate가
추가·제거·병합된 후보를 자동으로 갱신하므로 수동으로 close하거나 본문을 재작성하지 않는다.

## PR review checklist

```bash
gh pr view <number> --json author,baseRefName,headRefName,files,commits,statusCheckRollup
gh pr diff <number> --patch
gh pr checks <number>
```

- Author가 `app/renovate` / commit author `renovate[bot]`인가?
- Base가 `dev`, head가 `renovate/<bounded-owner>`인가?
- Catalog, owning manifest, lockfile 밖의 unrelated file이 없는가?
- Lockfile diff가 approved package group과 transitive resolution으로 설명되는가?
- Major, pnpm package-manager, blocked compiler update가 섞이지 않았는가?
- Shared·API·Web·Infra·repository policy와 CI summary가 모두 통과했는가?
- Production dependency라면 release note, runtime behavior, migration 필요성을 별도로 검토했는가?

기존 semver range가 새 minor/patch를 이미 허용하면 manifest가 바뀌지 않고 lockfile만 달라질 수 있다. 이를 강제로
manifest diff로 만들지 않는다.

## Dashboard controls

- Group checkbox: 해당 branch를 다음 job에서 승인한다.
- `Create all ...`: 사용하지 않는다.
- Manual job checkbox: queue가 비어 있을 때만 한 번 사용한다.
- Silent mode: incident나 installation 검증용 scan-only 경계다.
- Automated PRs: 충분한 운영 증거 전에는 OFF다.

Checkbox를 선택해도 job이 실행되기 전까지 branch와 PR은 생성되지 않는다. Portal job이 장시간 pending이면 반복
클릭하지 않고, Silent mode에서 manual scan 한 번으로 provider path를 분리 검증한다.

Approved job이 pnpm lockfile command를 시작한 뒤 completion 없이 `kernel-out-of-memory`로 끝나면 compatibility 실패로
처리하지 않는다. [Mend-hosted Renovate pnpm 11 OOM](../troubleshooting/tooling/renovate-pnpm11-hosted-oom.md)의 한 번의
bounded resource retry와 exact-candidate fallback을 따른다.

## Merge 후 확인

1. PR merge commit이 `origin/dev`에 반영됐는지 확인한다.
2. Open Renovate PR과 remote branch를 확인한다.
3. Dashboard에서 사용한 approval이 제거됐는지 확인한다.
4. 같은 dependency를 갱신하는 Dependabot npm PR이 없는지 확인한다.
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

현재 retained selector 집합은 Renovate owner fixture가 exact contract로 검증한다. 병합 뒤 한 번의 Mend scan에서 제거된
selector 후보가 Dashboard에서 사라졌는지 확인하되, provider 결과가 source·lockfile 검증을 대신하지 않는다. Parent가
지원하지 않는 major 후보는 체크하지 않고 fresh bounded migration으로 넘긴다.

## Existing non-npm Dependabot PRs

Actions·Docker·Compose PR은 Renovate npm cutover와 중복이 아니다. 각각의 owner boundary에서 release note와 runtime
compatibility를 확인한다. PostgreSQL local/rehearsal처럼 같은 runtime version을 공유하는 PR은 함께 분석하되, 독립된
ecosystem PR을 npm update와 묶지 않는다.

## Provider outage와 rollback

일시적인 provider queue 지연에서는 npm Dependabot을 다시 활성화하지 않는다. 필요한 update는 fresh `dev` 기반 manual
branch에서 catalog·manifest·lockfile을 하나의 change로 갱신하고 전체 CI를 통과시킨다.

지속적인 provider 중단 또는 permission 변경으로 Renovate를 철회할 때만 다음 atomic rollback을 사용한다.

1. Portal Dependency Updates를 중단한다.
2. App을 Suspend 또는 repository access에서 제거한다.
3. 하나의 PR에서 Renovate kill switch와 Dependabot npm owner 복원을 함께 수행한다.
4. Zero/dual owner repository policy와 full CI를 확인한다.
5. Provider branch·PR을 정리한다.

Provider 장애를 이유로 개인 PAT 기반 bot이나 repository-owned lifecycle engine을 즉시 도입하지 않는다.

## pnpm package-manager 변경

pnpm CLI는 Renovate owner group checkbox로 승인하지 않는다. Root `packageManager`, Corepack/CI reference, lockfile semantics와
cold-resolution memory가 하나의 compatibility unit이기 때문이다. 변경 시 현재 pin, upstream memory-fix floor와 최신
release-age-eligible stable candidate를 동일한 isolated cache/store workload로 비교하고 exit status, wall time, peak RSS를
기록한다. Local 결과가 좋아도 hosted provider recovery로 간주하지 않으며, default branch 반영 후 한 번의 Mend scan에서
lockfile command completion을 별도로 확인한다.

현재 검증 pin은 `pnpm@11.24.0`이다. 재현 가능한 비교는 `pnpm dependency:pnpm:cold-benchmark`를 사용하며, 결과 artifact는
`artifacts/local/dependency-automation/`에만 둔다. 이 benchmark는 dependency update를 승인하거나 provider credential을
사용하지 않으며 disposable workspace만 변경한다.

Local RSS 감소와 full CI 성공은 repository compatibility 증거이지 hosted recovery 증거가 아니다. Main 반영 후
수동 scan이 소비되었더라도 승인된 exact candidate의 paired lockfile completion과 branch/PR이 없으면 provider
materialization을 `GO`로 기록하지 않는다. 이 경우 동일 scan을 반복하지 않고 terminal `NO-GO`로 닫은 뒤,
첫 안전한 미래 owner-group candidate가 그 시점의 재평가를 소유하게 한다.
