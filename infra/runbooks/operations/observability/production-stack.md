# Observability production operations

## 목적과 경계

이 문서는 운영 관측 stack(Prometheus, Loki, Alloy, Alertmanager, Grafana)의 runtime 경계와 경보 대응을 소유한다. 운영 stack은
user host의 API 묶음에 들어 있고([user host compose 조각](../../../deploy/user/api/compose.yml)), API 배포 document가 API와 함께
배포·rollback한다. 실제 host에서 확인한 결과(관측 단계 결과, Grafana·Slack 시험, Docker socket 위험 수용)는 API 단계 배포 기록의
관측 component 줄에 적는다([실제 값의 기록 위치](../../release/production-release-evidence.md#실제-값의-기록-위치)). 이 문서의 local 검증 결과를
production 증거로 대체하지 않는다. Collector trust boundary의 준비와 결과 형식은 각각
[`collector readiness`](../../release/components/observability-collector/readiness.md)와
[`collector evidence`](../../release/components/observability-collector/evidence.md)가 소유한다. 장애·전환 절차는
[`collector incident`](../../incidents/observability-collector.md)를 따른다.

Canonical machine-readable contract는 `infra/observability/production-operations.json`이다. 조각의 구조 규칙(mount·user·network·
port·secret 파일)은 `scripts/infra/user-host/compose-contract.mjs`, 운영 계약과의 대조는 `pnpm observability:check:production`이
확인한다.

## User host 배치

| 항목         | 값                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image        | upstream 다섯은 `infra/observability/compose.base.yml`의 pin(`infra/image-inventory.json`)과 같은 digest                                                                                                                                                         |
| 설정         | ECR `dormduri/observability-config`(설정 파일만 담은 `FROM scratch` image, [Dockerfile](../../../observability/Dockerfile)). document가 `docker create`·`docker cp`로 `/opt/dormduri/observability/config/<digest>/`에 펼치고 각 container가 읽기 전용으로 mount |
| Secret       | `/opt/dormduri/secrets/observability/`의 파일 셋. 각 파일은 그것을 읽는 container UID 소유 0400이고 그 container에만 파일 단위로 mount                                                                                                                           |
| Network      | 관측 network(고정 subnet, 묶음 안). Prometheus만 API transit에도 붙어 API metrics를 긁는다                                                                                                                                                                       |
| 공개 port    | 없음. Prometheus `127.0.0.1:9090`, Alertmanager `127.0.0.1:9093`, Grafana `127.0.0.1:3001`만 host loopback에 bind                                                                                                                                                |
| 보존         | Prometheus 15일, Loki 30일(compactor), Alertmanager 120h                                                                                                                                                                                                         |
| Memory limit | Prometheus 256 MiB, Loki 320 MiB, Alloy 160 MiB, Alertmanager 96 MiB, Grafana 320 MiB                                                                                                                                                                            |

Secret 파일과 원본:

| 파일                       | 읽는 container(UID) | 원본                                                                        |
| -------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `api-metrics-bearer-token` | Prometheus(65534)   | API runtime secret release의 `METRICS_BEARER_TOKEN`(API가 검사하는 같은 값) |
| `slack-webhook-url`        | Alertmanager(65534) | Secrets Manager 관측 묶음 `SLACK_ALERT_WEBHOOK_URL`                         |
| `grafana-admin-password`   | Grafana(472)        | Secrets Manager 관측 묶음 `GRAFANA_ADMIN_PASSWORD`                          |

## 배포·rollback과 fail-open

API 배포 document는 API rollout과 host 안 smoke가 끝난 뒤 관측 단계를 돈다. 순서는 설정 image 받기·펼치기 → 관측 secret 파일
쓰기 → upstream 관측 image 받기 → 관측 다섯 다시 만들기(`--wait`, 120초)다. 이 단계의 실패는 API 결과를 바꾸지 않는다(fail-open).
성공한 `deploy`·`rollback`의 host `RESULT` 줄에 있는 `observability` 값이 결과다. 다른 결과 줄(rollout 전 실패·되돌림·
`maintenance`)은 관측 단계에 닿지 않아 관측을 바꾸지 않는다. 관측 단계는 API `current` 갱신 뒤 같은 SSM step(상한 900초) 안에서
돌므로, network를 쓰는 호출(설정 image·upstream image 받기, 관측 secret 꺼내기, 다시 만들기)은 step 시작부터 840초 안에 끝나게
끊고 남은 시간이 30초 미만이면 건너뛴다(`observability=failed`). 그래야 step이 끊겨 결과 줄 없이 끝나지 않는다.

| `observability` | 뜻                                                                                         | 할 일                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `ok`            | 설정·secret을 쓰고 다섯이 healthy                                                          | 단계 기록의 관측 줄에 옮겨 적고 Grafana·Slack 시험을 한다                                                     |
| `failed`        | 설정 받기·펼치기, secret 쓰기, image 받기, 다섯 기동 중 하나가 실패하거나 시간 상한에 걸림 | host 안 document log(root만 읽음)의 `observability` 줄에서 실패 단계를 보고 고친 뒤 같은 묶음을 다시 배포한다 |

- 설정 digest는 API 묶음 release 기록에 들어간다. `rollback`은 직전 묶음의 설정 digest로 관측 설정을 되돌린다.
- `maintenance`는 API만 내리고 관측 stack은 그대로 둔다.
- 설정 디렉터리는 지금·직전 묶음의 digest와 관측 container가 쓰고 있을 수 있는 digest(api state의 `observability` 파일)만
  남기고 정리한다. 다시 만들기가 실패하면 container가 어느 설정으로 다시 만들어졌는지 모르므로 이전 설정과 새 설정을 모두
  남기고, 다음 성공에서 새 설정 하나로 줄인다.

## Operator 접근

Grafana·Prometheus·Alertmanager에는 공개 경로가 없다. Owner가 Identity Center 단기 credential로 SSM port forwarding을 연다.

```bash
aws ssm start-session --target <managed-node-id> \
  --document-name AWS-StartPortForwardingSession \
  --parameters 'portNumber=3001,localPortNumber=3001'
```

그 뒤 `http://127.0.0.1:3001`에서 Grafana에 `dormduri-operator`와 관측 묶음의 password로 들어간다. Grafana는 이 password를
`grafana-data` volume을 처음 만들 때만 쓴다(Grafana `admin_password`는 첫 기동 값). 관측 묶음의 값을 바꾼 뒤에는 Grafana 화면의
profile에서 같은 값으로 바꾼다. Prometheus는 `portNumber=9090`,
Alertmanager는 `portNumber=9093`으로 같은 방식이다. Node ID와 화면의 식별자는 기록에 쓰지 않는다
([식별자 규칙](../../../../docs/deploy/README.md#식별자-규칙)). Grafana anonymous access와 self sign-up은 꺼져 있다. Prometheus와
Loki API에는 application-level 인증이 없으므로 public reverse proxy를 두지 않는다.

## 수집과 가림

- Alloy는 compose project `dormduri-web`의 service `api|ingress|web` stdout만 받는다.
- log 처리는 [`pipeline.alloy`](../../../observability/alloy/pipeline.alloy)가 소유한다. ingress 접속 log는 IPv4 /24·IPv6 /48
  IP, query string과 경로 속 식별자(숫자뿐인 조각, 24자 이상 영숫자 token, `@`·percent 부호화·nginx byte 표기가 든 조각, JWT
  형태 token)를 `:id`로 바꾼 경로, user agent·상태·시각, 형식이 맞는 request id만 남기고 referer는 버린다. 다른 ingress 줄(해석하지
  못한 요청 줄 포함)은 요청 문맥·요청 줄·query string·URL 칸을 지운다. 모든 service 행은 원본 IP pattern을 한 번 더 가린다
  ([OO-R1](../../../../docs/policies/operational-observability.md)).
- Loki label은 `service`·`env`·`container`·`level`만이다(Loki가 `service`에서 `service_name`을 더한다).
- host 지표는 Alloy `prometheus.exporter.unix`가 host `/`·`/proc`·`/sys`를 읽기 전용으로 읽어 내고 Prometheus job `host`가 긁는다.
- `pnpm infra:check:runtime`이 실제 Alloy·Loki로 fixture 행의 가림을, 실제 Alertmanager로 Slack payload를 확인한다.

## Health와 장애 격리

| Service      | readiness owner                                                                           | 제품 요청 의존성 |
| ------------ | ----------------------------------------------------------------------------------------- | ---------------- |
| Prometheus   | container healthcheck `/-/ready`                                                          | 없음, fail-open  |
| Loki         | running 상태(image에 probe 도구 없음) + Prometheus target `up`(`ObservabilityTargetDown`) | 없음, fail-open  |
| Alloy        | running 상태(image에 probe 도구 없음) + Prometheus target `up`(`ObservabilityTargetDown`) | 없음, fail-open  |
| Alertmanager | container healthcheck `/-/ready`                                                          | 없음, fail-open  |
| Grafana      | container healthcheck `/api/health`                                                       | 없음, fail-open  |

API·Web·ingress는 관측 service에 의존하지 않는다(`depends_on` 없음). 관측 component 장애가 API/Web readiness를 실패시키거나 사용자
요청을 막아서는 안 된다. local은 `pnpm infra:rehearsal:full-stack`이 component를 하나씩 멈추는 동안 API `/health`와 Web root
응답을 확인한다([full-stack rehearsal](../../rehearsal/full-stack.md)).

## 경보 대응

경보는 Prometheus → Alertmanager → Slack channel 하나다. critical은 channel mention을 붙인다. Slack 본문은 닫힌 label 값과 rule의
고정 문구(summary·runbook)만 담는다([payload 형식](../../../observability/slack/slack-alert-payload.md)). RDS instance 지표는 이 경로가
아니라 CloudWatch alarm → SNS email이다([RDS 경보](../../../aws/rds-setup-checklist.md#alarms)).

| 경보                                                                       | 심각도             | 먼저 볼 것                                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RetentionKeyUnavailable`·`RetentionRetryExhausted`·`RetentionSweepFailed` | critical           | Grafana retention dashboard와 API log(`service="api"`). 처리는 [retention README](../../../../apps/api/src/retention/README.md)                                        |
| `RetentionArchiveManualReviewPending`·`RetentionBacklogAboveThreshold`     | warning            | 같은 dashboard의 backlog. 보관 검토·적체 처리는 retention README                                                                                                       |
| `BackgroundJobStalled`·`BackgroundJobRepeatedFailures`                     | warning            | `exported_job` label의 정리 작업(수집 뒤 이름, scrape job은 `api`)과 API log. 주기·의미는 [background-jobs README](../../../../apps/api/src/background-jobs/README.md) |
| `DatabaseTableDeadTuplesHigh`                                              | warning            | `table` label의 dead tuple 비율·수(비율 20%·수 50 초과가 24시간)와 autovacuum 시각. RDS Database Insights에서 vacuum 진행을 본다                                       |
| `HostDiskUsageHigh`·`HostDiskUsageCritical`·`HostInodeUsage*`              | warning / critical | Grafana host 지표. Docker image·json-file log·관측 volume 증가를 보고, 보존 기간을 줄이기 전에 Owner와 정한다                                                          |
| `HostRootFilesystemMetricsMissing`                                         | warning            | root filesystem(`mountpoint="/"`) 지표가 없어 disk·inode 경보가 꺼진 상태. Alloy의 host `/` mount와 fs type을 본다                                                     |
| `HostMemoryAvailableLow`                                                   | critical           | container별 memory(Grafana)와 limit. API 응답이 늦으면 API 단계 runbook의 rollback을 먼저 본다                                                                         |
| `ApiMetricsTargetDown`                                                     | critical           | API readiness와 scrape token 파일(document가 API secret release에서 다시 씀). API가 내려갔으면 API 단계 runbook                                                        |
| `ObservabilityTargetDown`·`PrometheusAlertmanagerUnreachable`              | warning            | 그 관측 container의 상태. 같은 묶음을 다시 배포하면 관측 단계가 다시 띄운다                                                                                            |
| `AlertmanagerNotificationsFailing`                                         | warning            | Slack 전달 실패. [alert delivery incident](../../incidents/observability-alert-delivery.md)                                                                            |

경보를 끄거나 기준을 바꾸려면 rule 파일과 그 promtool test(`infra/observability/prometheus/tests`)를 같은 PR에서 고친다.

## Retention, volume, host alert

| Volume              | 분류                              | 기본 복구 방식                   |
| ------------------- | --------------------------------- | -------------------------------- |
| `prometheus-data`   | 재생성 가능한 운영 metric         | scrape 재개, 이전 구간 손실 승인 |
| `loki-data`         | 재생성 가능한 운영 log            | ingest 재개, 이전 구간 손실 승인 |
| `alloy-data`        | collector position                | 재생성, 중복/누락 범위 확인      |
| `grafana-data`      | Git provisioning 기반 재생성 가능 | dashboard/datasource 재provision |
| `alertmanager-data` | silence 운영 상태                 | 손실 승인(silence는 다시 건다)   |

Named volume 자체에는 portable quota가 없다. Host disk·inode·memory 경보는 host 지표로 Prometheus가 판정한다(disk·inode 80% warning,
90% critical, 사용 가능 memory 10% 미만 critical, `production-operations.json`). 관측 stack이 멈추면 이 경보도 멈추므로 Lightsail
기본 지표(CPU·network)와 외부 가용성 alarm이 그동안의 바닥이다. Prometheus/Loki operational data는 제품 DB source of truth가 아니다.

## Alloy Docker socket 위험

Alloy는 Docker stdout을 찾기 위해 `/var/run/docker.sock`을 읽기 전용으로 mount하고 host 지표를 위해 host `/`·`/proc`·`/sys`를 읽기
전용으로 mount한다. socket 접근 때문에 관측 다섯 가운데 Alloy만 root(`0:473`)로 돈다(capability는 모두 떨어뜨리고
no-new-privileges, root filesystem 읽기 전용). 수집 대상은 compose project `dormduri-web`의 service `api|ingress|web`으로 제한한다.

`read_only` mount는 파일 mount 변경을 막을 뿐 Docker API 권한을 조회 전용으로 축소하지 않는다. 따라서 immutable image, private
port, resource/capability 제한, service allowlist, fail-open 검증을 compensating control로 사용하고, socket 사용과 위험 수용을 API
단계 배포 기록의 관측 component 줄에 적는다.

다른 신뢰 경계의 workload, multi-tenant host, collector supply-chain risk 또는 security incident가 발생하면 host-level
journald/file tail, Docker logging driver, managed logging 중 하나로 전환한다.

## Local production profile

`observability-production` profile(`infra/observability/compose.*.yml`)은 local에서 운영 설정 조합과 preflight를 rehearsal하는
용도다. 실제 값은 ignored `infra/observability/.env.observability`와 별도 token file에만 둔다.

```bash
pnpm observability:check:production
pnpm infra:compose -- observability-production config
pnpm infra:compose -- observability-production up -d
pnpm infra:compose -- observability-production down
```

Production preflight는 다음 입력을 fail-closed로 검사한다.

- `OBSERVABILITY_ENV=production`
- private runtime network의 `API_METRICS_TARGET`
- 32자 이상의 non-placeholder metrics bearer token file
- default가 아닌 Grafana operator와 16자 이상의 non-placeholder password
- Prometheus 15일, Loki 30일, Alertmanager 5일 retention
- Slack delivery 활성화 시 유효한 Incoming Webhook URL

Local example, `.example`/`.local` token, `host.docker.internal`, 기본 Grafana credential은 production profile에서 허용하지 않는다.
원본 secret은 report나 CI artifact에 기록하지 않는다. 같은 명령이 user host 조각의 관측 다섯도 운영 계약과 대조한다.

## 종료와 cleanup

User host의 관측 container는 API 배포 document만 다시 띄운다. 손으로 `down`하지 않는다(project 전체를 내린다). Volume까지 삭제하는
명령은 운영 데이터 손실 작업이므로 자동 cleanup에 포함하지 않는다. 삭제 전 volume classification과 손실 승인을 확인한다.
