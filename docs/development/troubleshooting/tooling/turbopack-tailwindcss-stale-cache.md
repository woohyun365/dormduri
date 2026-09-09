# Turbopack dependency migration stale cache와 root 추론 오류

**상태**: Current
**마지막 검증 환경**: Next.js 16, Tailwind CSS 4, pnpm workspace
**현재 owner**: `apps/web/next.config.ts`, `apps/web/src/app/globals.css`, workspace lockfile

## 증상

- `pnpm --filter web dev`에서 `@import 'tailwindcss'` resolve가 실패하지만
  `apps/web/node_modules/tailwindcss`는 실제로 존재합니다. 오류의 탐색 기준이 `apps/web/`이 아니라 상위
  `apps/` 또는 workspace 밖 경로로 나타날 수 있습니다.
- Next/Sentry 같은 build integration dependency를 갱신한 직후 instrumentation source에서 `creating new process` 또는
  `binding to a port` 오류가 발생하지만, 동일한 lockfile의 clean worktree build는 통과할 수 있습니다.

## 원인

Dependency 누락이나 새 package의 source incompatibility가 아니라 이전 root, loader, instrumentation 변환 결과가 `.next`
cache에 남은 상태일 수 있습니다. Workspace 상위에 다른 `package.json`이나 lockfile이 존재하거나 dependency graph가 실행
사이에 바뀌면 Turbopack의 root와 cache가 현재 pnpm 설치 구조와 어긋날 수 있습니다.

## 해결

1. 오류 탐색 경로와 실제 package 설치 위치를 비교합니다.
2. Repository 상위의 불필요한 lockfile/package manifest를 확인합니다.
3. 같은 commit과 frozen lockfile을 clean worktree에서 한 번 실행해 source incompatibility와 cache 문제를 분리합니다.
4. `apps/web/.next` cache를 지우고 다시 실행합니다.
5. 계속 재현될 때만 workspace install을 새로 구성합니다.

Hoist 설정이나 `public-hoist-pattern`은 package가 실제로 누락된 것이 확인되기 전에는 추가하지 않습니다.

## 검증

```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
pnpm --dir apps/web build
```

Clean cache에서 성공했다면 broad permission 변경, loader alias, 또는 dependency downgrade를 먼저 적용하지 않습니다. 실패한
cache는 build artifact이지 source of truth가 아니므로 검증 증거로 보존하지 않습니다.

## 참고

- [Next.js `turbopack.root`](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory)
- [pnpm hoist settings](https://pnpm.io/settings#hoistsettings)
