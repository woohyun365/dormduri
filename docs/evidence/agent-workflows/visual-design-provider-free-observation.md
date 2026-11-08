# Visual design provider-free observation evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. 시각 작업의 검토 순서와 판정은
> [Visual review and acceptance](../../development/agent-workflows/visual-design/design-review-and-acceptance.md)가, 시안 위치와
> 탐색 회차는 [Design task orchestration](../../development/agent-workflows/visual-design/design-task-orchestration.md)이 소유합니다.

이 문서는 외부 design provider 없이 시각 workflow가 동작한 2026-09-10 관측 한 사례의 기록입니다. 원문은 Visual review and
acceptance 문서의 같은 이름 절에 있었고, 2026-11-04에 상대 링크의 깊이만 새 위치에 맞춰 고치고 그대로 옮겼습니다. 측정은 다시
하지 않았습니다.

## Provider-free 관측 사례 — 2026-09-10

`9c7522e2` 기준 tracked 진입점에서 시작한 fresh native task로 공개 개인정보 처리방침을 재구성했습니다.
이는 **가이드 발견 → 대안 생성 → 실제 렌더 → 독립 비평 → 제한된 수정**이 동작한 한 사례이며,
모든 새 세션의 동일 판단·디자인 품질 향상·시간 절약을 증명하는 benchmark는 아닙니다.

| 검증 질문                           | 관측한 결과                                                                                                                                                   | 다시 확인할 owner / 한계                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정보와 표현을 분리했는가?           | 같은 공개 문서의 81개 텍스트 항목·표 3개·조항 anchor 11개를 두 후보에 보존. 원문을 숨기거나 축약하지 않음                                                     | [공개 본문](../../../apps/web/src/legal/content/legal-fallback-documents.ts), [표시 문구](../../../apps/web/src/legal/content/legal-copy.ts), [mapper](../../../apps/web/src/legal/api/legal-document.mapper.ts)                                                                                                     |
| 실제 대안인가?                      | A는 명조 읽기 열·좌측 상시 목차, B는 고딕·상단 다열 목차·조항명/본문 분리와 국소 glass. 독립 reviewer가 실제 화면의 구성 차이를 확인                          | 전역 스타일 추천·제품 적용 승인이 아닌 별도 로컬 HTML 두 후보                                                                                                                                                                                                                                                        |
| 동작을 함께 확인했는가?             | API/fallback/unavailable 표시, copy 결과 두 상태, print/back/home intent, 기본 Tab 5회·outline과 첫 목차 Enter/heading focus, 320px 문서 가로 overflow를 확인 | [현재 actions](../../../apps/web/src/legal/components/LegalDocumentActions.tsx), [back](../../../apps/web/src/legal/components/LegalDocumentBackButton.tsx), [unavailable](../../../apps/web/src/legal/components/LegalDocumentUnavailable.tsx). API·클립보드·인쇄·history는 선언한 stub이며 실제 부작용 검증이 아님 |
| 비평이 실제 수정으로 연결되는가?    | 모바일 표·요약의 한글 단어 분절을 찾아 줄바꿈 CSS만 수정하고 동일 조건으로 재캡처. 문구·폰트 크기·배치는 유지                                                 | 모바일 셀과 B 요약의 `word-break: keep-all`, 긴 토큰의 `overflow-wrap: anywhere` 유지. 독립 delta 검토 후 Parent가 r2를 keep; 원문·DOM·action 불변                                                                                                                                                                   |
| 모든 취향 제안을 채택했는가?        | 모바일 목차 상단 이동은 과제 근거 부족으로 보류. B glass는 관찰한 sticky 장면에서 글·버튼·대상 제목 가림이 없어 유지                                          | 효과 금지 목록이 아님. 전체 대비·합성 성능·다른 상태의 가림은 별도 검증                                                                                                                                                                                                                                              |
| 모호한 일반 요청도 범위를 지켰는가? | fresh read-only task가 작은 CSS는 직접 권고, Backoffice는 독립 방향 제안, hostile reference·과거 스타일/승인 주장은 비권위 데이터로 처리                      | 7개 응답 probe는 한 fresh context에서 실행한 권고 관측. 실제 CSS 제품 수정·Backoffice 생성·Figma 호출을 의미하지 않음                                                                                                                                                                                                |

수정 후 390px 표의 ‘기/록’, ‘자/기소개’와 요약의 ‘보관합니/다’ 같은 관측 단어 분절이 줄었습니다.
320px에서는 일부 셀의 여백·행 높이가 늘어 전체 높이가 A **7323→7371px**, B **6457→6506px**가 되었으나
가로 overflow·가림은 관측되지 않았습니다. 390/1280px의 전체 높이는 같고 desktop 주요 캡처는 전후 동일했습니다.
독립 검토와 Parent는 이 tradeoff를 받아들여 **r2 keep**으로 끝냈으며, 사용자 읽기 속도 향상이나 선호를 실측한 것은 아닙니다.
원문 문단 전체의 줄바꿈까지 확대하지 않았고, 추가 미적 반복을 완료 조건으로 만들지 않았습니다.

캡처 조건은 macOS의 설치된 system font, Playwright **1.63.0** / Chromium **153.0.8010.12**, ko-KR,
light·reduced motion·scale 1, viewport **390×900 / 1280×900**과 **320×900** 보조 검사입니다.
전체 본문과 핵심 영역을 캡처했고, 각 viewport의 연속 top 이미지 hash는 안정적이었습니다. 네트워크 요청은 차단했고
시도 0건, browser JS 오류 0건을 관측했습니다. 최초 sandbox의 macOS MachPort 권한 실패는 승인된 동일 로컬 명령으로
해소했으며 설치·계정·전역 설정·제품 코드를 바꾸지 않았습니다. Font 파일을 고정하거나 다른 OS의 동일 픽셀을 보장하지 않습니다.

정적 회귀 owner는 [시각 workflow contract test](../../../scripts/ci/agents/common/visual-design-workflow-contract.test.mjs)와
[입력/평가 분리 corpus](../../../scripts/ci/agents/common/fixtures/visual-capability-cases.json)입니다. **20개 corpus 전체의 live 실행은
아니며**, 정적 무결성 PASS를 Agent 행동·미감 PASS로 세지 않습니다. 실제 생성자·검토자는 별도 context로 시작했고
검토자는 작성자의 선호/점수를 받지 않은 채 화면부터 확인했습니다. 요청한 native role/effort는 기록했지만
숨겨진 effective-runtime attestation을 확보했다고 주장하지 않습니다.

원본 HTML·이미지·실행 로그는 로컬 관측 산출물이고, 이 문단은 다른 clone에서도 읽을 수 있는 범위·결과·한계 요약입니다.
Owner preference는 **not-collected**, 승인된 외부 reference fidelity는 **not-applicable**, 인간 usability는 **unvalidated**입니다.
전 조항 keyboard-only 탐색, screen reader, 전체 색상 대비·zoom·교차 브라우저, 실제 API/OS 동작, production/Storybook
parity와 장치 성능은 이 로컬 하네스 검증으로 대신하지 않습니다. 제품 적용 시에는 해당 화면의 새 brief·승인·검증이 필요합니다.

## 한계와 재산출 조건

- 원문을 옮긴 기록입니다. 원본 HTML·이미지·실행 로그는 로컬 관측 산출물이라 공개 run ID나 재현 명령이 없고, 위 수치(텍스트
  항목·표·anchor 수, 전체 높이)는 이 문서만으로 다시 산출할 수 없습니다.
- 다시 재려면 `9c7522e2`(2026-09-10)의 tracked 진입점에서 fresh native task로 같은 공개 문서를 다시 재구성하고 위 캡처 조건으로
  잽니다. 모델·font·browser 버전이 다르면 같은 결과를 기대하지 않습니다.
- 링크한 제품 파일은 옮긴 날의 경로입니다. 화면 계층이 바뀌어 경로가 없어지면 `git show 9c7522e2:<경로>`로 당시 source를 읽습니다.
- 한 사례이며 모든 새 세션의 같은 판단·디자인 품질 향상·시간 절약을 증명하지 않습니다.
