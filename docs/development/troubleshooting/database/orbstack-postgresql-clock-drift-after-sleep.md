# OrbStack PostgreSQL clock drift after macOS sleep

**상태**: Current
**마지막 검증 환경**: macOS, OrbStack 2.2.3, PostgreSQL 18.6, Node.js 24
**현재 owner**: `docker-compose.dev.yml`, `apps/api/test/integration`, `apps/api/test/e2e`

## 증상

로컬 DB를 사용하는 시간 경계 테스트가 함께 실패할 수 있습니다.

- outbox event의 `availableAt`이 아직 미래라고 판정됩니다.
- cooldown·만료·retry window가 예상보다 길게 남습니다.
- host에서 만든 timestamp와 PostgreSQL `clock_timestamp()`의 차이가 테스트 허용 오차보다 큽니다.
- 같은 변경을 fresh GitHub Actions PostgreSQL service에서 실행하면 재현되지 않을 수 있습니다.

제품 assertion을 수정하기 전에 host, container, PostgreSQL 시계를 같은 시점에 비교합니다.

```bash
python3 -c 'import time; print(f"host={time.time():.6f}")'
docker exec knu-roommate-postgres-dev date +%s.%N
docker exec knu-roommate-postgres-dev \
  psql -U knu_dev -d knu_roommate -Atc \
  "select extract(epoch from clock_timestamp());"
```

macOS가 최근 sleep/wake를 수행했는지도 함께 확인합니다.

```bash
pmset -g log | grep -Ei 'sleep|wake|darkwake' | tail -n 40
orbctl version
```

## 원인 판별

macOS의 Linux container는 host kernel을 직접 공유하지 않고 VM 안에서 실행됩니다. 장시간 유지된 VM이 macOS
sleep/wake 이후 host wall clock을 따라잡지 못하면 container와 PostgreSQL이 같은 양만큼 뒤처질 수 있습니다.

다음 순서로 owner를 구분합니다.

| 관측                                            | 분류                    | 다음 확인                                         |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------- |
| host 자체 시간이 외부 기준과 다름               | macOS host              | host time synchronization을 복구한 뒤 재측정      |
| container와 PostgreSQL이 같은 offset으로 뒤처짐 | OrbStack VM clock       | OrbStack engine/VM을 완전히 재시작한 뒤 재측정    |
| container는 맞고 PostgreSQL만 다름              | database process/config | PostgreSQL process, image, extension을 조사       |
| 모든 clock이 맞지만 테스트가 실패함             | product/migration/test  | 변경된 query, transaction, timestamp owner를 조사 |

`TZ=Asia/Seoul`과 PostgreSQL `timezone=Asia/Seoul`은 timestamp의 표시·해석 timezone을 정합니다. Unix epoch 자체가
수 초 어긋나는 현상을 만들거나 해결하지 않으므로, epoch drift를 timezone 설정 변경으로 우회하지 않습니다.

2026-09-02 로컬 통제 실험에서는 host보다 container와 PostgreSQL이 약 4초 느렸고, 동일 image·volume·Compose YAML을
유지한 채 OrbStack engine/VM을 새로 시작하자 정상 범위로 정렬되었습니다. 그 직후 같은 API prepare, integration,
e2e 명령이 통과했습니다. 이는 package migration이나 Compose 변경보다 stale VM clock을 원인으로 지지하는 repository
evidence이며, 특정 OrbStack release의 vendor-confirmed defect라는 뜻은 아닙니다.

## 해결

1. 현재 repository DB 작업을 정상 종료합니다.
2. OrbStack Docker engine/VM을 완전히 중지한 뒤 다시 시작합니다.
3. 개발 DB를 시작하고 세 clock을 다시 측정합니다.
4. clock offset이 테스트 허용 범위 안에 들어온 뒤 migration/prepare와 실패한 DB suite를 재실행합니다.

```bash
pnpm db:down
# OrbStack UI 또는 지원되는 orbctl lifecycle 명령으로 engine/VM을 완전히 재시작
pnpm db:up

CI=true pnpm api:prepare
CI=true pnpm api:test:integration:prepared
CI=true pnpm api:test:e2e:prepared
```

제품의 TTL, cooldown, outbox delay 또는 테스트 tolerance를 늘려 환경 drift를 숨기지 않습니다. 실제 배포 환경의
시간 동기화는 별도 infrastructure/release owner가 책임지며, 이 문서는 로컬 개발 VM 복구만 소유합니다.

## 검증과 재발 handoff

macOS sleep/wake 이후 time-sensitive DB suite를 실행할 때 다음 증거를 남깁니다.

1. host/container/PostgreSQL epoch와 최대 offset
2. `orbctl version`
3. 최근 sleep/wake 시각
4. VM 재시작 전후 offset
5. 재시작 후 실패 suite 결과

동일 OrbStack version에서 반복되면 `orbctl report`로 민감정보를 검토한 진단 bundle을 생성하고 upstream issue에
version, sleep/wake 조건, 정제한 offset, 최소 재현 절차를 제공합니다. Fresh GitHub Actions PostgreSQL service 결과는
repository acceptance evidence로 유지하되, 로컬 drift 자체를 없었던 일로 취급하지 않습니다.

## 참고

- [Docker Desktop for Mac time drift explanation](https://www.docker.com/blog/addressing-time-drift-in-docker-desktop-for-mac/)
- [Docker for Mac: container time drift after sleep](https://github.com/docker/for-mac/issues/2076)
- [OrbStack: sleep/wake can leave VM state degraded](https://github.com/orbstack/orbstack/issues/1933)
- [OrbStack: containers affected after macOS sleep](https://github.com/orbstack/orbstack/issues/2003)
