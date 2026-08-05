# Turbopack·Tailwind CSS stale cache와 root 추론 오류

**상태**: Current
**마지막 검증 환경**: Next.js 16, Tailwind CSS 4, pnpm workspace
**현재 owner**: `apps/web/next.config.ts`, `apps/web/src/app/globals.css`, workspace lockfile

## 증상

`pnpm --filter web dev`에서 `@import 'tailwindcss'` resolve가 실패하지만
`apps/web/node_modules/tailwindcss`는 실제로 존재합니다. 오류의 탐색 기준이 `apps/web/`이 아니라 상위
`apps/` 또는 workspace 밖 경로로 나타날 수 있습니다.

## 원인

Dependency 누락이 아니라 이전 root 추론 결과가 `.next` cache에 남은 상태일 수 있습니다. Workspace 상위에
다른 `package.json`이나 lockfile이 존재하거나 그 파일이 실행 사이에 바뀌면 Turbopack의 root와 cache가
현재 pnpm 설치 구조와 어긋날 수 있습니다.

## 해결

1. 오류 탐색 경로와 실제 package 설치 위치를 비교합니다.
2. Repository 상위의 불필요한 lockfile/package manifest를 확인합니다.
3. `apps/web/.next` cache를 지우고 다시 실행합니다.
4. 계속 재현될 때만 workspace install을 새로 구성합니다.

Hoist 설정이나 `public-hoist-pattern`은 package가 실제로 누락된 것이 확인되기 전에는 추가하지 않습니다.

## 검증

```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
pnpm --dir apps/web build
```

## 참고

- [Next.js `turbopack.root`](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory)
- [pnpm hoist settings](https://pnpm.io/settings#hoistsettings)
