# Repository documentation

`docs/`는 Git으로 추적되는 현재 source of truth만 소유합니다. 모든 clone, CI, review 환경에서 같은 문서 집합을 볼 수 있어야 합니다.

- [`policies/`](./policies/): 제품·운영 정책과 책임 경계
- [`product/`](./product/README.md): 제품 요구(PRD) 묶음과 산출물 추적 대응 기록
- [`architecture/`](./architecture/): 장기 유지하는 기술 결정과 설계 근거
- [`runbooks/`](./runbooks/): 반복 가능한 운영·복구 절차
- [`development/`](./development/): 개발·CI·협업 기준과 재사용 가능한 개발·테스트 troubleshooting. 처음 참여하면 [Onboarding](./development/onboarding.md)부터 봅니다
- [`deploy/`](./deploy/README.md): 지금 적용한 운영 환경과 서버·도메인·메일 비용(식별자 없음). 배포·복구 절차는 `infra/runbooks/`가 소유합니다
- [`evidence/`](./evidence/README.md): 개선 작업의 측정값·설계 근거·문제 해결 이유를 재현 가능한 형태로 남긴 사람 대상 기록(규칙의 owner 아님)
- [`portfolio/`](./portfolio/evidence-instruction.md): 개선 작업의 evidence를 기록·승격하는 작업 지침(초안 저장소 아님). public portfolio 추출에서 디렉터리째 제외

과거 계획, 개인 분석, PR review 기록, 첨부 자료, 계획에 묶이지 않은 포트폴리오 초안은 Git에서 제외되는 `.local-docs/`가 소유합니다. 지운 문서는 Git 이력에서 찾고, 저장소 안에 archive 디렉터리를 두지 않습니다. Run ID·commit·명령으로 다시 산출할 수 있는 측정 기록만 `evidence/`에 둡니다. 진행 중인 계획은 host 공통 `.plans/`에, 계획 증거(계획 진행 중의 evidence 초안 포함)와 저장소 검증 결과는 `.artifacts/`에 둡니다. [Artifact 보존 규칙](../.artifacts/README.md#보존과-정리)에 따라 재생성 가능한 출력과 역사적 관측 원본을 구분합니다.

Canonical 문서와 production code의 현재 동작·결정·다음 작업을 이해하는 데 ignored 원문이나 private archive가 필요해서는 안 됩니다. 날짜가 명확한 과거 검증 사례는 보존된 관측 원본의 식별자를 evidence로 연결할 수 있지만, 그 로컬 경로를 현재 실행의 필수 입력이나 완료 증거로 대체하지 않습니다. 새 세션 인계는 [Session continuity](./development/agent-workflows/session-continuity.md#portable-handoff)의 tracked 문서·Issue·PR 경로를 따릅니다.

## 날짜 snapshot 재확인

원격 설정·계정·provider·가격처럼 저장소 밖 값을 적은 문서는 바뀐 값을 알려 주는 검사가 없어 조용히 낡습니다. 이런 문서는
머리에 두 줄을 둡니다.

- 마지막 확인일: 저장소 밖 값을 마지막으로 다시 본 날짜. 행마다 확인일이 다르면 그 행에 적습니다.
- 다시 볼 때: 그 설정을 바꿀 때, token·인증서 만료일, 저장소 공개 상태를 바꾸기 전, 그 문서가 정한 trigger.

이미 있는 월 1회 점검([청구서 확인](./deploy/server-costs.md#청구서-확인),
[Alert inventory 점검](./development/github/dependency-updates.md#alert-inventory-점검)) 때 아래 문서의 마지막 확인일을 보고 지난
점검 뒤로 다시 보지 않은 문서를 함께 확인합니다. 다시 본 값이 같으면 확인일만 고칩니다. Read-only로 볼 수 없는 값(Owner UI,
provider portal)은 Owner가 확인한 값만 고치고, 확인하지 못한 행은 이전 확인일을 그대로 둡니다.

대상: [Remote repository settings](./development/github/remote-repository-settings.md),
[GitHub authentication and operator access](./development/github/authentication-and-operator-access.md),
[Hosted Renovate provider boundary](./development/github/renovate-provider-readiness.md), [서버 비용](./deploy/server-costs.md),
[운영 환경](./deploy/production-environment.md).
