# Frontend evidence

사용자 화면의 구성·디자인 기반·화면 품질·rendering 성능 개선 근거 기록입니다. 현재 규칙과 동작은 owner 문서가 소유합니다.

- 새 화면 계층 구조와 import 규칙: [새 화면 계층](../../../apps/web/src/screens/README.md)
- 시각 값 token: [시각 값 token](../../../apps/web/src/styles/tokens/README.md)
- FE 설계 결정: [FE 결정 기록](../../architecture/decisions/fe.md)
- Web build·test 설정: [Web infra CI/test/config 기준](../../architecture/frontend/web-infra-ci-test-config.md)

| 문서                                                      | 기록                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Landing rebuild evidence](./landing-rebuild-evidence.md) | 공개 랜딩 재구성의 반복 장치·raw 값·token 규모, LCP·CLS 전후, test 문구 의존 확인, 기각한 대안                              |
| [React Compiler evidence](./react-compiler-evidence.md)   | Web·Vitest·Storybook React Compiler 적용의 build 시간·client JS·LCP·채팅 입력 지연 전후, compile을 건너뛴 구문, 기각한 대안 |
