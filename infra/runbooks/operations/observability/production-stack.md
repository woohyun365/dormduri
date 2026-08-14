# Observability production operations

## 목적과 경계

이 문서는 Prometheus, Loki, Alloy, Alertmanager, Grafana를 전용 single-tenant App VPS에서
private stack으로 운영할 때의 runtime 경계를 소유한다. 실제 host, disk, backup, operator 결과는
release evidence에서 채우며 이 문서의 local 검증 결과를 production 증거로 대체하지 않는다.
Collector trust boundary의 준비와 실제 결과는 각각
[`collector readiness`](../../release/components/observability-collector/readiness.md)와
[`collector evidence`](../../release/components/observability-collector/evidence.md)가 소유한다. 장애·전환 절차는
[`collector incident`](../../incidents/observability-collector.md)를 따른다.

Canonical machine-readable contract는
`infra/observability/production-operations.json`, production Compose 조합은
`observability-production` profile이다.

## 시작 전 검증

실제 값은 ignored `infra/observability/.env.observability`와 별도 token file에만 둔다.

```bash
pnpm observability:check:production
pnpm infra:compose -- observability-production config
pnpm infra:compose -- observability-production up -d
```

Production preflight는 다음 입력을 fail-closed로 검사한다.

- `OBSERVABILITY_ENV=production`
- private runtime network의 `API_METRICS_TARGET`
- 32자 이상의 non-placeholder metrics bearer token file
- default가 아닌 Grafana operator와 16자 이상의 non-placeholder password
- Prometheus 15일, Loki 30일, Alertmanager 5일 retention
- Slack delivery 활성화 시 유효한 Incoming Webhook URL

Local example, `.example`/`.local` token, `host.docker.internal`, 기본 Grafana credential은
production profile에서 허용하지 않는다. 원본 secret은 report나 CI artifact에 기록하지 않는다.

## Network와 operator 접근

- 모든 published port는 `127.0.0.1`에만 bind한다.
- VPS firewall과 provider security group에서도 관측 port를 public ingress에 노출하지 않는다.
- 운영자는 SSH tunnel 또는 승인된 private operator network를 통해 Grafana에 접근한다.
- Prometheus와 Loki API에는 application-level 인증이 없으므로 public reverse proxy를 두지 않는다.
- Grafana anonymous access와 self sign-up은 비활성화한다.

## Health와 장애 격리

| Service      | readiness owner                              | 제품 요청 의존성 |
| ------------ | -------------------------------------------- | ---------------- |
| Prometheus   | container `/-/ready` + external rehearsal    | 없음, fail-open  |
| Loki         | external `/ready` probe                      | 없음, fail-open  |
| Alloy        | external `/-/ready` probe                    | 없음, fail-open  |
| Alertmanager | container `/-/ready`                         | 없음, fail-open  |
| Grafana      | container `/api/health` + external rehearsal | 없음, fail-open  |

`pnpm web:observability:rehearsal`은 Web BFF 성공 요청을 기준으로 Loki, Prometheus, Grafana를
각각 중단하고 제품 응답 유지, component recovery, recovery milliseconds를 기록한다.
관측 component 장애가 API/Web readiness를 실패시키거나 사용자 요청을 차단해서는 안 된다.

## Retention, volume, host alert

| Volume              | 분류                              | 기본 복구 방식                        |
| ------------------- | --------------------------------- | ------------------------------------- |
| `prometheus-data`   | 재생성 가능한 운영 metric         | scrape 재개, 이전 구간 손실 승인      |
| `loki-data`         | 재생성 가능한 운영 log            | ingest 재개, 이전 구간 손실 승인      |
| `alloy-data`        | collector position                | 재생성, 중복/누락 범위 확인           |
| `grafana-data`      | Git provisioning 기반 재생성 가능 | dashboard/datasource 재provision      |
| `alertmanager-data` | silence 운영 상태                 | release 시 backup 또는 손실 승인 결정 |

Named volume 자체에는 portable quota가 없으므로 disk/inode 경고는 관측 stack이 자기 자신을
조회해서 판정하지 않는다. Host 또는 provider monitoring owner가 다음 기준을 구성한다.

- disk 사용률 warning 80%, critical 90%
- inode 사용률 warning 80%, critical 90%
- retention 설정과 실제 일별 증가량으로 release 전 여유 기간 확인

실제 alert route, volume identifier, backup/restore 또는 허용 손실 범위는 target release evidence에
기록한다. Prometheus/Loki operational data는 제품 DB source of truth가 아니다.

## Alloy Docker socket 위험

초기 전용 single-tenant VPS에서는 Alloy가 Docker stdout을 찾기 위해
`/var/run/docker.sock`을 사용한다. 수집 대상은 Compose service `api|nginx|web`으로 제한한다.

`read_only` mount는 파일 mount 변경을 막을 뿐 Docker API 권한을 조회 전용으로 축소하지 않는다.
따라서 immutable image, private port, resource/capability 제한, service allowlist, fail-open 검증을
compensating control로 사용하고 socket 사용과 위험 수용을 release evidence에 명시한다.

다른 신뢰 경계의 workload, multi-tenant host, collector supply-chain risk 또는 security incident가
발생하면 host-level journald/file tail, Docker logging driver, managed logging 중 하나로 전환한다.

## 종료와 cleanup

```bash
pnpm infra:compose -- observability-production down
```

Volume까지 삭제하는 명령은 운영 데이터 손실 작업이므로 자동 cleanup에 포함하지 않는다.
삭제 전 volume classification과 release evidence의 backup/accepted-loss 결정을 확인한다.
