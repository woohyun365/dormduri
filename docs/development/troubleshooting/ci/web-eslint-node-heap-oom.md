# Web ESLint Node heap OOM

**상태**: Current
**마지막 검증 환경**: Node.js 24, ESLint 9, Next.js/eslint-config-next 16
**현재 owner**: `.github/workflows/web-ci.yml`

## 증상

Web 지원선 변경 후 로컬 lint는 통과하지만 GitHub Actions의 `Web static checks`에서 ESLint가 약 2 GiB의 old space에
도달하며 종료될 수 있습니다.

```text
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

## 원인

이 증상은 lint rule 실패가 아니라 Node 프로세스의 기본 V8 old-space 한계에서 발생합니다. Framework와
`eslint-config-next` graph가 바뀌면 TypeScript program, module resolver, Next rule metadata가 동시에 로드되어 같은 source
scope도 더 큰 heap을 요구할 수 있습니다. 로컬 장비의 자동 heap ceiling이 CI runner와 다르면 local-green만으로 드러나지
않습니다.

## 해결

`Web static checks` step에만 다음 환경값을 둡니다.

```yaml
env:
  NODE_OPTIONS: --max-old-space-size=4096
```

Job 전체나 unit/build step에는 적용하지 않습니다. 이 값은 lint 범위나 rule을 줄이지 않고 V8 old space의 상한만 4 GiB로
올립니다. 계속 증가하면 상한을 반복해서 키우지 말고 ESLint timing/heap profile, type-aware rule 범위, resolver 중복을 별도
성능 작업으로 조사합니다.

## 검증

```bash
node --test scripts/ci/contracts/workflow-command-boundary.test.mjs
pnpm web:lint:prepared
pnpm web:typecheck:prepared
```

원격에서는 `Web static/build/browser gate`가 같은 source와 lockfile로 통과해야 완료입니다.

## 참고

- [Node.js command-line API: `--max-old-space-size`](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib)
