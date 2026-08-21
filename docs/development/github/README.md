# GitHub collaboration

GitHub와 local Git은 서로 다른 검증 책임을 가집니다. Local hook은 빠른 피드백을 제공하고, pull request와 CI는
review·merge에 필요한 변경 설명과 재현 가능한 correctness evidence를 소유합니다.

- [Collaboration guide](./collaboration.md): branch, commit, pull request, local hook과 검증 기준
- [Branch and PR strategy](./branch-and-pr-strategy.md): fresh `dev`, bounded implementation branch와 dependent PR 순서
- [Authentication and operator access](./authentication-and-operator-access.md): Git·gh·Connector·Actions token의 최소 권한,
  확인과 recovery 경계
- [Remote repository settings](./remote-repository-settings.md): repository 파일 밖 GitHub 설정의 기대값과 evidence
- [Hosted Renovate provider readiness](./renovate-provider-readiness.md): 설치 전 permission·data·operator·revoke GO/NO-GO handoff

CI lane과 변경 분류 구조는 [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)를 따릅니다. Commit과
PR 제목의 canonical convention은 root [`AGENTS.md`](../../../AGENTS.md)가 소유합니다.
