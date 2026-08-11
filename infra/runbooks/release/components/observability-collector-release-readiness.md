# Observability collector release readiness

## 책임과 현재 후보

이 문서는 container stdout을 Loki로 전달하는 collector의 release trust boundary를 결정한다. 실제
선택과 결과는 [observability-collector-release-evidence.md](./observability-collector-release-evidence.md)에
기록한다. 현재 상태는 `PENDING_TARGET`다.
`PENDING_TARGET`는 실패가 아니다. 실제 host trust boundary가 아직 없다는 뜻이다.

초기 전용 single-tenant VPS에서는 Alloy container와 Docker socket을 제한적으로 유지할 수 있다.
`/var/run/docker.sock:ro`는 쓰기 mount를 줄일 뿐 Docker API authorization boundary가 아니다.

## Socket 유지 조건

다음 조건을 모두 충족할 때만 `KEEP_SOCKET` 후보로 둘 수 있다.

- host가 KNU Roommate 전용 single-tenant workload만 실행한다.
- host/operator 접근자가 제한되고 최소 권한·감사 경계가 있다.
- Alloy image는 immutable digest로 고정하고 supply-chain 검증을 통과한다.
- discovery allowlist가 Compose service `api|nginx|web`으로 제한된다.
- 관측 port는 private이며 collector 장애가 제품 readiness와 요청을 막지 않는다.
- resource limit, log rotation, retention, disk/inode alert와 incident owner가 있다.
- socket 제거 trigger와 대체 경로를 release evidence에 승인한다.

## Socket 제거 trigger

하나라도 해당하면 socket을 유지하지 않고 대체 방식을 선택한다.

- 서로 다른 신뢰 수준의 workload 또는 tenant가 같은 host를 사용한다.
- 복수 팀·운영자가 Docker control plane에 접근한다.
- Alloy 또는 image supply-chain incident가 발생한다.
- Docker socket을 통한 과도한 container metadata 접근이 발견된다.
- host-level logging이나 managed logging을 안정적으로 운영할 역량이 마련된다.

## 대체 수집 방식

| Mode                     | 적합한 조건                                               | 주요 trade-off                                        |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| `MIGRATE_HOST_TAIL`      | Host Alloy가 journald 또는 제한된 log file만 읽을 수 있음 | host service 운영과 file permission 설계 필요         |
| `MIGRATE_LOGGING_DRIVER` | Docker logging driver가 remote endpoint로 직접 전달 가능  | Docker daemon 설정과 buffering/failure 정책 검증 필요 |
| `MIGRATE_MANAGED`        | Managed log agent/provider의 비용·보안·retention을 수용   | vendor 비용과 egress, provider 장애 경계 필요         |

## Release 검증

```bash
pnpm observability:check:production
pnpm infra:compose -- observability-production config
pnpm web:observability:rehearsal
```

Target에서는 다음을 추가로 확인한다.

1. Compose render와 `docker inspect`로 실제 socket mount, image digest, resource limit를 확인한다.
2. Alloy discovery 결과에 허용 service 외 container가 없는지 확인한다.
3. Collector 중단·Loki 중단 중 API/Web 요청이 유지되는지 확인한다.
4. Log rotation, disk 증가량, retention, recovery time을 확인한다.
5. Troubleshooting runbook으로 즉시 격리와 선택한 대체 방식의 rollback을 rehearsal한다.

## 중단 조건

- target trust boundary를 설명할 수 없으면 `PENDING_TARGET`로 멈춘다.
- mixed-trust/multi-tenant host에서 socket을 요구하면 `FAIL`이다.
- collector 장애가 사용자 요청을 막거나 secret/raw body를 수집하면 `FAIL`이다.
- 제거 trigger와 migration owner가 없으면 socket 유지 결정을 승인하지 않는다.

Incident와 전환 절차는
[observability-collector-troubleshooting.md](../../incidents/observability-collector-troubleshooting.md)를 따른다.
