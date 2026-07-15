# ChatTab owner boundary

- 제품 ChatTab은 `/api/chat/threads`, detail, read-marker, message, leave BFF route와
  `@repo/shared/chat` schema만 소비한다.
- 목록 pagination은 chat owner가 돌려준 cursor를 그대로 전달하며, offset/page/room key를 새로 만들지 않는다.
- `canReport = true`인 thread의 신고는 기존 `/api/reports` social-safety owner와
  `CHAT_THREAD` report contract로만 접수한다. 허위 신고 확인을 거치지 않은 요청은 보내지 않는다.
- 대화 상대의 nickname, profile, match score는 현재 chat contract에 없으므로 local profile lookup이나
  score 재계산을 하지 않는다. UI는 중립적인 `대화 상대` label로 fail-close 한다.
- 매칭 요청 수락, 매칭 확정/해제는 ChatTab의 책임이 아니다. 해당 lifecycle action은 MatchingTab만
  소유한다.
- legacy pair/group Storybook 증거는 matching feature의 `__stories__/legacy/**`에만 존재하며 ChatTab
  production import graph에는 포함되지 않는다.
