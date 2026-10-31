# React Compiler evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. 설정 원본과 적용 범위는
> [Web infra CI/test/config 기준](../../architecture/frontend/web-infra-ci-test-config.md#nextjs-production-baseline), 결정은
> [FE 결정 기록 `fe.render.react-compiler`](../../architecture/decisions/fe.md#ferenderreact-compiler)가 소유합니다.

Web(`apps/web`) 전체와 Vitest·Storybook에 React Compiler 1.0을 켠 작업의 기록입니다([#293](https://github.com/woohyun365/dormduri/issues/293)).
전 측정은 `origin/dev` `ec2153f4`(2026-10-31)입니다. 끔·켬 비교는 이 작업 PR의 commit에서 compiler 설정만 바꿔 번갈아 쟀습니다.
최종 비교는 채팅방 수정까지 들어간 `6214a112`(2026-10-31)이고, 채팅방 수정 전 비교는 `850ea25c`·`b27c637f`입니다. 세 commit은 PR의
commit 목록에 있습니다. 모든 측정은 한 Apple Silicon 장비(arm64, 8 core, Node 26.13.0)에서 했습니다.

## 1. 문제와 관측

- Web의 memoization은 손으로 쓴 `useMemo`·`useCallback`뿐이었다. 채팅방(`ChatRoomView`)은 입력 상태와 메시지 목록이 한 component에
  있어 글자 하나마다 메시지 목록 전체를 다시 그렸다. 메시지 200개 채팅방에서 CPU 4배 throttle로 40자를 치면 `keydown`·`input` 처리의
  최대 지연 중앙값이 40ms, 그 40자 동안 JS 실행 시간이 약 0.8초였다.
- Compiler lint(`eslint-config-next`의 React Compiler 규칙)는 위반이 0건이었다. 켜기 전에 고칠 위반은 없었지만, lint가 보고하지 않는
  compile 실패가 있었다(4절).
- Next 16은 `reactCompiler`를 top-level stable 설정으로 두지만 Vitest와 Storybook은 그 설정을 읽지 않는다. 그대로 켜면 test와 story가
  production과 다른 코드를 검사한다.

## 2. 측정 방법과 재현 명령

| 신호                | 방법                                                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 build 시간       | `apps/web/.next`를 지우고 `pnpm exec next build`의 시작부터 끝까지 wall time. 끔·켬을 3회씩 번갈아(끔, 켬, 끔, 켬, 끔, 켬) 중앙값을 비교한다. 끔은 `next.config.ts`의 `reactCompiler` 줄만 뺀다                                                                                                 |
| S2 client JS        | 같은 build의 `.next/static` 아래 `*.js` gzip 합계                                                                                                                                                                                                                                               |
| compile 표식        | `react.memo_cache_sentinel` 또는 `react/compiler-runtime` import가 있는 JS 파일 수. production은 `.next/static`(browser)과 `.next/server`, Storybook은 정적 build 출력, Vitest는 `vitest.config.ts`를 config로 쓰는 Vite server로 production source(test·story·fixture 제외)를 transform한 결과 |
| 파일별 compile 결과 | production source 각 파일을 같은 option의 `babel-plugin-react-compiler`로 transform하고 compiler `logger`의 `CompileSuccess`·`CompileError` event를 모은다                                                                                                                                      |
| S3 Landing LCP      | [Landing rebuild evidence](./landing-rebuild-evidence.md#2-측정-방법과-재현-명령)의 LCP 정의(production standalone, Playwright Chromium Desktop Chrome·Pixel 5, 빈 cache context 5회 중앙값)에 CPU 4배 throttle 조건을 더했다. 끔·켬 서버를 같이 띄우고 한 회 안에서 번갈아 연다                |
| S4 채팅 입력 지연   | Storybook 정적 build에 메시지 200개 채팅방 story를 더해(측정용, 추적하지 않음) Desktop Chrome으로 연다. CPU 4배 throttle에서 입력창에 40자를 80ms 간격으로 치고, Event Timing API(`type: 'event'`, `durationThreshold: 16`)의 `keydown`·`input` entry 최대 `duration`을 끔·켬 5회씩 번갈아 잰다 |
| S4 보조 지표        | 같은 조작 동안 CDP `Performance.getMetrics`의 `ScriptDuration`·`TaskDuration` 증가량(ms). Event Timing은 8ms 단위이고 16ms 미만을 기록하지 않아 작은 차이를 놓친다. 판정 기준은 아니다                                                                                                          |
| 회귀 방지           | `pnpm web:check`, `pnpm --dir apps/web ci:storybook:build`·`ci:storybook:visual`, `pnpm --dir apps/web e2e`, `pnpm check:fast`, `pnpm test:repo-policy`                                                                                                                                         |

중단 조건은 측정 전에 정했습니다. S1 중앙값 25% 넘게 증가, S2 20% 넘게 증가, S3 throttle 조건에서 어느 descriptor든 10%와 50ms를
모두 넘게 악화, S4 10% 넘게 악화이고, S4가 10% 안에서 나아지지 않으면 merge 전에 Owner에게 유지 여부를 묻습니다. S4는 production
runtime과 local API로 재는 harness가 없어 Storybook 정적 build로 쟀습니다. 측정 script는 추적하지 않습니다. 위 정의로 다시 만들 수
있습니다.

## 3. baseline

`origin/dev` `ec2153f4`:

- cold build 13.621·11.707·12.042초(중앙값 12.042초).
- client JS 45개, gzip 667.6 KiB.
- compile 표식: production browser 1개(React runtime이 sentinel Symbol을 정의하는 chunk), server 0개. Storybook 1개(같은 이유). Vitest
  transform 600개 중 0개.
- Landing LCP 중앙값: Desktop Chrome 64ms(throttle 없음)·172ms(CPU 4배), Pixel 5 52ms·172ms.
- S4: 5회 모두 40자 입력에 entry 80개, 최대 지연 중앙값 40ms.

## 4. 원인

- 채팅 입력 지연: 입력할 때마다 `ChatRoomView` 전체가 다시 렌더되고, 메시지 목록 JSX도 매번 새로 만들어진다. Compiler는 입력 상태에
  의존하지 않는 목록을 memo cache에 두어 다시 만들지 않는다.
- 첫 비교에서 채팅방이 나아지지 않은 이유: compiler 1.0은 일부 구문을 HIR로 낮추지 못하고, `panicThreshold: 'none'`이면 그 함수를
  compile하지 않은 채 조용히 둔다. lint는 이것을 보고하지 않는다. 채팅방 수정 전(`850ea25c`) production source(test·story·fixture 제외)를 파일별로 보니
  448개 함수가 compile됐고 28개 파일에서 함수 하나씩 28개가 건너뛰어졌다. 채팅방 수정 뒤(`6214a112`)는 589개 파일에서 449개 compile,
  27개 파일의 27개 건너뜀이다. `ChatRoomView`는 보내기·나가기 처리의 `try … finally`와, 그것을 고친 뒤에는 `try` 안의 optional
  chaining·`??`(value block) 때문에 건너뛰어졌다.

  | `6214a112`에서 건너뛴 이유(compiler 메시지)                                      | 함수 수 |
  | -------------------------------------------------------------------------------- | ------- |
  | `try … finally`(Handle TryStatement with a finalizer)                            | 16      |
  | `try` 안의 조건·논리·optional chaining 식(Support value blocks within try/catch) | 5       |
  | `catch` 없는 `try`                                                               | 2       |
  | 그 밖(dynamic `import()`, 재배치할 수 없는 식 2, 변수 참조 종류 섞임)            | 4       |

- Vitest에서 모두 compile하면 8개 test가 실패했다. 하나는 async server page를 함수로 직접 부르는 test(`useMemoCache`가 없음), 다른
  하나는 render 중에 module 변수를 읽는 test harness(compile된 JSX가 이전 값을 memo함)다. Next는 server layer와 test·story 코드를
  compile하지 않으므로 production에서는 생기지 않는 실패다.
- Storybook에서 처음에는 8개 파일만 compile됐다. framework의 SWC transform과 compiler plugin이 둘 다 `enforce: 'pre'`이고 SWC가 먼저
  JSX를 바꾸면, Hook을 부르지 않는 component를 compiler가 component로 알아보지 못한다. Storybook `main.ts` loader는 확장자 없는
  `../react-compiler.config` import에서 `.config`를 확장자로 읽어 module을 찾지 못했다.

## 5. 대안과 기각

| 대안                                                                                 | 판단                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| annotation mode pilot 뒤 확대(#293 원문 순서)                                        | 기각. lint 위반 0건이고 Owner가 Web 전체 범위를 정해 단계가 필요 없다                                                                                                   |
| production build만 켜기                                                              | 기각. Vitest·Storybook이 compile된 코드를 검사하지 못한다                                                                                                               |
| test runner마다 option을 따로 쓰기                                                   | 기각. 값이 어긋날 수 있다. option 원본을 `apps/web/react-compiler.config.ts` 하나로 두고 Next·Vitest·Storybook이 import한다                                             |
| Vitest에서 모든 파일을 compile하고 깨진 test를 고치거나 `"use no memo"`를 두기       | 기각. production이 compile하지 않는 파일을 compile하면 production에 없는 실패를 고치게 된다. compiler `sources` option으로 Next browser build와 같은 파일만 compile한다 |
| Rust compiler(`oxc-transform-react`), Next `experimental.turbopackRustReactCompiler` | 기각. experimental이다                                                                                                                                                  |
| 건너뛴 파일 모두 이 작업에서 고치기                                                  | 기각(Owner). 화면 코드가 넓게 바뀐다. 측정 대상인 채팅방만 고치고 나머지는 7절의 재측정 조건으로 둔다                                                                   |
| 채팅방을 고치지 않고 설정만 merge                                                    | 기각(Owner). S4가 나아지지 않았다. 채팅방은 다시 만들 예정이라 동작을 바꾸지 않는 최소 수정만 했다                                                                      |
| 새 dependency를 `pnpm-workspace.yaml` catalog에 두기                                 | 기각. 셋 다 `apps/web`만 쓰고, catalog에 `@babel/core`를 두면 보안 inventory test의 제거 selector 단언이 깨진다. `apps/web/package.json`에 정확한 버전으로 둔다         |

## 6. 개선별 전후 측정

`6214a112`에서 compiler 끔 → 켬(채팅방 수정 포함):

| 개선·비용         | 끔 → 켬                                                                                                                                              | 판정·확인                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| S1 build 시간     | 14.283·13.727·12.188초(중앙값 13.727) → 18.463·16.482·14.895초(중앙값 16.482), +20.1%                                                                | 중단 조건 25% 안                                                   |
| S2 client JS      | 45개 667.6 KiB → 47개 769.9 KiB, +15.3%                                                                                                              | 중단 조건 20% 안                                                   |
| compile 표식      | production browser 1 → 30개(47개 중), server 0 → 0. Storybook 1 → 40개(sentinel 1 → 500). Vitest transform 600개 중 0 → 297개(`.tsx` 318개 중 276개) | Next는 browser bundle에만 적용한다. Vitest·Storybook도 같은 범위다 |
| S3 Landing LCP    | throttle 없음 Desktop 60 → 64ms, Pixel 5 60 → 56ms. CPU 4배 Desktop 188 → 164ms, Pixel 5 164 → 156ms                                                 | 악화 없음                                                          |
| S4 채팅 입력 지연 | 최대 지연 중앙값 40 → 16ms(켬 5회 중 2회는 16ms 이상 entry 없음). entry 수 80 → 0~10                                                                 | 60% 개선                                                           |
| S4 보조(JS 실행)  | 메시지 200개 817.6 → 28.4ms, 500개 1895.6 → 29.3ms(40자 입력 동안 `ScriptDuration` 증가 중앙값)                                                      | 메시지 수가 늘어도 켬은 거의 그대로다                              |

채팅방 수정 전(`850ea25c`·`b27c637f`) 비교: S1 +22.5%, S2 +15.2%, S3 악화 없음, S4는 끔 40ms·켬 40ms로 그대로였고 JS 실행 중앙값도 767 →
765ms(200개), 1855 → 1870ms(500개)로 같았다. `ChatRoomView`가 compile을 건너뛰었기 때문이다. 수정은 두 가지다. 보내기·나가기의 `finally { setX(false) }`를
`try`/`catch` 뒤 `setX(false)`로 옮기고, `try` 안의 `crypto.randomUUID` optional chaining을 module 함수로 뺐다. 동작은 보내기 성공·실패,
나가기 실패 뒤 재시도, 새 메시지 rerender 때 입력 유지 test 4개가 수정 전후 모두 통과해 같다. 수정 뒤 `ChatRoomView`는 memo slot 79개로
compile된다.

회귀 방지:

- Vitest: 처음 모두 compile했을 때 8개 실패 → `sources` 범위 적용 뒤 223개 파일 1542개 모두 통과. 새 test는 `InlineTextEditor` 편집·취소·저장
  1개와 채팅방 4개다.
- `"use no memo"`: 0개.
- Storybook 렌더·axe 84개 통과(Linux 스크린샷 8개는 macOS에서 skip), Web Playwright 36개, local fullstack Playwright(local API·DB,
  `next dev`) 39개 통과, Web Docker image build 통과.

## 7. 한계와 재측정 조건

- 모든 값은 한 장비의 local 값이다. 절댓값은 배포 환경과 다르고 끔·켬 차이만 같은 조건이다. 끔 쪽 build 시간도 12.2~14.3초로
  흔들렸다. CI hosted runner의 build 시간은 PR CI 기록으로 본다.
- S4는 API를 mock한 Storybook 정적 build의 값이다. production runtime과 local API로 재는 harness가 없다. 실제 사용 환경의 입력 반응은
  배포 환경 Web Vitals(INP)로 다시 본다.
- Event Timing은 8ms 단위이고 16ms 미만 처리를 기록하지 않는다. 켬의 16ms는 "16ms 이하"로 읽는다. 보조 지표(JS 실행 시간)를 함께 둔
  이유다.
- dev server 체감 속도는 재지 않았다.
- `ChatRoomView` 밖의 건너뛴 파일 27개(프로필 tab, home route, 공지·알림·문의, 가입, main route shell, 채팅·매칭·룸메이트 목록의 data
  Hook 등)는 compile되지 않은 채 남았다. 그 화면을 다시 만들거나 고칠 때 파일별 compile 결과를 다시 보고, 상태가 자주 바뀌는 화면이면 전후를 잰다.
- 재측정 조건: `babel-plugin-react-compiler`·Next major 갱신, `@vitejs/plugin-react`가 Rust compiler를 stable로 낼 때, build 시간이나
  client JS가 위 중단 조건에 가까워질 때.

## 8. interview map

- "React Compiler를 켜면서 무엇을 확인했나": lint 위반 0건은 compile 성공이 아니었다. 파일별 compile event로 건너뛴 함수를 찾았고,
  측정 대상 화면이 나아지지 않은 원인이 거기 있었다.
- "test는 production과 같은 코드를 검사하나": option 원본 하나를 세 도구가 읽고, Next가 compile하는 파일만 test·story에서도 compile한다.
  세 출력의 표식 수를 끔·켬으로 세어 확인했다.
- "효과가 없을 때 어떻게 했나": 채팅방 S4가 그대로라 merge 전에 멈추고 원인을 찾았다. 버릴 worktree에서 두 곳만 고쳐 효과를 잰 뒤 Owner가
  이 작업에 넣기로 정했다. 동작은 수정 전에 더한 test로 지켰다.
