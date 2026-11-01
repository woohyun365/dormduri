# 로컬 Docker 자원 정리 evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. 정리 범위·label·확인
> 명령·임시 PostgreSQL은 [로컬 환경 runbook](../../../infra/runbooks/rehearsal/local-environments.md#정리와-재개-handoff),
> full-stack 정리·keep-running·재사용은 [full-stack runbook](../../../infra/runbooks/rehearsal/full-stack.md#종료-확인),
> artifact builder는 [Local image artifact contract](../../../infra/artifacts/README.md)가 소유합니다.

로컬 rehearsal과 image build가 실행할 때마다 Docker image와 build cache를 남기던 문제를 고친 기록입니다
([#715](https://github.com/woohyun365/dormduri/issues/715)). 같은 변경이 infra·Docker 이름을 `dormduri`로 바꿨으므로
([#803](https://github.com/woohyun365/dormduri/issues/803)), 정리 전 기록의 자원 이름은 측정 당시의 옛 이름
(`knu-roommate-*`, `knu-chat-ingress-fixture`)입니다. 측정은 한 Apple Silicon 장비(arm64, 8 core)의 OrbStack(Docker
Engine 29.4.0, Compose v5.1.2, buildx v0.33.0, engine 2 CPU·4,485MiB)에서 했습니다. 정리 전 측정은 `origin/dev`
`ed7dee26`(2026-11-01T12:53:51Z), 정리 뒤 측정은 이 변경의 구현 commit(2026-11-01)에서 했습니다. 측정 때 hash는 `474b1424`이고 `origin/dev` `88a9fe69`
위로 rebase한 뒤 `209d3bec`입니다. Rebase로 들어온 변경은 agent workflow 경로와 이 측정에 쓰지 않는 파일 5개뿐입니다.

## 1. 문제와 관측

- Full-stack rehearsal은 실행마다 `full-stack-<run id>` tag로 API·Web image 둘을 build했고, 정리는
  `compose down --volumes --remove-orphans`만 해서 image를 남겼습니다. 실행마다 image 2개가 늘었습니다(크기는 정리
  뒤 keep-running 실행에서 잰 API 456MB, Web 328MB). 정리 전 측정 시점에는 2026-10-28에 사람이 지운 뒤 실행이 없어 0개였습니다.
- Ingress fixture는 같은 tag(`:local`)로 다시 build하면 이전 판이 이름 없는 image로 남습니다. 이름 없는 image 10개 중
  5개가 그 이전 판이었습니다(각 약 2.2GB, 고유 크기 0~1.99GB).
- Artifact builder(`knu-roommate-artifacts`)는 buildkitd 설정 없이 만들어 BuildKit 기본 GC를 썼습니다. 이 장비에서는
  사용하지 않은 cache를 1,440시간(60일) 두고 최대 93.13GiB까지 씁니다. 측정 시점 cache는 4.32GB였습니다.
- 누가 어떤 실행에서 만든 자원인지 알려 주는 공통 label이 없었습니다. Ingress fixture 이전 판 5개 중 1개는 fixture
  label도 없어 이름·label로 출처를 찾을 수 없었습니다.

## 2. 측정 방법과 재현 명령

| 신호              | 명령                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 전체 사용량       | `docker system df`, `docker system df -v`                                                                                                                                                                                   |
| Image 목록        | `docker image ls -a`(Docker 29는 `-a` 없이 이름 없는 image를 숨깁니다). 실행 전후 비교는 `docker image ls -a -q --no-trunc`의 ID 집합                                                                                       |
| Label             | `docker image ls -a --filter label=dormduri.local.created-by`, `docker image inspect --format '{{index .Config.Labels "dormduri.local.run-id"}}' <image>`, `docker volume ls --filter label=dormduri.local.run-id=<run id>` |
| Builder           | `docker buildx inspect <builder>`의 `GC Policy rule#N`, `docker buildx du --builder <builder>`                                                                                                                              |
| Full-stack 정리   | `pnpm infra:rehearsal:full-stack` evidence JSON의 `cleanup.images`(`kept`·`removed`·`absent`·`failed`)                                                                                                                      |
| 정리 전 측정 범위 | 읽기 전용 명령만 썼습니다(`system df`, `image ls`, `volume ls`, `ps -a`, `buildx du`, `buildx inspect`, `image inspect`)                                                                                                    |

## 3. Baseline

| 항목                             | 값                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Image                            | 24개, 10.95GB(회수 가능 6.342GB), 실행 중 container가 쓰는 것 2개                                                                             |
| 이름 없는 image                  | 10개: ingress fixture 이전 판 5개(4개는 `knu.fixture.kind` label, 1개는 label 없음), 기반 image의 digest 판 5개(postgres·nginx·moby/buildkit) |
| Ingress fixture                  | `knu-chat-ingress-fixture:local` 1개(2.2GB)와 위 이전 판                                                                                      |
| Full-stack image                 | `knu-roommate-{api,web}:full-stack-*` 0개                                                                                                     |
| Volume                           | 3개, 4.566GB: dev DB volume, `knu-roommate-artifacts` builder state volume, 익명 volume 1개                                                   |
| `knu-roommate-artifacts` builder | BuildKit v0.31.2, cache 4.32GB, GC 기본 4규칙(rule#1: Keep 1440h, Reserved 9.313GiB, Max Used 93.13GiB, Min Free 125.7GiB)                    |
| 기본 builder(`orbstack`)         | cache 24.21GB(회수 가능 24.21GB)                                                                                                              |

## 4. 원인

1. Full-stack image tag가 run id마다 달라 같은 이름을 덮어쓰지 않고, 정리 단계의 `compose down`은 `--rmi` 없이 image를
   지우지 않습니다. 그래서 실행 수만큼 image가 쌓입니다.
2. 같은 tag로 다시 build하면 Docker는 tag만 새 image로 옮기고 이전 image는 이름 없이 남깁니다. Ingress fixture가 이
   경우입니다.
3. `docker buildx create`에 `--buildkitd-config`가 없어 BuildKit이 디스크 크기 비율로 정한 기본 GC 상한을 씁니다.
4. 공통 label이 없어 남은 자원 가운데 어떤 script가 어떤 실행에서 만든 것인지 고를 근거가 없습니다.

## 5. 대안과 기각

| 대안                                                                 | 판정 | 근거                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정리 단계가 그 실행의 image 두 reference만 지움                      | 채택 | Rendered compose config의 `image` 값이 `:full-stack-<run id>`인지 확인하고 `compose down` 두 번 뒤 그 둘만 `docker image rm`. 삭제 실패는 evidence에 남기고 실행 결과를 바꾸지 않습니다 |
| 고정 tag로 덮어쓰기(예: `full-stack-local`)                          | 기각 | Ingress fixture에서 관측한 대로 같은 tag 재build는 이전 판을 이름 없이 남깁니다. 두 실행이 겹치면 서로의 image를 바꿉니다                                                               |
| `compose down --rmi all` 또는 `image prune`                          | 기각 | `--rmi all`은 nginx·PostgreSQL·관측 기반 image까지 지워 다음 실행이 다시 받습니다. Prune은 다른 작업과 사람의 image도 지웁니다                                                          |
| 정리하지 않고 runbook에 수동 정리만 안내                             | 기각 | 실행마다 784MB가 늘고 사람이 매번 골라 지워야 합니다(정리 전 상태)                                                                                                                      |
| Artifact builder에 buildkitd GC 상한을 주고 bootstrap 뒤 적용을 확인 | 채택 | 상한을 넘는 cache는 BuildKit이 지우고, 설정 없이 만든 builder는 build 전에 다시 만들라는 message로 실패합니다                                                                           |
| Build 뒤 script가 `buildx prune` 실행                                | 기각 | 매번 cache를 버려 다음 build가 느려지고, 사람이 정하지 않은 삭제를 script가 합니다                                                                                                      |
| 기본 builder 사용                                                    | 기각 | Artifact build는 OCI layout과 attestation을 내보내려고 `docker-container` driver builder를 따로 씁니다. 기본 builder의 GC는 사람 소유 daemon 설정입니다                                 |

## 6. 개선별 전후 측정

| 확인                                      | 정리 전                          | 정리 뒤                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-stack 실행 뒤 남는 그 실행 image     | 실행마다 2개(784MB)              | 0개. keep-running이 아닌 2회 실행이 각각 `removed` 2개를 기록했고, 각 실행 뒤 `dormduri.local.created-by` label image 0개                                                       |
| 전체 image ID 수(2회 실행 전·사이·뒤)     | —                                | 29 → 30 → 30. 늘어난 1개는 digest로 고정한 Grafana 기반 image의 첫 pull이고 실행이 build한 image가 아닙니다                                                                     |
| Keep-running                              | 정리 없이 남김                   | Image 2개를 남기고 이름을 `cleanup.images.kept`에 기록. 그 실행의 image 2개와 volume 7개에 `dormduri.local.created-by`·`run-id` label                                           |
| Skip-build 재사용(앞 실행이 keep-running) | —                                | Keep 실행 → runbook 명령으로 project만 정리 → 같은 run id로 pass. 끝날 때 그 image 2개만 `removed`(image ID 32 → 30, 빠진 둘이 keep image)                                      |
| Skip-build(앞 실행이 keep-running 아님)   | 확인 없음                        | Build 없이 조건 message로 실패, image ID 30개 그대로, evidence `absent` 2개                                                                                                     |
| Artifact builder GC                       | 기본 4규칙(60일, 93.13GiB)       | 3규칙: build context·cache mount·git checkout 48h·512MiB, 사용하지 않은 cache 336h(14일)·20GiB, 전체 20GiB                                                                      |
| Artifact builder cache                    | 4.32GB(`knu-roommate-artifacts`) | 4.234GB(`dormduri-artifacts`, 첫 build 뒤)                                                                                                                                      |
| 설정 없이 만든 builder                    | 확인 없음                        | GC policy가 상한과 다르면 build 전에 실패하고 `docker buildx rm` 뒤 다시 만들라고 안내                                                                                          |
| Ingress fixture image label               | 4/5에 fixture label만            | README build 명령으로 만든 image에 `dormduri.fixture.*`와 `dormduri.local.created-by`·`run-id`. `docker image ls -a --filter label=dormduri.local.created-by`가 그 image를 찾음 |
| 임시 PostgreSQL(runbook 방법)             | —                                | 실행 중과 멈춘 뒤 새 익명 volume 0개                                                                                                                                            |

## 7. 한계와 재측정 조건

- 한 장비의 OrbStack에서만 측정했습니다. Docker Desktop과 Linux engine은 측정하지 않았습니다. 같은 tag 재build가 이전 판을
  남기는 동작은 engine 공통이지만 크기와 기본 GC 상한은 장비마다 다릅니다.
- Image 크기는 `docker image ls`의 SIZE이며 다른 image와 공유하는 layer를 포함합니다.
- Full-stack compose build는 기본 builder를 씁니다. 기본 builder cache는 full-stack build 3회 뒤 24.21GB에서 28.06GB가
  됐습니다. 이 변경은 기본 builder의 GC를 바꾸지 않습니다(daemon `builder.gc`와 OrbStack 설정은 사람 소유). 확인·조절
  위치는 로컬 환경 runbook에 있습니다.
- Ingress fixture를 같은 tag로 다시 build하면 이전 판은 여전히 이름 없이 남습니다. 이 변경은 label로 찾게 할 뿐
  자동으로 지우지 않습니다.
- Ingress fixture의 `--mode=fixture-http`는 이 OrbStack에서 네트워크 격리 검사 6개가 실패합니다(검사 11개 PASS, project 정리
  확인). 이름을 바꾸기 전 같은 장비의 8회 실행도 같은 결과였고, fixture README가 bridge 간 TCP 접근을 허용하는 engine에서는
  실패해야 한다고 정한 경우입니다. 표준 bridge 격리를 주는 Linux Docker runner에서는 다시 실행하지 않았습니다.
- Smoke 기본 profile(`api-base`)의 `api-secrets` volume과 관측 production-like profile(`observability-base`)의 volume에는
  label이 없습니다(운영 후보 compose 정의라 label을 두지 않음). Smoke의 API image label은 runner와 같은 compose 인자의
  config render로만 확인했습니다. Smoke 실행은 로컬 dev DB에 `prisma db push --accept-data-loss`를 하므로 이 측정에서
  돌리지 않았습니다.
- Digest로 고정한 기반 image는 의존성 갱신으로 digest가 바뀔 때마다 옛 판이 남습니다(측정 뒤 nginx image 4개, postgres image 3개).
  이 변경의 범위 밖입니다.
- GC 상한은 BuildKit이 cache를 지우는 기준이고 지우는 시점은 BuildKit이 정합니다. 상한을 넘는 순간은 측정하지 않았습니다.
- 옛 이름 자원(`knu-roommate-artifacts` builder와 state volume, `knu-chat-ingress-fixture:local`과 이전 판)은 사람이
  지웁니다. 지운 뒤 `docker system df`와 `docker buildx ls`로 다시 측정합니다.

## 8. Interview map

| 질문                                      | 근거 절 |
| ----------------------------------------- | ------- |
| 어떤 문제를 어떤 수치로 확인했는가        | §1, §3  |
| 원인을 어떻게 좁혔는가                    | §4      |
| 왜 다른 방법을 쓰지 않았는가              | §5      |
| 개선을 어떻게 확인하는가                  | §2, §6  |
| 측정의 한계와 다시 측정할 조건은 무엇인가 | §7      |
