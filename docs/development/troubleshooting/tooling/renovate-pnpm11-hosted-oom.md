# Mend-hosted Renovate pnpm 11 lockfile OOM

## 책임

이 문서는 Mend-hosted Renovate가 pnpm 11 workspace의 lockfile을 생성하다 kernel OOM으로 종료될 때 증상 판별, bounded
복구, local fallback과 재검토 조건을 소유한다. 일반 provider queue·approval 문제는
[pnpm dependency update timeout](./pnpm-dependency-update-job-timeout.md), 일상 dependency update 절차는
[Dependency update operations](../../github/dependency-updates.md)를 따른다.

## 관측된 증상

2026-09-01 lint-tooling owner group은 다음 경계까지 정상적으로 진행됐다.

1. npm package extraction과 owner grouping 완료
2. Dependency Dashboard approval 확인
3. base branch `dev`와 `renovate/lint-tooling` branch 생성 필요성 판정
4. 승인된 package file version 적용
5. Node 24.15.0과 pnpm 11.7.0 설치 완료
6. `pnpm install --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile` 실행 시작

마지막 명령에는 대응하는 `exec completed` record가 없고 Mend Portal은 job을 `kernel-out-of-memory`로 분류했다. 따라서
이 signature는 dependency compatibility 실패가 아니라 hosted runner에서 발생한 pnpm lockfile materialization 실패다.

같은 날 `toolSettings.nodeMaxMemory=1536`을 default branch에 반영한 뒤 한 번만 재시도했다. 재시도 log에서도 해당 설정이
실제로 로드되었지만 lockfile 명령의 completion 없이 1분 39초 만에 종료됐고, Portal은 memory `3.0 GB / 3.0 GB`, disk
`1.2 GB / 15.0 GB`를 기록했다. 따라서 bounded heap guard만으로 Mend-hosted total-memory ceiling을 해소하지 못했다.
동일 설정 재시도는 여기서 종료하고 exact-candidate local fallback으로 전환했다.

Raw provider log는 credential과 provider metadata를 포함할 수 있으므로 `artifacts/local/dependency-automation/`에만 둔다.
Tracked 문서는 stable signature와 결정만 소유한다.

## 원인 분류

- Renovate extraction, grouping, approval 또는 GitHub permission 실패가 아니다.
- package install/build/test가 시작되기 전이므로 승인된 package version의 compatibility `NO-GO`가 아니다.
- pnpm 11은 일부 큰 dependency graph의 cold resolution에서 pnpm 10보다 높은 peak memory를 사용할 수 있다.
- incident 당시 repository pin `11.7.0`은 pnpm 11.11.0과 11.15.1에 포함된 resolution-memory 개선보다 이전 버전이었다.
- Mend-hosted runner에서는 Renovate parent process, package manager child process와 OS headroom이 같은 제한을 공유한다.
- Node heap을 runner limit까지 크게 허용하면 pnpm 외 process headroom이 사라져 kernel OOM이 오히려 발생할 수 있다.

근거:

- [Mend-hosted Renovate FAQ](https://docs.renovatebot.com/mend-hosted/faq/)
- [Renovate discussion #40942](https://github.com/renovatebot/renovate/discussions/40942#discussioncomment-16932858)
- [Renovate discussion #43072](https://github.com/renovatebot/renovate/discussions/43072)
- [pnpm issue #12868](https://github.com/pnpm/pnpm/issues/12868)
- [pnpm 11.11.0 release](https://github.com/pnpm/pnpm/releases/tag/v11.11.0)
- [pnpm PR #12870](https://github.com/pnpm/pnpm/pull/12870)
- [pnpm 11.15.1 release](https://github.com/pnpm/pnpm/releases/tag/v11.15.1)
- [pnpm PR #13133](https://github.com/pnpm/pnpm/pull/13133)

## 현재 복구 정책

Repository `renovate.json`은 `toolSettings.nodeMaxMemory=1536`을 유지한다. 이 값은 pnpm child process의 Node heap을
제한하여 Mend-hosted runner 안에서 Renovate와 OS가 사용할 headroom을 남기는 bounded provider control이다.
이 값은 provider OOM의 해결 보장이 아니라 과도한 child heap을 막는 방어선이다. 실제 bounded retry는 이 값을 로드한
상태에서도 total-memory ceiling에 도달했다.

`PNPM_WORKERS`와 `PNPM_MAX_WORKERS`는 provider allowlist에 포함될 수 있지만 현재 repository config에는 두지 않는다.
Upstream evidence에서 worker 수 감소만으로 peak memory가 해결되지 않은 사례가 있으며, 효과가 입증되지 않은 environment
override를 장기 정책으로 고정하지 않기 때문이다.

Config 변경은 Mend가 default branch에서 읽으므로 다음 순서로 검증한다.

1. fresh `dev` 기반 bounded branch에서 config와 policy test를 변경한다.
2. local config validation, disposable Renovate dry-run, repo-policy를 통과시킨다.
3. `dev` PR을 병합하고 reviewed config를 `main`에 승격한다.
4. Dependency Dashboard에서 정확히 한 owner group만 승인한다.
5. Mend scan은 한 번만 실행한다.
6. pnpm lockfile command의 `exec completed`와 `dev` 대상 branch/PR 생성을 확인한다.

## Hosted retry가 다시 OOM일 때

동일 config로 scan을 반복하지 않는다. 다음 exact-candidate fallback을 사용한다.

1. Dashboard와 failed job log에서 승인된 package 이름과 target version을 고정한다.
2. fresh `origin/dev` branch에서 그 후보만 catalog/manifest에 적용한다.
3. repository canonical pnpm으로 lockfile을 생성한다.
4. changed package allowlist와 transitive lockfile diff를 대조한다.
5. clean frozen install, lint, typecheck, repository policy와 remote CI를 통과시킨다.
6. provider OOM은 별도 revisit evidence로 유지하되 dependency compatibility 판정을 막지 않는다.

2026-09-01에는 이 fallback으로 lint-tooling supported minor/patch와 lint-staged 17.4.1을 각각 독립 PR로 검증했다.
PR #400과 #401은 clean install, lint, typecheck, repository policy, API/Web/Infra selected gates를 통과해 `dev`에 병합됐다.
이는 package compatibility GO 증거이며 Mend-hosted branch materialization의 GO 증거는 아니다.

다음은 fallback이 아니다.

- pnpm downgrade
- `minimumReleaseAge` 또는 supply-chain trust/install policy 완화
- npm Dependabot과 Renovate의 동시 활성화
- 승인되지 않은 package까지 한 번에 업데이트
- 이 문제만을 이유로 credentialed self-hosted Renovate를 즉시 도입

## 동일 입력 cold 비교 결과

현재 repository는 추적 파일 2,721개를 disposable workspace로 복사하고, lint-tooling catalog의 동일한 여섯 version target만
변경한 뒤 다음 명령을 isolated home·metadata cache·store에서 실행한다.

```bash
pnpm install --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile
```

2026-09-01 macOS `/usr/bin/time -l` 단일 cold trial 결과는 다음과 같다. 이 수치는 Corepack과 pnpm command 경계의 peak
RSS이며 Mend의 Renovate parent process와 container 전체 RSS를 측정한 값은 아니다.

| pnpm    | Exit | Wall    | Peak RSS        | 11.7.0 대비 |
| ------- | ---: | ------- | --------------- | ----------: |
| 11.7.0  |    0 | 14.970s | 3,419,963,392 B |    baseline |
| 11.15.1 |    0 | 14.021s | 2,183,102,464 B |      -36.2% |
| 11.24.0 |    0 | 14.383s | 1,934,606,336 B |      -43.4% |

11.7.0의 local peak가 Mend Community container limit 3 GB보다 컸고, upstream memory-fix line 두 후보는 같은 workload에서
모두 더 낮았다. 최신 release-age-eligible 11.x인 11.24.0은 fix floor 11.15.1보다도 약 11.4% 낮고 command가 성공했으므로
repository package-manager/Corepack/CI pin으로 채택했다. 단일 local trial은 provider recovery 증거가 아니며 절대 성능
benchmark로 일반화하지 않는다. 재현 명령과 raw JSON은 각각 `pnpm dependency:pnpm:cold-benchmark`와
`artifacts/local/dependency-automation/pnpm-cold-lockfile-benchmark.json`이 소유한다.

## 재검토 조건

다음 중 하나가 발생하면 resource control과 provider 선택을 fresh evidence로 재검토한다.

- Mend runner resource limit 또는 hosted execution model 변경
- Renovate가 pnpm lockfile generation memory control을 추가
- pnpm이 확인된 memory regression을 수정하고 repository가 해당 version으로 이동
- 서로 다른 bounded owner group에서 같은 signature가 반복
- manual fallback 빈도가 dependency automation 유지비용을 지속적으로 초과
- self-hosted scheduler를 정당화할 credential, operation, alerting과 cost owner가 확정

pnpm version 재검토는 warm cache 체감이 아니라 같은 workspace 입력, isolated metadata/cache/store, 동일 lockfile-only 명령으로
현재 pin과 upstream fix line을 비교한다. Exit status, wall time, peak RSS를 함께 기록하고 repository compatibility가 통과한
최신 지원 11.x만 승격한다. Default branch 반영 후 Mend scan은 한 번만 허용하며, 다시 OOM이면 provider/runtime NO-GO로
종료한다. pnpm 12 또는 self-hosted Renovate는 이 결과와 별개의 migration 판단이다.

## 유지보수·포트폴리오 evidence map

| 질문                                 | Repository evidence                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| 어떤 문제가 있었나                   | 승인된 Renovate branch가 pnpm 11 lockfile command 시작 후 completion 없이 kernel OOM       |
| 어떻게 원인을 분리했나               | extraction·approval·package rewrite 성공과 lockfile child-process 경계를 log에서 분리      |
| bounded retry 결과는 무엇인가        | `nodeMaxMemory=1536`이 로드됐지만 3.0 GB ceiling에서 1분 39초 후 같은 kernel OOM           |
| 왜 memory를 무조건 늘리지 않았나     | parent process·OS headroom과 hosted runner total memory를 함께 보존해야 함                 |
| 왜 worker override를 고정하지 않았나 | upstream에서 peak-memory 개선이 입증되지 않았고 config drift 비용이 있음                   |
| 왜 provider를 바로 교체하지 않았나   | one-owner 정책과 기존 extraction/grouping 성공을 보존하는 bounded fix가 더 작고 reversible |
| 실패하면 어떻게 복구하나             | 한 번의 hosted retry 후 exact-candidate local materialization과 PR #400·#401 검증          |
| 무엇을 포기하지 않았나               | supported pnpm line, supply-chain controls, owner grouping, review·rollback 경계           |
| pnpm pin은 어떤 근거로 바꿨나        | 동일 cold workload에서 11.7.0 3.42 GB 대비 11.24.0 1.93 GB, frozen compatibility 재검증    |

## 검증

```bash
node --test scripts/ci/dependency-automation-policy.test.mjs
pnpm dependency:renovate:dry-run
pnpm test:repo-policy
```

Provider acceptance는 local test만으로 대체하지 않는다. Default branch 반영 뒤 Mend job에서 lockfile command completion과
`dev` 대상 branch 또는 PR을 확인해야 hosted recovery를 `GO`로 판정한다.
