# Repository scripts

저장소 스크립트는 실행 파일의 수가 아니라 **책임과 호출 경계**를 기준으로 배치한다. 개발자와 CI는 가능한 한 `package.json`의 명명된 명령을 사용하고, 다른 스크립트가 내부 모듈을 직접 조합하지 않는다.

## 디렉터리 책임

- `artifacts/`: 로컬·CI 산출물 경로 계약처럼 여러 실행 영역이 공유하는 작은 capability
- `ci/`: CI 검증 script를 책임별 하위 디렉터리에 둔다. `lanes/`(변경 분류·lane 선택·policy test 실행·formatting·step 시간 측정), `performance/`(GitHub Actions 성능·자원 측정), `contracts/`(workflow·GitHub·toolchain·dependency automation·문서 경로 계약 test), `product/`(Web standalone 준비와 product test 배치·fixture 계약), `agents/`(agent workflow test), `lifecycle/`(PR 본문 `Lifecycle` 절과 정책 우선·영역 기준 존재·리뷰 snapshot 검사, `Lifecycle gate` job 진입점)
- `dependencies/`: provider 계정 없이 dependency update 정책과 package-manager artifact 변경을 검증하는 bounded rehearsal
- `git/`: commit message처럼 local Git hook과 CI가 공유하는 경량 repository contract
- `github/`: account/repository control-plane을 mutate하지 않고 sanitized owner evidence만 수집하는 capability
- `infra/check/`: 정적·container-backed 인프라 검증 진입점과 bounded validator
- `infra/compose/`: Compose profile inventory 해석과 안전한 명령 조합
- `infra/artifacts/`: OCI build evidence 생성과 manifest 검증
- `infra/rehearsal/`: 배포 토폴로지를 로컬에서 검증하는 orchestration
- `observability/production/`: production 후보 관측 설정 검증
- `observability/rehearsal/`: account-free 로컬 수집·장애 격리 rehearsal
- `observability/sentry/`: Sentry build artifact 검증

## 변경 규칙

1. 사용자·CI 진입점은 root `package.json`에 이름을 부여한다.
2. test는 구현 파일과 같은 디렉터리에 두며 `scripts/ci/lanes/run-repo-policy.mjs`가 재귀적으로 발견한다.
3. 산출물 경로는 `scripts/artifacts/paths.mjs`의 `resolveArtifactPath()`로만 결정한다.
4. orchestration entry는 실행 순서와 실패 경계만 소유하고, DB·관측·자원·evidence·cleanup은 bounded module로 분리한다.
5. 이동 시 compatibility wrapper를 남기지 않고 package, workflow, 문서, test caller를 같은 변경에서 갱신한다.
