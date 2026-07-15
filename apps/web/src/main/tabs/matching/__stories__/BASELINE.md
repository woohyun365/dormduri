# MatchingTab current baseline

## 목적

이 디렉터리는 canonical `MatchingTab`으로 교체하기 전의 화면과 상호작용을
`legacy/LegacyMatchingTabBaseline.tsx`에 동결한다. production 코드나 legacy 상태 모델을
정당화하지 않으며, 이후 Phase에서 정책과 다르면 **story를 맞추기 위해 정책을 낮추지 않는다**.

## 고정 기준

- baseline branch/commit: `dev` / `e0b03b7`
- fixture 기준 시각: `2026-07-14T12:00:00.000Z`
- canonical season fixture: `OFF_SEASON`, `SEASON_OPEN`, `SEASON_MATCHING`, `SEASON_POST_MATCH`
- 사용자용 `POST_MATCH` 표기는 fixture에서만 canonical `SEASON_POST_MATCH`로 매핑한다.
- 등록 viewport: 320, 360, 390, 430, 1280, 1440px

## story 목록

- `OFF_SEASON · 현재 시즌 안내`
- `SEASON_OPEN · 탐색 안내`
- `SEASON_MATCHING · 활동 없음`
- `SEASON_MATCHING · 보낸 요청`
- `SEASON_MATCHING · 받은 요청`
- `SEASON_MATCHING · 활성 매칭`
- `SEASON_MATCHING · 매칭 취소 대기`
- `POST_MATCH 사용자 라벨 → SEASON_POST_MATCH · 활성 결과`
- 받은 요청 메뉴/수락 dialog smoke

`Baseline/Legacy/UnsupportedGroup`은 위 matrix와 분리된 정적 historical snapshot이다. 현재 fixture,
legacy renderer, 제품 import graph를 공유하지 않으며 product correctness/acceptance 근거로 사용하지 않는다.

## 현재 evidence와 의도적 미수정 항목

1. `SubNav`, `SegmentControl`은 아직 button 묶음이며 APG tab 역할·화살표/Home/End keyboard 동작을 제공하지 않는다. Phase 0에서는 현재 a11y defect를 보존하고, Phase 10에서 수정한다.
2. `SEASON_POST_MATCH` fixture도 legacy baseline의 active-match early return을 통과한다. canonical
   runtime에서는 request/unmatch action이 닫혀 있으며 이 story는 redesign-before 차이만 보존한다.
3. legacy baseline은 `calcMatchScoreWithGating`으로 local score를 계산한다. canonical runtime은
   server visibility/capability만 사용한다.
4. current shell은 `max-w-md` mobile column을 유지하므로 1280/1440px story는 목표 desktop two-column layout이 아니라 현 상태의 빈 여백과 overflow를 확인하기 위한 baseline이다.
5. Storybook에 별도 interaction-test addon은 추가하지 않았다. 동일 menu/dialog 동선은 `../__tests__/MatchingTab.baseline-current.test.tsx`가 fixture와 함께 smoke하며, story의 `play` function은 Storybook test surface가 활성화된 환경에서 실행된다.
6. 3인실 건물 metadata는 수용 인원 데이터로만 남는다. `roomType: 3`은 매칭 인원이나 group UI를 여는
   근거가 아니며, 제품은 2인 매칭만 제공한다.

## Phase 0 검증 명령

```bash
pnpm --dir apps/web test --run src/main/tabs/matching/__tests__/MatchingTab.baseline-current.test.tsx
pnpm --dir apps/web typecheck:storybook
pnpm --dir apps/web storybook:build
```

## 실행 기록 (2026-07-14)

- 작업 브랜치: `issue/web-main-matching-tab-refactor-plan`
- 구현 시작 baseline: `dev` / `e0b03b7`
- Phase 0 구현 commit: `e5418d2da1b09c47eaee8bd09962d79cdeb40beb`
- `MatchingTab.baseline-current.test.tsx`: 11개 fixture/menu/dialog smoke 통과
- `pnpm --dir apps/web lint`, `pnpm --dir apps/web typecheck`, `pnpm --dir apps/web typecheck:storybook`: 통과
- `pnpm --dir apps/web storybook:build`: 통과
- 로컬 시각 증거(ignored):
  - `apps/web/test-results/matching-baseline/season-matching-received-320.png`
  - `apps/web/test-results/matching-baseline/season-matching-received-360.png`
  - `apps/web/test-results/matching-baseline/season-matching-received-1280.png`
- Storybook build는 기존 bundle chunk-size warning을 출력한다. Phase 0 변경으로 새 warning/error가 추가된 것은 아니다.
