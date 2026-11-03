# Infra evidence

로컬 rehearsal·image build·운영 후보 infra의 개선 근거 기록입니다. 현재 규칙과 동작은 owner 문서가 소유합니다.

- 로컬 Docker 자원 정리·label·임시 PostgreSQL: [로컬 환경 runbook](../../../infra/runbooks/rehearsal/local-environments.md)
- Full-stack rehearsal 실행·정리: [full-stack runbook](../../../infra/runbooks/rehearsal/full-stack.md)
- Artifact builder: local OCI build는 Web CD build가 대체해 지웠고([Web 단계 배포](../../../infra/runbooks/release/web-stage-deploy.md)),
  남은 builder 정리는 [로컬 환경 runbook](../../../infra/runbooks/rehearsal/local-environments.md#builder-cache)

| 문서                                                                   | 기록                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [로컬 Docker 자원 정리 evidence](./local-docker-resources-evidence.md) | Full-stack image·ingress fixture 이전 판·artifact builder cache가 쌓이던 원인, 정리 전후 수치, 공통 label, 기각한 대안 |
