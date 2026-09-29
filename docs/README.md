# Repository documentation

`docs/`는 Git으로 추적되는 현재 source of truth만 소유합니다. 모든 clone, CI, review 환경에서 같은 문서 집합을 볼 수 있어야 합니다.

- [`policies/`](./policies/): 제품·운영 정책과 책임 경계
- [`architecture/`](./architecture/): 장기 유지하는 기술 결정과 설계 근거
- [`runbooks/`](./runbooks/): 반복 가능한 운영·복구 절차
- [`development/`](./development/): 재사용 가능한 개발·테스트 troubleshooting
- [`references/`](./references/): 정책·architecture decision이 직접 인용하는 공개 자료

과거 계획, 개인 분석, PR review 기록, 포트폴리오와 첨부 자료는 Git에서 제외되는 `.local-docs/`가 소유합니다. 진행 중인 계획은 host 공통 `.plans/`에, 계획 증거와 저장소 검증 결과는 `.artifacts/`에 둡니다. [Artifact 보존 규칙](../.artifacts/README.md#보존과-정리)에 따라 재생성 가능한 출력과 역사적 관측 원본을 구분합니다.

Canonical 문서와 production code의 현재 동작·결정·다음 작업을 이해하는 데 ignored 원문이나 private archive가 필요해서는 안 됩니다. 날짜가 명확한 과거 검증 사례는 보존된 관측 원본의 식별자를 evidence로 연결할 수 있지만, 그 로컬 경로를 현재 실행의 필수 입력이나 완료 증거로 대체하지 않습니다. 새 세션 인계는 [Session continuity](./development/agent-workflows/session-continuity.md#portable-handoff)의 tracked 문서·Issue·PR 경로를 따릅니다.
