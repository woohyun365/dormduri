# Vitest catch-all Proxy module mock hang

**상태**: Current
**마지막 검증 환경**: Vitest 4, Vite 8, jsdom 29
**현재 owner**: `apps/web/src/**/*.{test,spec}.{ts,tsx}`

## 증상

특정 test를 추가한 뒤 Vitest가 test 결과나 stack trace 없이 module collection 단계에서 멈춥니다. 직접
관련 없어 보이는 test만 필터링해도 worker가 종료되지 않을 수 있습니다.

## 원인

`vi.mock()`에서 모든 export를 자동 생성하려고 `new Proxy()`의 `get` trap이 임의 속성에 함수를 반환하면
Vitest가 조회하는 `then`에도 함수가 생깁니다. Mock module이 thenable로 오인되어 module resolution이
끝나지 않을 수 있습니다.

```tsx
// 사용하지 않는다.
vi.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

// 실제 사용하는 export만 명시한다.
vi.mock('lucide-react', () => ({
  Check: () => null,
  X: () => null,
}));
```

## 해결

- Module mock에 catch-all Proxy를 사용하지 않습니다.
- Source와 하위 component가 실제 import하는 export만 명시합니다.
- Mock 대상이 늘면 공통 test helper를 사용하되 명시적인 export object를 유지합니다.

## 검증

```bash
rg -n "new Proxy" apps/web/src --glob '*.{test,spec}.{ts,tsx}'
pnpm --dir apps/web test
```

## 참고

- [Vitest `vi.mock`](https://vitest.dev/api/vi.html#vi-mock)
- [MDN Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
