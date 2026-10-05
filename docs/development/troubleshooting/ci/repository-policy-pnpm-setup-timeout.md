# 트러블슈팅: Repository policy pnpm setup timeout

**상태**: Current

**마지막 검증 환경**: GitHub-hosted `ubuntu-24.04`, pnpm/action-setup v6.0.10, pnpm 11.24.0, Node.js 24

**현재 owner**: `.github/workflows/ci.yml`의 `repo_policy` job

## 증상

`Repository policy gate`가 다음 명령을 실행하기 전에 `Setup pnpm`에서 취소된다.

```text
Error: The operation was canceled.
```

Actions UI에서는 job이 약 5분 뒤 `cancelled`로 종료되고, 뒤의 Node setup, frozen install, repository policy, formatting step은
`skipped`로 표시된다. 최종 `CI summary`는 선택된 lane의 취소를 정상적으로 실패로 판정한다.

2026-09-04 main run `33859791472`에서는 이 현상이 같은 setup step에서 세 번 반복됐다. 같은 run의 Web unit 및
Infrastructure job에서는 동일한 pnpm setup이 약 7분 걸린 뒤 성공했기 때문에 제품 test failure와 구분할 수 있었다.

## 원인

GitHub Actions의 job-level `timeout-minutes`는 특정 step이 아니라 checkout부터 cleanup까지 job 전체에 적용된다. 기존
repository-policy job은 다음 작업 전체에 5분만 허용했다.

1. checkout
2. pnpm bootstrap
3. Node와 pnpm store cache setup
4. frozen dependency install
5. repository policy test
6. repository formatting check

pnpm/action-setup v6는 `run_install: false`여도 pnpm 자체를 bootstrap하며, 현재 구현은 이 과정에서 `npm ci`를 사용한다.
GitHub-hosted runner 또는 npm registry 지연으로 bootstrap이 5분을 넘으면 repository command가 정상이어도 GitHub가 job을
취소한다.

Repository가 소유하는 원인은 외부 지연 자체가 아니라 **전체 command graph와 job budget의 불일치**다. GitHub runner나
registry 내부 장애 원인은 repository log만으로 확정하지 않는다.

## 해결

Repository-policy lane은 다음 두 경계를 함께 유지한다.

- 전체 job: `timeout-minutes: 15`
- `Setup pnpm` step: `timeout-minutes: 10`

전체 budget은 관측된 약 7분의 setup tail과 실제 policy 작업을 수용한다. 별도 setup cap은 외부 bootstrap이 무기한
기다리지 않게 한다. pnpm version, action SHA, Node version, cache key, frozen install, policy 및 formatting 명령은 timeout
문제만으로 변경하지 않는다.

## 진단과 복구

1. 실패 job에서 최초로 실패하거나 취소된 step을 확인한다.
2. `Setup pnpm`이 job budget과 같은 시점에 취소되고 이후 step이 모두 skipped라면 이 문서의 경계로 분류한다.
3. `Verify repository policy scripts` 또는 `Verify repository formatting`이 실제로 실행되어 실패했다면 timeout으로
   분류하지 말고 해당 assertion/format output을 해결한다.
4. 같은 run의 다른 job에서 pnpm setup duration을 비교한다. 여러 job이 동시에 지연되면 provider/bootstrap trigger일
   가능성이 높지만, repository-controlled budget contract는 그대로 검증한다.
5. 동일 commit의 수동 rerun은 한 번만 진단 목적으로 사용할 수 있다. rerun 성공을 최종 acceptance로 사용하지 않는다.
6. 새 PR과 후속 main push에서 repository-policy와 `CI summary`가 첫 시도에 통과하는지 확인한다.
7. 10분 setup cap에서도 반복 실패하거나 action-specific error가 나오면 action/pnpm 교체를 즉시 시도하지 말고 별도
   upstream/provider incident로 분리한다.

Raw workflow log를 `docs/`에 복사하지 않는다. 필요한 로컬 진단 산출물은 `.artifacts/tools/ci-performance/`에 저장하고,
Issue에는 secret 없는 run ID, job ID, step, duration, conclusion만 기록한다.

## 검증

```bash
node --test scripts/ci/contracts/workflow-command-boundary.test.mjs
pnpm test:repo-policy
pnpm check:fast
git diff --check
```

원격에서는 다음 조건을 모두 확인한다.

- PR의 `Repository policy gate`: first-attempt success
- PR의 `CI summary`: success
- main push의 `Repository policy gate`: first-attempt success
- main push의 `CI summary`: success
- setup/install/policy/format step이 모두 실제로 실행됨

Cancelled run은 성공 성능 cohort에 포함하지 않는다. 대신 retry와 wasted compute를 포함한 reliability evidence로 유지한다.

## 참고

- [GitHub Actions job과 step timeout](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)
- [pnpm/action-setup v6.0.10 options](https://github.com/pnpm/action-setup/blob/v6.0.10/README.md)
- [pnpm/action-setup bootstrap implementation](https://github.com/pnpm/action-setup/blob/v6.0.10/src/install-pnpm/run.ts)
- [Repository incident #423](https://github.com/woohyun365/knu_roommate/issues/423)
