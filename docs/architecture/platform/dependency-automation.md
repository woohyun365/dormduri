# Dependency automation architecture

## 문서 상태와 책임

이 문서는 pnpm workspace dependency update의 현재 owner 경계와 provider 도입 전 검증 결과를 기록하는 비색인 초안이다. 현재 npm version update owner는 GitHub Dependabot이며 `renovate.json`은 명시적으로 비활성화되어 있다. Hosted Renovate의 권한·보존·운영 증거와 실제 pull request가 검증되기 전에는 이 문서를 Architecture index에 현재 운영 구조로 등록하지 않는다.

## 현재 경계

```text
Dependabot
├── npm/pnpm version updates      # 현재 활성 owner
├── GitHub Actions
├── Docker
└── Docker Compose

inactive renovate.json
└── npm manager policy candidate
    ├── pnpm catalog + manifests + lockfile
    ├── five minor/patch owner groups
    ├── dashboard-gated independent majors
    ├── unsupported TypeScript/@eslint majors disabled
    └── pnpm package-manager upgrade remains manual
```

두 updater를 같은 npm surface에 동시에 활성화하지 않는다. pnpm CLI 자체는 lockfile format, Corepack, CI action과 함께 검토해야 하므로 일반 dependency group에서 자동 갱신하지 않는다.

## Provider-independent 검증

`pnpm dependency:renovate:dry-run`은 실제 저장소를 수정하지 않고 다음 두 증거를 결합한다.

1. Renovate 44.7.2의 experimental local platform `lookup`
   - 임시 pnpm workspace에서 catalog와 inline dependency를 추출한다.
   - 공개 npm registry만 사용하며 GitHub token과 repository mutation 권한을 전달하지 않는다.
   - owner group 후보와 차단된 major를 JSON log로 검증한다.
2. 동일한 임시 workspace의 canonical pnpm artifact rehearsal
   - 승인된 target version 세 개만 source에 적용한다.
   - `pnpm install --lockfile-only --ignore-scripts`로 lockfile을 생성한다.
   - 두 번째 실행의 lockfile hash가 같아야 통과한다.

Renovate local platform은 branch 생성과 `dryRun=full`을 지원하지 않고 `lookup`으로 fallback한다. 따라서 두 번째 절차는 **Renovate가 파일을 직접 작성했다는 증거가 아니라**, lookup에서 확인한 update set을 현재 pnpm workspace가 canonical하게 표현할 수 있다는 package-manager 증거다. 실제 Renovate branch/PR과 catalog+lockfile 동시 변경은 provider 도입 이후 별도로 검증해야 한다.

- Renovate local platform: <https://docs.renovatebot.com/modules/platform/local/>
- Renovate npm/pnpm manager: <https://docs.renovatebot.com/modules/manager/npm/>

## 검증 결과

2026-08-20 account-free rehearsal 결과:

| 항목                   | 결과                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| Renovate extraction    | 4 files / 8 dependencies                                              |
| catalog candidate      | `vitest` 4.0.0 → 4.1.9, `web-test-storybook`                          |
| API inline candidate   | `@nestjs/common` 11.1.20 → 11.1.26, `api-framework-persistence`       |
| Web inline candidate   | `motion` 12.37.0 → 12.38.0, `web-framework`                           |
| blocked major          | TypeScript 6.0.3 → 7.0.2가 lookup에는 존재하지만 최종 branch에서 제외 |
| package-manager policy | pnpm update는 자동 후보 생성 전에 억제                                |
| provider mutation      | 없음 (`platform=local`, `dryRun=lookup`)                              |
| credential environment | 없음; isolated HOME과 public npm registry config 사용                 |
| source/artifact diff   | API manifest, Web manifest, catalog, lockfile 네 파일만 변경          |
| lockfile stability     | 두 번째 canonical regeneration에서 동일 SHA-256                       |
| bounded runtime        | 약 24초 / 15분 제한                                                   |
| lookup output          | 약 43KB / 5MiB capture 제한                                           |

원본 log와 실행별 summary는 Git으로 추적하지 않는 `artifacts/local/dependency-automation/`에 생성한다. 재현 계약과 고정 입력은 `scripts/dependencies/`가 소유한다.

## 채택 전 남은 증거

- Hosted provider의 selected-repository 권한, source 처리, log 보존, 운영자 접근, revoke 경로
- 실제 `dev` 대상 catalog PR과 inline dependency PR 또는 명시적 no-change 결과
- 실제 branch에서 catalog와 `pnpm-lock.yaml`이 하나의 canonical diff로 변경되는지
- provider 실패 시 npm update를 manual batch로 되돌리는 절차

위 증거가 통과한 뒤에만 Renovate를 활성화하고 Dependabot의 npm version-update block을 비활성화한다. GitHub Actions·Docker·Compose owner는 계속 Dependabot에 남긴다.

## Revisit triggers

- Renovate local platform이 full branch diff를 공식 지원한다.
- pnpm catalog extraction 또는 lockfile update semantics가 변경된다.
- pnpm CLI upgrade를 Corepack·CI action과 자동으로 원자화할 수 있는 owner boundary가 생긴다.
- Hosted provider 권한이나 retention이 승인 범위를 벗어난다.
- 실제 provider run이 15분 제한 또는 bounded output 정책을 반복적으로 초과한다.
