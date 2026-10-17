## Summary

- Outcome: <!-- 이 PR이 제공하는 한 가지 결과 -->
- Acceptance: <!-- 완료를 증명하는 동작·contract·test·운영 evidence -->
- Non-scope: <!-- 중요하지만 이 PR에 포함하지 않은 독립 작업 -->
- Follow-up disposition: <!-- 해당 없음 / required-current / prerequisite-predecessor / independent-follow-up -->
- Scope audit: <!-- cohesive / signal·facts·disposition·exclusion·gap; audit signal이 없으면 해당 없음 -->

## Related

- Development PR: <!-- `Refs #번호` 또는 GitHub Development sidebar 연결 -->
- Main promotion: <!-- `main` 대상이고 전체 acceptance를 포함할 때만 `Closes #번호`; 그 외 해당 없음 -->
- Policy / Architecture: <!-- 관련 tracked 문서 또는 해당 없음 -->

## Lifecycle

<!-- CI `Lifecycle gate`가 실행 시점의 본문에서 이 절을 읽습니다. 절이나 변경 등급이 없으면 feature로 계산합니다. 작성법은 docs/development/github/collaboration.md의 Pull request 절 -->

- 변경 등급: <!-- trivial / bugfix / hotfix / feature / policy-change -->
- 등급 근거: <!-- 한 줄 -->
- 정책 도메인: <!-- docs/policies/<이름>.md의 이름을 쉼표로 나눈 목록 또는 없음 -->
- 인용 규칙: <!-- [<문서>.md <ID>](docs/policies/<문서>.md)를 쉼표로 나눈 목록 또는 없음 -->
- 정책 영향 없음: <!-- <도메인> — <이유>. 인용하지 않는 도메인마다 한 줄 -->
- Owner 확인: <!-- <파일 경로> <YYYY-MM-DD>. 경로 표·대응 기록·정책 문서를 바꿀 때 파일마다 한 줄 -->
- override: <!-- <검사 id> — <이유> — <재검토 조건>. 필요할 때만 -->

## Changes

<!-- 파일 목록 대신 책임·동작·계약의 변화를 요약합니다. -->

## Risk / Migration / Operations

- 영향 범위: <!-- Web / API / Shared / DB / Infra / Docs / Security / Operations -->
- Migration 또는 호환성: <!-- 해당 없음 가능 -->
- Secret·runtime config·운영 영향: <!-- 해당 없음 가능 -->
- Rollback 또는 forward-fix: <!-- 해당 없음 가능 -->

## Verification

- Targeted: <!-- 변경 동작을 직접 검증한 명령과 결과 -->
- Repository policy: <!-- `pnpm test:repo-policy` 또는 해당 없음 -->
- Scope check: <!-- `pnpm api:check`, `pnpm web:check`, `pnpm infra:check:static` 등 -->
- Review evidence: <!-- docs/development/agent-workflows/qa.md 기준 disposition·검토 snapshot·회차 수·결과/근거·gap; 독립 검토 불필요 시 이유. Self-review/test/CI는 구분 -->
- Finding disposition: <!-- PASS 뒤 남은 finding의 처분(fixed-mechanical·deferred·rejected·pre-existing)과 근거 또는 해당 없음 -->
- Not tested: <!-- 검증하지 못한 범위와 이유 또는 해당 없음 -->

## UI Evidence

<!-- UI 변경 시 viewport·Storybook·스크린샷 등 비교 근거를 작성합니다. 해당 없음 가능 -->
