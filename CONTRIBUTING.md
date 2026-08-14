# Contributing

이 저장소의 변경은 현재 사용자 요청과 working tree를 기준으로 작게 구현하고, 변경 범위에 가장 가까운 검증으로
증명합니다.

## 시작하기

1. [Getting Started](./README.md#getting-started)로 로컬 환경을 준비합니다.
2. coding agent를 사용한다면 root [AGENTS.md](./AGENTS.md)를 먼저 읽게 합니다.
3. 처음 참여하거나 중단된 작업을 이어받는 방법은 [Agent workflow guides](./docs/development/agent-workflows/README.md)를
   참고합니다.
4. 구현 전에 branch, `HEAD`, `git status --short`와 대상 코드·테스트를 확인합니다.

## 작업 유형

- **새 작업**: 과거 세션 상태를 가정하지 않고 현재 요청과 code/test에서 시작합니다.
- **이어받기**: plan 또는 task를 명시하고 checkpoint를 실제 commit·diff·test와 다시 대조합니다.
- **분석 전용**: 파일을 수정하지 않는다고 명시하고 사실과 추론을 분리합니다.
- **구현**: 완료 조건과 검증 범위를 먼저 정하고 edit-test-verify를 끝까지 수행합니다.

구체적인 요청 예시는 [처음 참여하는 개발자 안내](./docs/development/agent-workflows/getting-started.md)에 있습니다.

## 검증과 변경 경계

- 가장 가까운 targeted test를 먼저 실행하고 영향 범위에 따라 lint, typecheck, build, integration 검증을 추가합니다.
- destructive action, credential 사용, external production 변경은 명시적인 권한과 release evidence 없이는 실행하지 않습니다.
- 사용자 소유의 unrelated working-tree 변경은 revert, 삭제, commit하지 않습니다.
- 커밋과 PR 문구는 `AGENTS.md`의 한국어 기반 repository convention을 따릅니다.

반복 workflow의 상세 계약은 문서에서 필요할 때만 읽습니다. 긴 workflow나 과거 transcript를 root instruction에
복제하지 않습니다.
