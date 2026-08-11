# Repository documentation

`docs/`는 Git으로 추적되는 현재 source of truth만 소유합니다. 모든 clone, CI, review 환경에서 같은 문서 집합을 볼 수 있어야 합니다.

- [`policies/`](./policies/): 제품·운영 정책과 책임 경계
- [`architecture/`](./architecture/): 장기 유지하는 기술 결정과 설계 근거
- [`runbooks/`](./runbooks/): 반복 가능한 운영·복구 절차
- [`development/`](./development/): 재사용 가능한 개발·테스트 troubleshooting
- [`references/`](./references/): 정책·architecture decision이 직접 인용하는 공개 자료

과거 계획, 개인 분석, PR review 기록, 포트폴리오와 첨부 자료는 Git에서 제외되는 `local-docs/`에 둡니다. 실행 중인 Codex 계획과 agent session report는 `.omx/`가 소유하고, 저장소 검증 도구의 재생성 가능한 결과는 `artifacts/local/`에 둡니다. Canonical 문서와 production code는 두 로컬 영역을 참조하지 않습니다.
