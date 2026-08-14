# Product observability validation runbooks

이 디렉터리는 API/Auth 같은 **제품·서비스 동작**의 용량과 release 품질을 관측 데이터로 검증하는
절차를 소유한다.

- `api-stress-release-runbook.md`: HTTP·realtime stress와 제품 metric 판정
- `auth-password-capacity-rehearsal-runbook.md`: 비밀번호 hash workload의 local capacity 검증

Prometheus·Loki·Grafana·Alloy·Alertmanager 자체의 설치, 운영, Slack delivery, 장애 복구는
`infra/runbooks/operations/observability/`와 `infra/runbooks/incidents/`가 소유한다. 이 문서는
infrastructure target을 생성하거나 실제 release aggregate decision을 기록하지 않는다.
