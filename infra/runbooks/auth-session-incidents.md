# Login/session incident runbook

이 문서는 로그인 비밀번호 검증 포화와 renewal token 재사용 경보를 조사할 때 사용하는 운영 절차다. 사용자 email, IP, session/token 원문은 dashboard·Slack·incident 문서에 기록하지 않는다.

## Dashboard queries

```promql
sum by (outcome) (rate(api_auth_login_attempts_total[5m]))
```

```promql
histogram_quantile(
  0.95,
  sum by (le, target) (
    rate(api_auth_login_password_verify_duration_seconds_bucket[5m])
  )
)
```

```promql
sum by (target) (api_auth_login_password_verify_in_flight)
```

```promql
sum by (outcome) (rate(api_auth_session_renewals_total[5m]))
```

`target`은 `real` 또는 `dummy`, renewal `outcome`은 `renewed`, `required`, `stale`, `reused`만 허용한다. 사용자 식별자나 raw route를 label로 추가하지 않는다.

## Password verify saturation

`AuthPasswordVerifyInFlightHigh`는 real/dummy 비밀번호 검증 합계가 5분 동안 8개 이상 유지될 때 발생한다. 현재 4GB/2 vCPU 단일 API 후보 스펙에서 지속적인 8개 동시 Argon2id 연산은 latency와 memory pressure를 함께 확인해야 하는 신호다.

1. Grafana에서 real/dummy p95와 in-flight를 함께 확인한다.
2. API HTTP p95·5xx, container CPU/memory, Prisma waiting connection을 같은 시간 범위로 확인한다.
3. `api_auth_login_throttle_total` 증가 여부로 network abuse와 정상 피크를 구분한다.
4. 단일 actor/email/IP을 metric label이나 공유 문서에서 찾지 않는다. 필요한 원인 조사는 접근 통제된 structured security event에서 수행한다.
5. 서비스가 회복되지 않으면 login burst/sustained guard를 보수적으로 조정하거나 API replica/capacity를 확장한다.
6. Argon2id memory profile 변경은 `.omx/plans/password-policy-unicode-argon2id-migration-plan.md`의 stress gate 없이 진행하지 않는다.

## Renewal token reuse

`AuthSessionRenewalReuseDetected`는 previous-token grace에 포함되지 않는 갱신 토큰이 사용되어 해당 session family가 revoke됐음을 의미한다.

1. `api_auth_session_renewals_total`에서 `reused`가 단발인지 반복인지 확인한다.
2. 같은 시간대의 `stale` 증가는 정상적인 다중 tab rotation 경합일 수 있으므로 `reused`와 분리한다.
3. `SESSION_TOKEN_REUSE_DETECTED` security event의 bounded metadata만 확인한다. token/cookie 원문은 조회·복사하지 않는다.
4. 반복 재사용이 확인되면 영향을 받은 session family는 이미 fail-closed revoke되므로 전체 사용자 세션을 일괄 revoke하지 않는다.
5. 광범위한 재사용, cookie transport 이상, 배포 직후 급증이면 auth 배포를 중단하고 `infra/runbooks/incident-rollback.md` 절차로 전환한다.

## Release evidence

Release 전 다음 결과를 함께 보관한다.

- concurrent renewal integration: 동일 token에서 성공 1개, 나머지 stale, family revoke 없음
- full-stack browser renewal: remember-off access 만료 후 access/renewal cookie rotation
- k6 auth login capacity: real/dummy 1:1, p95·p99·check rate
- Grafana readout: login outcome, password verify p95/in-flight, renewal outcome

Stress report에는 raw email/password/token/cookie/Authorization header를 기록하지 않는다.
