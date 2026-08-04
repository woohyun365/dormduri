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

```promql
api_auth_mail_outbox_lag_seconds
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

## Verification and reset abuse

Reset abuse는 `api_auth_verification_operations_total`의 reset request `accepted`/`throttled` 변화와 code request backstop으로 확인한다. 감사 이벤트를 재조회해 별도 임계치를 만들지 않는다.

1. `api_auth_verification_operations_total{scope="reset_password"}`에서 request/verify/grant 흐름을 함께 확인한다.
2. 로그인 실패·lockout 증가와 같은 시간대인지 확인하되 사용자 식별자를 metric label이나 incident 문서에 옮기지 않는다.
3. 정상 사용 급증이 아니라면 code request backstop과 network throttle 상태를 확인한다.
4. CAPTCHA/step-up 도입은 경보 한 번으로 즉시 결정하지 않고 반복 빈도와 false-positive evidence를 남긴 뒤 별도 정책 변경으로 진행한다.

## Auth mail delivery

`AuthMailFailureSpike`는 owner-local dispatch counter에서 10분 동안 `failed`/`unknown` outcome이 3회 이상, `AuthMailOutboxLagHigh`는 dispatcher가 관측한 가장 오래된 처리 가능 outbox가 60초를 넘긴 상태다.

1. `api_auth_mail_dispatch_total`의 `failed`, `unknown`, `superseded`, `accepted`를 비교한다.
2. `api_auth_mail_outbox_lag_seconds`, dispatcher container health, DB connection waiting을 같은 시간 범위로 확인한다.
3. SES Configuration Set event publishing에서 delivery, bounce, complaint를 확인한다. API의 `ACCEPTED`는 provider 접수이며 최종 전달 성공과 동일하지 않다.
4. provider 원문 오류·수신 이메일·message id를 Slack/Grafana label에 노출하지 않고 bounded error category와 outbox event id만 제한된 운영 로그에서 사용한다.
5. `UNKNOWN` payload는 중복 메일 위험 때문에 자동 재전송하지 않는다. 사용자가 새 코드를 요청하도록 유지하고 provider 상태를 먼저 확인한다.

## Sensitive mutation admission

닉네임 확인과 최종 가입은 active signup grant fingerprint를, 비밀번호 변경은 authenticated actor/session fingerprint를 primary budget으로 사용한다. 기본 IP 제한은 secondary boundary이며 login account lock과 별개다.

1. `api_auth_signup_nickname_validation_total`, `api_auth_signup_final_admission_total`, `api_auth_sensitive_mutations_total`의 bounded outcome만 확인한다.
2. final admission `throttled`가 증가할 때 password hash `started`가 같은 비율로 증가하지 않는지 확인한다. 제한은 hash보다 먼저 실행되어야 한다.
3. change-password throttle이 증가하면 로그인 lock row를 조정하지 말고 session 단위 제한과 전역 IP 제한을 구분한다.
4. shared NAT 의심 시 raw IP를 dashboard label에 추가하지 않는다. 접근 통제된 HMAC security dimension과 aggregate HTTP 지표를 함께 조사한다.
5. multi-instance limiter 우회가 의심되면 request log와 throttle metric, production-like 부하 evidence를 함께 분석한다. 특정 인프라 도입 여부를 runtime auth state로 계산하지 않는다.

## Credential mutation durability

`AuthCredentialDurabilityFailure`는 비밀번호 변경 transaction 안의 replacement session, mail outbox, 필수 audit append 중 하나가 실패했음을 의미한다. 이 경로는 전체 transaction을 rollback하므로 부분 성공으로 취급하지 않는다.

1. `api_auth_sensitive_mutations_total{operation="change_password"}`에서 실패 stage를 확인한다.
2. 같은 시간대의 Prisma transaction retry/exhausted, pool waiting, DB 5xx를 확인한다.
3. replacement session 실패면 session insert constraint/DB availability, outbox 실패면 encrypted envelope insert, audit 실패면 `AuthSecurityEvent` write를 각각 점검한다.
4. 사용자 password·email·session id·IP를 metric label이나 incident 문서에 기록하지 않는다.
5. 실패 요청은 성공으로 복구하지 말고 사용자가 기존 session에서 재시도하도록 한다. transaction commit 여부가 불명확하면 DB의 credential/session/audit invariant를 먼저 확인한다.

## Release evidence

Release 전 다음 결과를 함께 보관한다.

- concurrent renewal integration: 동일 token에서 성공 1개, 나머지 stale, family revoke 없음
- full-stack browser renewal: remember-off access 만료 후 access/renewal cookie rotation
- k6 auth login capacity: real/dummy 1:1, p95·p99·check rate
- Grafana readout: login outcome, password verify p95/in-flight, renewal outcome

Stress report에는 raw email/password/token/cookie/Authorization header를 기록하지 않는다.
