# Backend evidence

API의 HTTP·runtime·성능 개선 근거 기록입니다. 현재 규칙과 동작은 owner 문서가 소유합니다.

- HTTP adapter·trust proxy·응답 동작: [platform/http](../../../apps/api/src/platform/http/README.md)
- Log·metrics route template: [platform/observability](../../../apps/api/src/platform/observability/README.md)
- BE 설계 결정: [BE 결정 기록](../../architecture/decisions/be.md)

| 문서                                                | 기록                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [HTTP adapter evidence](./http-adapter-evidence.md) | Express에서 NodeAdapter로 바꾼 작업의 처리량·요청당 CPU 전후, go/no-go 판정, 응답 동작 전후, lockfile·보안 하한 변화, 기각한 대안 |
