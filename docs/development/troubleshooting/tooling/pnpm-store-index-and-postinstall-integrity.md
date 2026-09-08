# pnpm store index와 postinstall 무결성 판별

## 책임

이 문서는 `pnpm why`의 SQLite 접근 실패, `pnpm store status`의 modified dependency 결과, 실제 package materialization
손상을 서로 구분합니다. 전역 store를 자동으로 삭제·prune·force install하는 절차를 제공하지 않습니다.

## 먼저 기록할 증거

```bash
node --version
pnpm --version
pnpm store path
pnpm why <package> --json
pnpm store status
CI=true pnpm install --frozen-lockfile
```

명령, 종료 코드, stderr, store 경로를 함께 보존합니다. 제한된 sandbox 결과만 보고 lockfile이나 사용자 공유 store가
손상됐다고 결론 내리지 않습니다.

## 증상별 판정

| 증상                                                                                    | 의미                                                                             | 다음 안전 작업                                                               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ERR_SQLITE_ERROR`, `unable to open database file`                                      | sandbox 또는 파일 권한이 pnpm v11 index에 접근하지 못했을 수 있음                | 같은 `pnpm why`를 trusted host에서 반복하고 disposable isolated store와 비교 |
| `ERR_PNPM_MODIFIED_DEPENDENCY`가 esbuild만 지목하고 frozen install·native binary가 통과 | esbuild postinstall이 platform binary를 materialize한 알려진 진단 차이일 수 있음 | 결과를 보존하고 `esbuild --version` 및 owning build를 검증                   |
| 여러 package의 integrity/hash/materialization 실패 또는 frozen install 실패             | 실제 store/package 손상 가능성                                                   | 의존성 변경을 중단하고 disposable isolated store에서 재현                    |
| lockfile mismatch                                                                       | store 문제가 아니라 dependency input drift                                       | canonical package manager로 lockfile을 다시 생성하고 diff 검토               |
| 다른 pnpm process가 같은 checkout/store를 수정 중                                       | 동시성으로 인한 불안정 증거                                                      | 실행 중인 package-manager 작업을 확인하고 끝난 뒤 다시 측정                  |

## Isolated store 비교

원본 checkout과 사용자 store를 수정하지 않는 임시 clone/archive에서 다음처럼 비교합니다.

```bash
STORE_DIR="$(mktemp -d)/store"
CI=true pnpm install --frozen-lockfile --store-dir "$STORE_DIR"
pnpm --store-dir "$STORE_DIR" why <package> --json
pnpm --store-dir "$STORE_DIR" store status
```

`pnpm store status` 하나는 완결된 무결성 판정이 아닙니다. frozen install, exact lock resolution, installed parent metadata,
native binary 실행, owning build를 함께 읽습니다.

## 금지되는 자동 복구

- `index.db` 또는 content-addressable store 파일을 수동 편집·삭제하지 않습니다.
- ordinary agent/CI workflow에서 `pnpm install --force` 또는 global `pnpm store prune`을 실행하지 않습니다.
- `verifyStoreIntegrity`를 끄지 않습니다.
- 사용자 공유 store mutation이 정말 필요하면 정확한 store 경로와 단일 복구 명령을 먼저 제시하고 owner 승인을 받습니다.

## 회귀 검증

```bash
node --test scripts/dependencies/dependency-health-contract.test.mjs
pnpm peers check
CI=true pnpm install --frozen-lockfile
pnpm test:repo-policy
```

Registry audit와 GitHub alert는 동적 provider evidence이므로 required CI의 network dependency로 만들지 않습니다. 대신
현재 graph에서 제거되어야 하는 resolution과 peer exception 수명주기는 deterministic repository contract가 소유합니다.
