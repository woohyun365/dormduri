# Local infrastructure environment selection

로컬 환경은 도구 이름이나 디렉터리가 아니라 **증명할 동작**에 따라 선택한다. 기존 실행기와 resource profile을
먼저 확인하고, 설치된 도구·설정값·이전 성공 기록만으로 현재 runtime의 준비나 보안을 판정하지 않는다.

## 환경 선택

| 확인할 동작                                                                               | 기본 환경                                                                | 증거의 한계                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 여러 서비스의 Compose 연결, 배포 후보 검사, 관측·장애 복구, full-stack 회귀               | 기존 OrbStack Docker engine과 해당 canonical profile                     | 실제 cloud 네트워크·관리형 DB·서버 성능의 증거가 아님                  |
| Auth capacity/stress baseline                                                             | 해당 runbook의 constrained Docker profile                                | 다른 자원·workload·engine 결과나 host microbenchmark와 동일시하지 않음 |
| 개별 Linux 서버의 kernel·mount·filesystem·daemon, bridge/netfilter/FORWARD/NAT와 TCP 격리 | 독립 kernel을 갖는 ARM64 Linux VM; Apple Silicon에서는 UTM을 후보로 사용 | 실제 capability와 경로를 검사해야 하며 VM 사용 자체가 PASS는 아님      |
| AWS/provider 네트워크·instance·관리형 DB·TLS와 실제 배포 동작                             | 별도로 승인된 실제 target                                                | OrbStack/UTM 결과로 배포 gate를 대체하지 않음                          |

UTM의 Linux/network 검증도 infra 작업이다. 하나의 VM 안에 여러 container를 실행할 수 있으며, 외부 통신을 받는
별도 peer VM은 테스트 상대이지 production 서버 추가 결정이 아니다. 지원되는 Linux runner가 Compose를 실행할 수도
있지만, 각 실행기의 제약을 문서만으로 바꾸지 않는다.

현재 [full-stack 실행기](../../../scripts/infra/rehearsal/full-stack/index.mjs)의 기본 constrained 경로는 Docker
context `orbstack`을 요구한다. Context 이름 위장, 전역 context 전환, `FULL_STACK_REHEARSAL_ALLOW_UNCONSTRAINED`,
검사 skip으로 다른 runner의 결과를 같은 constrained PASS로 만들지 않는다. 미지원 runner가 꼭 필요하면 해당
실행기와 acceptance의 변경을 별도 범위로 정한다. Unconstrained 진단 결과는 그 한계를 그대로 표시한다.

## 자원 profile과 계산 책임

| Profile                             | 자원 경계                                          | 포함·제외와 canonical owner                                                                                                                              |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-stack / local DB               | engine 2 CPU / 4608 MiB = 제품 4096 + local DB 512 | Web/API/nginx/관측 제품 container limit 합계 2976 MiB. 외부 RDS를 대신하는 PostgreSQL 512 MiB는 제품 envelope 밖. [Full-stack runbook](./full-stack.md)  |
| Full-stack / external disposable DB | engine 2 CPU / 4096 MiB; local DB allowance 0      | 승인된 disposable DB opt-in에만 적용. 실제 production/RDS를 시험하는 옵션이 아님. [DB mode](./full-stack.md#external-disposable-db-opt-in)               |
| Auth password capacity              | engine 2 CPU / 4096 MiB                            | 로컬 DB도 같은 envelope 안에 포함; Web/BackOffice 제외. [Auth runbook](../../../docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md) |
| 개별 Linux 검증 runner              | 현재 작업에 승인된 VM CPU/RAM/disk 및 lifetime     | 범용 고정값 없음. 예를 들어 3 GiB 검증 runner는 4 GiB production 서버의 용량 재현이 아님                                                                 |

Full-stack의 4096 MiB 제품 envelope에서 container limit 합계 2976 MiB를 뺀 1120 MiB는 OS/Docker/filesystem
cache와 순간 증가를 위한 headroom이다. Local DB 512 MiB를 더해 engine 목표를 4608 MiB로 잡는다. 미래의 별도
BackOffice 2 GiB host는 여기에 합산하지 않는다. 숫자의 변경 owner는
[production topology](../../../docs/architecture/platform/production-runtime-topology.md),
[target readiness](../release/components/infrastructure-target/readiness.md), 기존 resource 구성과 검사 코드다.
이 selector는 새로운 production 예산을 정의하지 않는다.

Auth의 strict 4096 profile과 full-stack의 4608 profile은 서로 다른 실험이다. 과거 결과를 다시 분류하거나 모든
profile을 한 값으로 표준화하지 않는다. CPU container 상한의 합계도 host의 보장 compute나 예약량이 아니다.
이러한 local topology/resource 근사를 “AWS-like”라고 부를 수는 있지만, 모든 미래 instance 합산이나 AWS
CPU credit·IOPS·VPC/security group·RDS 성능의 재현을 의미하지 않는다.

### 서로 다른 자원 계층

- **Mac physical resources:** 현재 사용자 작업과 모든 runtime이 공유하는 실제 CPU/RAM/disk.
- **OrbStack global cap:** 공유 engine의 CPU/RAM 제한. 개별 container limit/reservation과 구분한다.
- **UTM guest resources:** VM별 vCPU/RAM/virtual disk. OrbStack global cap에 포함되지 않으므로 동시에 실행할 때
  host 여유를 별도로 확인한다. 기존 사용자 작업 중단이나 전역 증설로 여유를 만들지 않는다.
- **Guest storage:** virtual disk capacity, 실제 Linux filesystem, Docker/containerd image·snapshot·volume 경로를
  연결해 확인한다. 화면의 disk 크기만으로 모든 쓰기 경로의 quota를 보장하지 않는다.
- **Host storage:** sparse VM disk의 실제 할당량, metadata, OS 다운로드, cache, snapshot/export, source staging과
  evidence를 별도 계산한다. Guest disk 상한은 host 전체 할당량의 hard quota가 아니다.
- **Production target:** 실제 instance와 외부 DB의 자원·동작. 로컬 build/preparation 성공은 serving capacity 증거가 아니다.

## 실행 전 결정 순서

1. **Claim과 nonclaim:** 어떤 동작을 증명할지, local fixture가 대체하지 못하는 실제 배포 항목은 무엇인지 정한다.
2. **현재 입력:** branch/HEAD, 소스·config hash, runner OS/kernel/architecture/version, 실제 Docker endpoint/daemon ID,
   현재 자원과 workload를 읽기 전용으로 확인한다. 설치된 UTM은 생성·구성된 Linux VM이 아니다.
3. **Canonical profile:** [Compose profile registry](../../compose-profiles.json)와 기존 entrypoint, resource preflight,
   source manifest 검사를 따른다. 같은 조건을 비교하고 image tag/label만으로 source 일치를 주장하지 않는다.
4. **허용 범위:** VM 생성·설치·다운로드·통신·저장 위치·resource cap·실행 시간·cleanup/retention을 작업별로 고정한다.
   이미 승인된 동일 범위를 매번 재질문하지 않되, 도구 설치 사실이나 문서 구현 요청을 VM 생성 승인으로 바꾸지 않는다.
5. **실행 위치:** 해당 실행기가 Linux route와 bind-mount 경로를 사용하면 Node harness/Compose/route 검사를 Linux
   안에서 같은 daemon에 실행한다. Mac에서 Docker endpoint만 바꾸는 것으로 대체하지 않는다. Invocation-local
   endpoint와 UTM bundled CLI를 우선하며 effective selection을 확인한다. 전역 context/PATH 설정은 바꾸지 않는다.
6. **중단과 정리:** 비용·시간 상한, 실패 시 다음 행동, 정확한 자원 이름/ID·소유권·보존 종료 시점을 시작 전에 정한다.
   반복 permission/copy timeout에서는 원인 근거와 환경 대안을 남기고 무제한 재설치·재빌드하지 않는다.

전역 OrbStack CPU/RAM 변경·재시작은 사용자 workload에 영향을 준다. 하위 runbook의 설정 명령은 승인된 설정
변경 절차이지 매 실행의 자동 preparation이 아니다. 설치·management가 Mac Automation 등 추가 권한을 요구하면
지원되는 정확한 범위로 처리하며, 보안 정책을 끄거나 undocumented 실행 인자로 우회하지 않는다.

## Linux 환경과 source 준비

- 실제 kernel, daemon, namespace, IPv6, route/IPAM 충돌, resource/storage enforcement를 확인한다. 이전 VM의
  readiness는 재생성한 VM에 상속하지 않으며 snapshotter/storage 경로가 바뀌면 해당 evidence를 다시 확인한다.
- 새 VM에 host home/repository/socket/SSH-agent/clipboard를 공유하지 않는다. Production credential/DB와 연결하지
  않고, 필요한 source만 clean staging으로 전달한다. Tracked input 및 명시한 generated allowlist를 검증하고
  `.env`, auth/local state와 secret을 제외한다. Runtime 환경에는 필요한 fixture 입력만 별도로 전달한다.
- 기존 source manifest와 canonical Dockerfile을 사용해 image를 준비한다. Source archive·전송 hash, 실제 image ID와
  embedded manifest를 연결한다. Host의 오래된 image export나 source label은 이 검사를 대신하지 못한다.
- Guest disk/storage와 build output을 사후 확인한다. 환경 설치, 새 환경의 사전 readiness 검증, source-bound image 준비, 실제 fixture
  PASS를 별도 결과로 기록한다. Active checkout에서 production-only `pnpm deploy`를 실행하지 않는다.

## 네트워크 검증의 증거 경계

[Ingress fixture](../../rehearsal/README.md#account-free-ingress-fixture)의 public/collector network에서 API/Web/private
listener로 향하는 금지 TCP 경로는 실제 연결 실패로 입증한다. HTTP 403, port 미게시, VM 외곽 격리나 Compose
설정 렌더링 성공은 그 증거가 아니다. Collector는 관측 수집기의 역할이며 허용된 metrics 경로와 인증은 유지해야 한다.

API와 Web의 outbound 증거는 container → Linux FORWARD/NAT → daemon host 밖의 task-owned synthetic endpoint를
연결한다. Host gateway의 INPUT listener 성공만으로 routed egress를 주장하지 않는다. 경로·counter·endpoint 수신
evidence를 수집하되 실제 provider 접근과 구분한다. Endpoint의 bind/port/source/응답/수명을 한정하고 host 서비스나
production trust peer를 추가하지 않는다.

Fixture 내부의 native IPv6 요구는 유지한다. 별도 synthetic peer가 IPv4인 실험에 VM 간 IPv6까지 요구한다고
오해하지 않는다. 실패 시 assertion 완화, blanket `internal:true`, 광범위한 trusted CIDR, privileged/socket 공유,
몰래 변경한 host firewall로 통과시키지 않는다. Host 정책 또는 architecture 변경이 필요하면 해당 owner에게 경계를
다시 확인한다. 정상·주입 실패·실제 signal 종료의 cleanup은 각각 검증한다.

## 정리와 재개 handoff

생성 전 자원 baseline을 남기고, 생성한 정확한 VM/project/container/network/volume/image/endpoint와 그 작업이 쓴
builder cache만 정리한다. 전역 prune, 타 project down, 기존 VM 삭제나 사용자 소유 파일 변경은 하지 않는다. 보존이
필요하면 power 상태·경로·기한·cleanup owner를 승인 범위 안에서 기록한다. 명시되지 않은 무기한 보존이나 자동 삭제
scheduler를 만들지 않는다.

### 로컬 Docker 자원 label과 확인

저장소 script가 Docker image store에 만드는 image와, 실행마다 새로 만드는 project의 이름 있는 volume에는 다음
label이 붙는다. Label은 남은 자원을 골라 지우기 위한 표시이고 source 일치 근거가 아니다(위 "실행 전 결정 순서" 3번).

| Label                       | 값                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dormduri.local.created-by` | 만든 script의 저장소 상대 경로. 값을 넘기지 않는 실행(compose 직접 실행, `pnpm web:observability:rehearsal`)은 `manual`이고, ingress fixture image는 그 Dockerfile 경로다 |
| `dormduri.local.run-id`     | 그 실행의 run ID. 없으면 `local`                                                                                                                                          |

- Full-stack rehearsal: rehearsal overlay의 API·Web build(`infra/rehearsal/compose.*.yml`)와, 그 runner만 붙이는
  `scripts/infra/rehearsal/full-stack/compose.volume-labels.*.yml`·full-stack profile만 쓰는
  `infra/rehearsal/compose.postgres.yml`의 volume. Keep-running이
  아니면 정리 단계가 compose down 뒤 그 실행의 두 image(`dormduri-api:full-stack-<run id>`,
  `dormduri-web:full-stack-<run id>`)만 지우고 결과를 evidence `cleanup.images`에 남긴다. Keep-running이면 지우지 않고
  그 이름을 남긴다. `FULL_STACK_REHEARSAL_SKIP_BUILD=1`은 같은 `FULL_STACK_REHEARSAL_RUN_ID`의 keep-running 실행이
  남긴 image만 재사용하고, 없으면 build 없이 실패한다. 재사용 전 정리 순서는
  [full-stack runbook 종료 확인](./full-stack.md#종료-확인)을 따른다.
- Dockerized smoke: 그 runner만 붙이는 `apps/api/test/stress/docker/compose.local-labels.yml`이 API image에 label을
  둔다. 운영 후보 `infra/deploy/compose.api.yml`의 build 정의에는 label이 없다.
- 이름이 고정된 project(dockerized smoke의 `dormduri-api`·`dormduri-observability`, `pnpm infra:compose`로 직접 띄운
  project, `pnpm web:observability:rehearsal`)의 volume에는 label을 두지 않는다. Compose는 volume label을 volume 설정
  hash에 넣으므로, 실행마다 바뀌는 run ID label을 붙이면 다음 실행이 `Recreate (data will be lost)?`를 묻는다. 이
  volume은 이름이 고정이라 쌓이지 않으며 `com.docker.compose.project` label로 찾는다.
- Ingress fixture: [build 명령](../../rehearsal/README.md#account-free-ingress-fixture)이 label을 붙인다.
- `pnpm infra:artifacts:build`는 OCI layout을 `.artifacts`에 쓰고 image store에 image를 남기지 않는다.

남은 자원 확인(읽기 전용):

```bash
docker image ls -a --filter label=dormduri.local.created-by \
  --format 'table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedSince}}'
docker image ls -a --filter label=dormduri.local.created-by=scripts/infra/rehearsal/full-stack/index.mjs
docker image inspect --format '{{index .Config.Labels "dormduri.local.created-by"}} {{index .Config.Labels "dormduri.local.run-id"}}' <image>
docker volume ls --filter label=dormduri.local.created-by \
  --format 'table {{.Name}}\t{{.Label "dormduri.local.created-by"}}\t{{.Label "dormduri.local.run-id"}}'
docker volume ls --filter label=com.docker.compose.project=dormduri-api
docker buildx du --builder dormduri-artifacts
docker buildx du
docker system df
```

`-a`가 있어야 같은 tag로 다시 build해 이름이 없어진 이전 image(`<none>:<none>`)도 보인다. 지울 때는 목록에서 고른
정확한 이름이나 ID만 `docker image rm <image>`·`docker volume rm <volume>`으로 지운다. 실행 중 container가 쓰는
image·volume과 label이 없는 자원은 그 작업의 owner가 정한다.

### Builder cache

- `dormduri-artifacts` builder는 `pnpm infra:artifacts:build`가
  [`buildkitd.toml`](../../../scripts/infra/artifacts/buildkitd.toml)로 만든다(cache 최대 20GB, 쓰이지 않은 cache 14일
  보존). 만든 뒤 `docker buildx inspect`의 GC policy가 그 상한과 다르면 build 전에 실패한다.
- 설정을 바꿨거나 그 확인이 실패하면 builder를 지우고 다시 만든다: `docker buildx rm dormduri-artifacts` 뒤
  `pnpm infra:artifacts:build`. `buildx rm`은 그 builder의 cache와 state volume을 함께 지운다. Cache만 줄이려면
  `docker buildx prune --builder dormduri-artifacts`처럼 그 builder를 지정한다.
- 기본 builder(OrbStack `orbstack`·`default`)의 cache 상한은 사용자의 OrbStack·Docker 설정이다. 이 저장소는 바꾸지
  않는다. 확인은 `docker buildx du`·`docker system df`·`docker buildx inspect <builder>`의 GC policy이고, 조절 위치는
  Docker Engine `daemon.json`의 `builder.gc`(예: `defaultKeepStorage`)다. OrbStack은 `orb config docker` 또는
  `~/.orbstack/config/docker.json`을 고친 뒤 `orb restart docker`로 적용한다. Engine 재시작은 실행 중 container에
  영향을 주므로 사용자가 정한다.

### 임시 PostgreSQL

검증용 임시 DB는 익명 volume이 남지 않게 data 경로를 tmpfs로 두고 `--rm`으로 띄운다. Image는 dev compose와 같은 pin을
읽어 쓴다.

```bash
image=$(docker compose -f docker-compose.dev.yml config --images)
docker run --rm -d --name dormduri-tmp-<용도> \
  --label dormduri.local.created-by=<작업> \
  --tmpfs /var/lib/postgresql \
  -p 127.0.0.1:<빈 port>:5432 \
  -e POSTGRES_DB=<db> -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<임시 값> \
  "$image"
# 끝나면
docker stop dormduri-tmp-<용도>
```

Compose로 띄울 때는 `-p dormduri-tmp-<용도>`처럼 project 이름을 정하고 끝날 때 `down --volumes`로 그 project의
volume까지 지운다. `-v` 없이 `docker run`으로 띄운 뒤 `--rm` 없이 container만 지우면 image의 data 경로에 익명
volume이 남는다.

다음 필드를 기존 artifact/handoff owner에 남긴다. 재사용할 정책은 이 문서에, 기기별 관측값과 임시 자원은
`.artifacts/`에 둔다. CI 출력은 runner temp 아래에서 생성해 artifact로 전달한다.

- Objective/claim/nonclaims; branch/HEAD, source/config/archive/image hashes.
- Runner/VM/daemon identity, tool versions, effective profile/caps와 관측 storage/network 경로.
- 실행 명령·시간·결과·미실행/gap; 이전 실패와 source/environment 차이.
- 생성 자원 exact names/IDs, cleanup evidence 또는 승인된 retention/deadline/owner.
- 다음 bounded action과 blocker; 실제 배포가 필요한 증거와 activation disposition.

Secret, DB URL, raw auth/state 또는 숨겨진 workflow state는 handoff에 넣지 않는다. 실제 release의 target evidence는
[release readiness](../release/production-release-readiness.md)가 소유하며 로컬 PASS나 code merge로 완료되지 않는다.
