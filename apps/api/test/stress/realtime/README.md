# Realtime stress scripts

`apps/api/test/stress/realtime`는 Chat Socket.IO `/chat` namespace의 ticket 인증, socket connect, thread subscribe/unsubscribe ack를 Artillery 외부 CLI로 검증한다.

## 책임 경계

- k6 HTTP stress: `/health`, search/profile/match/chat/support/report 같은 HTTP request/transaction latency를 검증한다.
- Artillery realtime smoke: `/api/chat/realtime/tickets`로 one-time ticket을 사전 발급하고 Socket.IO `/chat` namespace에 연결한 뒤 `chat.thread.subscribe`/`chat.thread.unsubscribe` ack latency와 failure budget을 검증한다.
- message send/read-marker write는 기본 realtime scenario에 넣지 않는다. 해당 write-heavy path는 k6 HTTP opt-in mix가 담당한다.

## 실행 전 조건

1. API가 local/staging target에서 실행 중이어야 한다.
2. `STRESS_TARGET_URL`을 지정한다.
3. `stress:fixture:seed`와 `stress:fixture:tokens`로 actor token artifact를 만든다.
4. `STRESS_ACTOR_TOKENS_PATH`가 `.tmp-*` token artifact를 가리켜야 한다.
5. 로컬/CI/별도 runner에 Artillery CLI가 설치되어 있어야 한다.

```bash
npm install -g artillery@latest
artillery version
```

운영 API instance에 Artillery를 설치해서 자기 자신을 때리는 구조는 권장하지 않는다. Staging/release 부하는 CI 또는 별도 runner에서 실행한다.

## Commands

```bash
STRESS_TARGET_URL=http://127.0.0.1:4000 \
STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
pnpm --dir apps/api stress:realtime:smoke

```

`stress:realtime:smoke`는 runner가 token artifact의 chat actor 1명을 선택하고 one-time ticket 1개를 발급한 뒤 `STRESS_REALTIME_TICKET`/`STRESS_REALTIME_THREAD_ID`를 child Artillery process 환경변수로만 전달한다. Artillery Socket.IO engine은 handshake를 flow step보다 먼저 열기 때문에, per-row payload의 `realtimeTicket`을 handshake auth에 쓰는 방식은 smoke 기준으로 사용하지 않는다. `baseline-250.yml`/`peak-500.yml`은 target shape template이며, 실제 대규모 실행은 ticket-per-VU 발급/분배 전략이 필요하다. 현재 runner는 `baseline-250`/`peak-500`을 fail-closed로 막아 release gate에서 준비 부족을 명확히 드러낸다.

Release 전 판정과 결과 공유는 `docs/runbooks/observability/api-stress-release-runbook.md`와 `apps/api/test/stress/reports/report-template.md`를 사용한다. Realtime baseline/peak를 실행 가능 상태로 바꾸려면 VU별 one-time ticket 발급/분배 전략, safe artifact 정책, ticket TTL/재시도 정책을 먼저 확정해야 한다.

## Safety

- runner는 public/production-like host를 기본 거부한다.
- token artifact가 없거나 chat thread id를 가진 actor가 없으면 실행하지 않는다.
- runner가 token artifact에서 actor metadata CSV를 만들지만, realtime ticket은 CSV에 쓰지 않는다. 결과 파일은 `reports/.tmp-*` ignored artifact다.
- report/parser/processor output은 raw access token, realtime ticket, cookie를 남기지 않는다.
- Socket.IO ticket은 URL query가 아니라 handshake `auth.ticket`으로 전달한다.
- `STRESS_REALTIME_SOCKET_URL`을 지정하지 않으면 `$STRESS_TARGET_URL/chat`을 사용한다.
- `STRESS_REALTIME_ORIGIN`을 지정하지 않으면 `$STRESS_TARGET_URL` origin을 사용한다.
