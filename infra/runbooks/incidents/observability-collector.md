# Observability collector troubleshooting

## 목적

이 runbook은 Alloy/Docker log collection 장애 또는 trust boundary 변경 시 제품 요청을 유지하면서
collector를 격리하고, socket 유지·host tail·logging driver·managed logging 중 다음 경로를 결정한다.

## 증상별 첫 확인

| 증상                             | 확인                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Loki에 새 API/Web log가 없음     | Alloy readiness, Loki readiness, Alloy position, target discovery      |
| Docker socket permission denied  | 실제 mount, host socket permission, container user, Docker daemon 상태 |
| 허용하지 않은 container log 수집 | discovery label/filter와 rendered Alloy config                         |
| 같은 log가 중복 수집됨           | Alloy position volume, duplicate collector, logging driver 이중 전송   |
| Disk 또는 inode가 빠르게 증가    | container log rotation, Loki retention, volume/host usage              |
| Collector compromise 의심        | Alloy image digest, 최근 변경, socket 접근, 예상 밖 Docker API 호출    |

## 확인 명령

```bash
pnpm infra:compose -- observability-production config
pnpm infra:compose -- observability-production ps
pnpm infra:compose -- observability-production logs alloy loki
docker inspect $(docker ps -q --filter label=com.docker.compose.project=dormduri-observability --filter label=com.docker.compose.service=alloy)
docker inspect $(docker ps -q --filter label=com.docker.compose.project=dormduri-api)
curl --fail --silent http://127.0.0.1:12345/-/ready
curl --fail --silent http://127.0.0.1:3100/ready
```

Compose file은 `container_name`을 정하지 않으므로 container 이름은 project 이름에서 나온다. 이름을 적지 말고 Compose가
붙이는 project·service label로 찾는다. 이 조회는 profile의 env 보간(`API_IMAGE_TAG` 등)이 필요 없다. Web container는 그
Web compose project 이름으로 같은 방식으로 찾는다.
실제 loopback port는 rendered Compose 결과를 따른다. 명령 출력에 env, label,
mount path 등 민감 정보가 포함될 수 있으므로 원문 전체를 issue/evidence에 첨부하지 않는다.

## 즉시 격리

1. 사용자 요청과 API/Web readiness가 정상인지 먼저 확인한다.
2. Collector compromise 또는 과도한 Docker API 접근이 의심되면 Alloy를 중지한다.
3. Socket mount가 포함된 collector를 stack에서 제거하고 Docker daemon 접근을 차단한다.
4. Loki/Prometheus/Grafana public exposure가 없는지 firewall과 published port를 확인한다.
5. Application stdout rotation을 유지해 disk saturation을 막는다.
6. Incident time, release SHA, collector digest, 영향 범위, 격리 시각을 secret-free하게 기록한다.

관측 장애는 제품 요청에 fail-open이어야 한다. 관측 복구를 위해 API/Web를 불필요하게 중지하지 않는다.

## 전환 후보와 실행 순서

### Host Alloy + journald/file tail

1. Host service account가 승인된 journal unit 또는 log file만 읽도록 구성한다.
2. Docker socket mount를 제거한다.
3. Position/state directory와 rotation permission을 확인한다.
4. 중복·누락 구간과 host service restart를 rehearsal한다.

### Docker logging driver

1. Driver endpoint, buffer, retry, blocking/non-blocking 정책을 정한다.
2. Collector socket mount를 제거하고 container별 driver 설정을 render한다.
3. Remote endpoint 장애 중 container와 제품 요청이 유지되는지 확인한다.
4. 기존 Alloy 전송과 겹치는 기간의 duplicate를 점검한다.

### Managed logging

1. Region, retention, egress, operator access, DPA/privacy 경계를 결정한다.
2. Agent 또는 driver에 최소 권한 credential을 주입하고 값은 evidence에 남기지 않는다.
3. Secret/raw body negative search와 kill switch를 검증한다.
4. Provider 장애 중 제품 요청이 유지되는지 확인한다.

## Rollback

- 새 수집 경로가 log 누락, 중복, disk 증가 또는 제품 지연을 만들면 즉시 비활성화한다.
- 직전 정상 collector mode와 immutable image digest로 돌아간다.
- Socket mode로 돌아가야 한다면 readiness 문서의 모든 유지 조건을 다시 확인하고 risk owner 승인을 받는다.
- 복구 뒤 synthetic request의 request ID가 Application stdout과 Loki에서 연결되는지 확인한다.
- 실제 선택, rollback 결과, 남은 risk는 collector evidence와 aggregate evidence에 연결한다.

## 종료 조건

- 허용 target log만 수집된다.
- Collector/Loki 장애가 API/Web 응답을 막지 않는다.
- Socket 유지 또는 제거 사유, owner, review date, rollback evidence가 기록된다.
- Secret, raw body, authorization material의 수집이 없음을 확인한다.
