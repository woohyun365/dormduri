# Lightsail secret delivery local rehearsal

## 목적

AWS 계정 없이 secret-per-file release algorithm과 현재 release 보호를 검증한다. 이 결과는 실제 AWS
IAM, OIDC, CloudTrail 또는 Lightsail release 성공 증거를 대신하지 않는다.

## 실행

```bash
pnpm infra:rehearsal:lightsail-secrets
```

## Fault matrix

| Fault                              | 기대 결과                                             |
| ---------------------------------- | ----------------------------------------------------- |
| source fetch/materialization 실패  | candidate 미생성, 원문 미출력                         |
| interrupted/partial candidate      | verify 실패, current 유지                             |
| 잘못된 mode/symlink/blank/oversize | bounded failure, current 유지                         |
| bootstrap timeout/readiness 실패   | 새 listener/traffic 미전환                            |
| activation 실패                    | previous current symlink 유지                         |
| host restart                       | persistent version directory와 current pointer로 복구 |

결과물은 runner temp 또는 `artifacts/local/`만 사용하며 bundle 자체는 artifact로 보존하지 않는다.
로그에는 bounded result, release ID, timestamp만 남긴다.

Bootstrap 전에 실패하면 API listener와 Prometheus endpoint가 열리지 않는 것이 정상이다. 운영에서는
container restart count, health/readiness 연속 실패와 nginx upstream failure를 조합한 alert를 둔다.
해당 alert는 secret name/path/provider payload를 label 또는 annotation에 포함하지 않는다.
