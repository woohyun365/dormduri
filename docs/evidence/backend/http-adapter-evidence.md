# HTTP adapter evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. Adapter option과 바뀐 응답 동작은
> [platform/http README](../../../apps/api/src/platform/http/README.md#http-adapter), route template은
> [platform/observability README](../../../apps/api/src/platform/observability/README.md#route-template), 결정은
> [BE 결정 기록 `be.arch.http-adapter`](../../architecture/decisions/be.md#bearchhttp-adapter)가 소유합니다.

API의 HTTP adapter를 Express(`@nestjs/platform-express`)에서 NestJS 12의 NodeAdapter(`@nestjs/platform-node`)로 바꾼 작업의
기록입니다([#773](https://github.com/woohyun365/dormduri/issues/773)). 전환 전 측정은 `origin/dev` `a14b860b`(2026-10-31)입니다.
모든 측정은 한 Apple Silicon 장비(arm64, 8 core, Node 26.13.0)에서 했습니다.

## 1. 문제와 관측

- API는 NestJS 12를 쓰면서 HTTP adapter만 Express였다. NestJS 12는 Node `http` 위에 직접 만든 NodeAdapter를 새 기본 선택지로 낸다.
  첫 정식 release는 2026-10-27의 12.3.x였다.
- Express 경로는 `express`·`body-parser`·`proxy-addr`·`router`·`finalhandler` 같은 package를 lockfile에 들이고, 그 package의 보안 하한을
  inventory test가 따로 지켰다.
- 바꾸면 기존 코드가 Express에 기대던 세 곳이 깨진다. route template은 Express의 `req.route.path`에서 읽었고, trust proxy는
  Express의 `app.set('trust proxy', …)`로 걸었고, test 여러 곳이 Express 타입과 Express app 생성에 기댔다.

## 2. 측정 방법과 재현 명령

| 신호              | 방법                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 처리량·요청당 CPU | 전환 전 `origin/dev`를 버릴 clone에 받고 `@nestjs/platform-node`만 더해 두 adapter를 함께 설치했다. 한 Vitest process 안에서 같은 health controller·Helmet·request-context middleware·logging·metrics interceptor·exception filter로 두 adapter를 번갈아(Express, Node를 3번씩) 띄운다 |
| 부하              | 별도 Node process의 keep-alive client가 `GET /health/live`를 동시 50 연결로 10초 보낸다(2초 warm-up 뒤). 처리량은 200 응답 수 ÷ 경과 시간, 요청당 CPU는 server process의 `process.cpuUsage()` 증가분 ÷ 200 응답 수                                                                     |
| 응답 동작 전후    | 같은 probe controller와 exception filter를 전환 전 `origin/dev`(Express)와 전환 branch(NodeAdapter)에서 띄우고, 잘못된 JSON·100 KB 초과 body·prototype key body·urlencoded 중첩 body·긴 parameter·대소문자가 다른 path에 같은 요청을 보내 status·`Content-Type`·body를 기록했다        |
| 보안 하한         | npm registry의 `@nestjs/platform-node` 최신 version `dependencies`와 GitHub Advisory Database를 2026-10-31에 조회했다                                                                                                                                                                  |

판정 기준은 처리량 +10% 이상 또는 요청당 CPU -10% 이상이다. 그 밖의 기준(성숙 기간, 보안 하한, 동등성)은 3절에 있다.

## 3. Go/no-go 판정

| 조건              | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-G1 package 성숙 | 기준은 최신 patch release 뒤 7일이었다(12.3.2는 2026-10-27 release). Owner가 2026-10-31에 면제했다. merge 직전 NestJS 저장소의 열린 regression(trustProxy·body parser·Socket.IO·exception filter)을 PR 본문에 기록한다                                                                                                                                                                                                                                                                   |
| N-G2 처리량       | 통과. 아래 표                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| N-G3 동등성       | 통과. API unit·integration·e2e, trust proxy 네 조합 44건, 응답 동작 test가 NodeAdapter에서 green이다. Local fullstack에서 채팅 ticket으로 Engine.IO WebSocket upgrade(101)와 연결 유지, 잘못된 ticket 거절을 확인했다. Web fullstack e2e 39건 중 1건이 실패했는데, 같은 test를 8회씩 돌리면 전환 전 Express API에서 1회, NodeAdapter에서 0회 실패해 Web 쪽 기존 flaky로 판정했다. Ingress-trust rehearsal fixture는 API 판정을 모두 통과했고 runner의 network 격리 검사만 실패했다(아래) |
| N-G4 보안 하한    | 12.3.2는 `qs`를 6.16.0으로 고정한다. 6.16.0은 GHSA-6pq8-jhm2-2vcw(≤ 6.16.0, 6.16.1 수정)에 걸린다. NodeAdapter body parser는 `qs.parse`만 부르고 이 advisory는 `qs.stringify`의 comma 형식이지만, 보안 하한을 낮추지 않으려고 `'@nestjs/platform-node>qs': 6.16.1` 범위 override를 두었다. 제거 조건은 `qs` 6.16.1 이상에 기대는 NodeAdapter release다                                                                                                                                   |

Ingress-trust rehearsal fixture(`--mode=fixture-http`, local OrbStack)는 NodeAdapter로 띄운 실제 ticket controller·guard·IP
limiter·Socket.IO gateway로 ticket 발급, BFF client 구분, IPv6 edge 보존, polling·WebSocket 연결과 거절, private listener ACL,
metrics token 판정을 모두 통과했다. 실패한 것은 public·collector network에서 API·Web·private listener로 가는 금지 TCP 경로가 실제로
막히는지의 검사뿐이다. 같은 runner에서 전환 전 source로 돌린 2026-10-30의 두 run도 같은 검사만 같은 방식으로 실패했다. TCP 격리는
[로컬 환경 runbook](../../../infra/runbooks/rehearsal/local-environments.md)대로 독립 Linux VM에서 확인할 항목이고 adapter와 무관하다.

N-G2 측정(번갈아 띄운 순서대로, 오류 응답 0건):

| 쌍  | Express 처리량(req/s) | Node 처리량(req/s) | 처리량 차이 | Express CPU(µs/req) | Node CPU(µs/req) |
| --- | --------------------: | -----------------: | ----------: | ------------------: | ---------------: |
| 1   |                36,958 |             46,190 |     +25.0 % |                26.7 |             20.9 |
| 2   |                34,241 |             47,102 |     +37.6 % |                28.9 |             20.7 |
| 3   |                33,675 |             46,459 |     +38.0 % |                29.4 |             21.0 |

중앙값은 처리량 34,241 → 46,459 req/s(+35.7 %), 요청당 CPU 28.9 → 20.9 µs(-27.7 %)다. 두 기준을 모두 넘었다. 측정 중 장비의 load
average는 약 3.5였다.

## 4. 바꾼 것과 이유

- **Adapter 생성**: `apps/api/src/platform/http/http-adapter.ts` 하나가 `@nestjs/platform-node`를 import해 adapter를 만든다. `main.ts`와
  production 동작이 필요한 test가 같은 factory를 쓴다. Architecture test가 다른 production 파일의 adapter·Express import를 막는다.
- **Trust proxy**: env 계약(`HTTP_TRUST_PROXY_HOPS`·`HTTP_TRUST_PROXY_CIDRS`)과 배포 설정은 그대로다. NodeAdapter는 숫자 `trustProxy`를
  어떤 proxy도 믿지 않는 함수로 compile한다. 그래서 hop 수 n은 `(address, hop) => hop < n` 함수로 넘긴다(Express가 숫자에서 만든 의미).
  CIDR 목록과 `loopback`·`linklocal`·`uniquelocal` preset 이름은 NodeAdapter가 쓰는 `@fastify/proxy-addr`이 같은 이름으로 받는다.
  `req.ip`·`req.protocol`이 Express에서 같은 설정으로 얻던 값과 같은지 test로 고정했다.
- **Route template**: NodeAdapter request에는 match된 route가 없다. Nest가 route 등록에 쓰는 controller·handler path metadata를 이어
  template을 만든다. Interceptor는 실행 context에서 바로 계산한다. Guard·throttle 거절처럼 interceptor 전에 끝나는 요청은 항상
  통과하는 전역 guard가 request에 template을 기록하고 exception filter가 읽는다. 이 guard가 인증·throttle guard보다 먼저 도는지는 실제
  AppModule integration test(401·429 거절 log)가 확인한다.
- **Parameter 길이**: NodeAdapter 기본 `maxParamLength` 100이면 더 긴 route parameter가 adapter의 414가 된다. Express는 제한이 없어 모든
  길이가 route의 Zod 검증으로 가 400 공통 envelope이 됐다. 이 계약을 지키려고 값을 Node 기본 `maxHeaderSize`(16384)로 두었다.

## 5. 응답 동작 전후

같은 요청에 대한 Express(`a14b860b`)와 NodeAdapter의 응답이다. 500이나 공통 envelope 밖 body는 없었으므로 exception 정규화 코드는
고치지 않았다.

| 요청                                                     | Express                           | NodeAdapter                           |
| -------------------------------------------------------- | --------------------------------- | ------------------------------------- |
| 잘못된 JSON                                              | 400 envelope                      | 400 envelope                          |
| 100 KB 초과 JSON                                         | 413 envelope(`HTTP_413`)          | 413 envelope(`HTTP_413`)              |
| JSON `__proto__`·`constructor.prototype` key             | 201, handler까지 감               | 400 envelope                          |
| urlencoded `constructor[prototype]` key                  | 201, handler까지 감               | 400 envelope                          |
| urlencoded 중첩·반복 key(`a[b]=1&c=2&c=3`)               | 201, 중첩 객체와 배열             | 201, 같은 값                          |
| route parameter 101자·8,000자                            | route까지 감(Zod 판정)            | route까지 감(Zod 판정)                |
| request line 16 KB 초과                                  | Node 431, 빈 body                 | Node 431, 빈 body                     |
| 대소문자가 다른 path                                     | 200, match됨                      | 404 envelope, route는 `UNKNOWN_ROUTE` |
| exception filter 응답 `Content-Type`                     | `application/json; charset=utf-8` | `application/json`                    |
| 성공 JSON 응답 `Content-Type`                            | `application/json; charset=utf-8` | `application/json; charset=utf-8`     |
| query string 8가지(반복 key, `+`, escape, 대괄호 key 등) | 같은 객체                         | 같은 객체                             |
| 성공 응답 `ETag`와 `If-None-Match` 재요청                | weak `ETag`, 재요청 304           | `ETag` 없음, 재요청 200               |

- Prototype key body를 거절하는 변화는 받아들였다. 정상 client가 보내지 않는 key다.
- 대소문자 변화도 받아들였다. API를 부르는 곳은 Web BFF의 고정 소문자 경로와 저장소 stress script뿐이다.
- Charset이 빠지는 변화는 JSON 기본 encoding이 UTF-8이고 BFF가 `application/json` 포함 여부로 판정하므로 영향이 없다.
- Query string 해석기는 Express `simple`(Node `querystring`)에서 `fast-querystring`으로 바뀌었지만 같은 입력에 같은 객체를 냈다.
- `ETag`가 없어져 조건부 재요청의 304도 없어졌다. 정확성은 같고 전송량만 달라진다. `ETag`에 기대는 코드는 없고 Web BFF는 304를
  body 없는 응답으로 일반 처리만 한다. 이 변화는 받아들였다.
- 처음 계획은 101자 parameter도 400 envelope으로 기대했다. 실제 대상 route(지원 FAQ id)는 128자까지 유효해서 101자는 handler까지 가고,
  129자·8,000자가 400 envelope이다. 확인하려던 것(adapter 414가 아니라 route의 Zod 판정까지 간다)은 같다.
- `body-parser` 2.4.0 미만이 process를 멈추게 하던 요청(압축 body 뒤에 덧붙인 byte, GHSA-27r3-jxmh-p828)도 NodeAdapter가 응답하고
  다음 요청을 계속 받는지 test로 고정했다.

## 6. Dependency 변화

Lockfile에서 빠진 package: `@nestjs/platform-express`, `express`, `body-parser`, `proxy-addr`, `router`, `finalhandler`, `accepts`,
`bytes`, `forwarded`, `ipaddr.js` 1.9.1, `is-promise`, `merge-descriptors`, `negotiator`, `raw-body`, `unpipe`, `range-parser` 1.2.1,
`media-typer` 1.1.0, `@types/express`와 그 하위 `@types` package. 더해진 package: `@nestjs/platform-node` 12.3.2, `@fastify/proxy-addr`
5.1.2, `@fastify/forwarded` 3.1.2, `find-my-way` 9.10.0, `ipaddr.js` 2.5.0, `secure-json-parse` 4.1.0, `range-parser` 1.3.0,
`media-typer` 1.1.1. `pnpm why express`는 빈 출력이고 `qs`는 6.16.1 하나다.

보안 inventory test의 하한은 지우지 않고 대상을 옮겼다.

| 하한                              | 처분                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@nestjs/platform-express` 11.2.3 | 뺐다. Lockfile에 없다                                                                                                                                                                            |
| `body-parser` 2.4.0               | 뺐다. Lockfile에 없고 NodeAdapter는 자체 body parser를 쓴다. 그 advisory의 요청은 5절 test가 지킨다                                                                                              |
| `proxy-addr` 2.0.8                | 같은 역할의 `@fastify/proxy-addr` 5.1.1로 옮겼다. `proxy-addr` 2.0.8의 IPv4-mapped IPv6 subnet 수정(GHSA-jqcg-44mw-7w3h)과 같은 수정이 fork 5.1.1에 들어 있다(5.1.0에는 없음, 배포 tarball 대조) |
| `qs` 6.16.1                       | 유지. 이제 `'@nestjs/platform-node>qs'` override로 지킨다(workspace override 하한에도 추가)                                                                                                      |

Dependency alert 분류 ledger는 `qs`·`multer`의 parent를 `@nestjs/platform-node`로 고쳤다. `body-parser`·`proxy-addr` 항목은 기본
branch(`main`)가 아직 Express를 쓰는 동안 alert가 남을 수 있어 지우지 않고, 기본 branch가 그 package를 더 쓰지 않을 때 지우라는
revisit 조건을 달았다.

## 7. 대안과 기각

- **Express 유지**: 처리량 +35.7 %·요청당 CPU -27.7 %를 버린다.
- **Fastify adapter**([#468](https://github.com/woohyun365/dormduri/issues/468)): NestJS 공식 권장이 NodeAdapter로 옮겨 갔다.
- **API를 처음 배포하는 단계에서 전환**: 첫 배포 image가 정해진 adapter로 build되도록 그 전에 바꿨다.
- **`maxParamLength` 기본값 유지**: 101자 이상 parameter가 414 plain 응답이 되어 공통 envelope 계약이 깨진다.
- **Route template을 request path에서 정규식으로 복원**: path parameter 값이 label로 새어 metrics cardinality가 커진다.
- **`qs` override 없이 NestJS patch release를 기다림**: Owner가 2026-10-31에 범위 override로 진행하기로 했다. 같은 날 성숙 기간
  7일도 Landing 배포 일정 때문에 면제했다.

## 8. 한계와 재측정 조건

- 처리량은 health endpoint 한 개의 local 값이다. DB를 거치는 route에서는 adapter 비중이 작아 차이가 줄어든다. 배포 환경 값은 API를
  처음 배포한 뒤 metrics로 다시 본다.
- 성숙 기간 7일을 면제했다. 첫 release 뒤 짧은 기간이라 regression 보고가 아직 쌓이지 않았을 수 있다.
- 재측정 조건: `@nestjs/platform-node` major·minor 갱신, `qs` override 제거, trust proxy env 계약 변경, NodeAdapter의 body parser나
  router option 변경.

## 9. Interview map

- "왜 바꿨나": 같은 기능에서 처리량이 약 1.36배였고 Express 계열 package와 그 보안 하한이 빠졌다. 바꾸기 전에 같은 harness로 재고
  기준(+10 %)을 정해 두었다.
- "무엇이 깨질 수 있었나": NodeAdapter는 숫자 trust proxy를 다르게 해석해 그대로 넘기면 모든 client IP가 proxy 주소가 된다. Route
  template은 request에서 사라졌다. 둘 다 Express 동작을 기대값으로 둔 test를 먼저 세우고 옮겼다.
- "보안 하한을 어떻게 지켰나": 새 adapter가 고정한 `qs`가 advisory 하한 아래라 범위를 좁힌 override와 제거 조건을 두었다. 빠진
  package의 하한은 같은 역할의 새 package로 옮기고, fork에 원본 수정이 들어 있는지 배포 tarball로 확인했다.
