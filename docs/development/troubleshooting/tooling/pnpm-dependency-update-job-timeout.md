# pnpm monorepo dependency update job timeout

## 증상

- Root pnpm workspace update job이 dependency 후보를 순차 처리하다 provider 제한에서 취소된다.
- Owner group을 설정했지만 하나의 updater process 안에서 많은 `pnpm update --lockfile-only`가 반복된다.
- Job이 상당한 package lookup과 lockfile 작업을 수행하고도 PR을 완성하지 못한다.
- GitHub Actions CI가 아니라 dependency update provider job에서 발생한다.

## 원인 구분

이 저장소에서 관측된 timeout은 제품 build/test 실패가 아니었다. Root npm Dependabot job이 pnpm catalog와 80개 이상의
direct dependency를 한 process에서 반복 계산했고, group은 PR 조합만 바꿀 뿐 updater process를 owner별로 분리하지
않았다. Schedule, PR limit, group 수만 조정해도 이 계산 경로는 짧아지지 않는다.

다음과 구분한다.

- GitHub Actions API/Web job 지연: Actions run의 stage timing을 확인한다.
- Mend Portal Pending job: provider queue 상태이며 dependency calculation이 시작되지 않은 상태다.
- Renovate scan 완료 후 `needs-approval`: timeout이 아니라 Dashboard 승인 대기다.
- Lockfile conflict: branch가 만들어진 뒤 pnpm regeneration 또는 base drift에서 발생한다.
- pnpm lockfile command 시작 후 `exec completed` 없이 `kernel-out-of-memory`: queue timeout이 아니라
  [Mend Renovate pnpm 11 OOM](./renovate-pnpm11-hosted-oom.md) 경계를 따른다.

## 현재 해결 구조

- npm/pnpm, GitHub Actions, Docker, Docker Compose version update는 Renovate가 소유한다.
- Dependabot npm ecosystem을 포함한 Dependabot version update는 두지 않는다. Dependabot은 alert만 맡는다.
- Renovate는 catalog·inline dependency를 한 번 추출하고 owner group별 후보를 만든다.
- `prConcurrentLimit`·`prHourlyLimit`과 major Dashboard 승인이 CI fan-out을 제한한다.

## 진단

1. 어느 provider와 ecosystem인지 확인한다.
2. Job이 pending인지 running인지 구분한다.
3. Renovate log에서는 extraction count, lookup duration, branch result, Warn/Error/Fatal을 확인한다.
4. GitHub에서는 Dashboard approval, remote branch, open PR을 구분한다.
5. Source 변경 전 provider queue와 repository config 상태를 먼저 확인한다.

```bash
pnpm dependency:renovate:provider-preflight
pnpm dependency:renovate:dry-run
gh issue view 353
gh pr list --author app/renovate --state open
```

Raw provider log는 `.artifacts/tools/dependency-automation/`에 두고 tracked troubleshooting 문서에는 credential, raw config
dump, 개인 billing/account 정보를 복사하지 않는다.

## 복구

### Renovate job이 pending인 경우

1. 같은 job을 반복 제출하지 않는다.
2. Silent mode에서는 manual scan을 한 번 실행해 repository/provider path를 분리한다.
3. Manual scan도 pending이면 provider queue blocker로 기록하고 update activation을 보류한다.
4. Job을 재촉하려고 Portal 운영값(Automated PRs 등)을 바꾸지 않는다. Major는 Dashboard 승인 뒤에만 PR이 열린다(취약점을
   고치는 version이 major뿐인 security update PR은 승인 없이 열린다).

### Approved branch가 생성되지 않는 경우

1. Dashboard checkbox가 실제로 저장됐는지 확인한다.
2. 다음 Renovate job이 approval을 처리해야 한다는 점을 확인한다.
3. Queue가 비어 있으면 Portal scan 또는 manual-job checkbox 중 하나만 사용한다.
4. Branch base가 `dev`인지 확인한다.

### Provider를 사용할 수 없는 경우

단기에는 manual bounded update를 사용한다. 장기 철회 시에만 Renovate 비활성화와 Dependabot owner 복원을 하나의
reviewed PR로 수행한다. 한 ecosystem에 두 updater를 동시에 활성화하거나 catalog를 제거하지 않는다.

## 검증

- Renovate active scan이 bounded time 안에 npm package files와 dependencies를 추출한다.
- Owner group 하나가 `dev` 대상 PR 하나로 생성된다.
- Catalog·manifest·lockfile diff가 deterministic하다.
- 전체 CI가 통과한다.
- Merge 후 Dashboard와 branch가 자동 reconciliation된다.
