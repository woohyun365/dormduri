#!/usr/bin/env sh
# 백오피스 API entrypoint(backoffice-foundation D-BF16). 배포 document가 Secrets Manager 백오피스 묶음을 host 파일(0400, 소유
# 10001)로 쓰고 compose가 파일마다 읽기 전용으로 mount한 것을 env로 넘긴 뒤 명령을 실행한다. 이름은 secret-mount contract의
# apiFiles다. 값은 출력하지 않고, 파일이 없거나 일반 파일이 아니거나 비어 있으면 exit 66으로 멈춘다(앱은 env만 읽는다).
set -eu

contract=${BACKOFFICE_SECRET_CONTRACT_PATH:-/app/secret-mount.contract.json}
names=$(node -e '
const contract = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
const names = contract.apiFiles;
if (!Array.isArray(names) || names.length === 0 || names.some((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))) {
  process.exit(65);
}
process.stdout.write(names.join(" "));
' "${contract}") || {
  echo "invalid backoffice secret contract" >&2
  exit 65
}
directory=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).containerDirectory)' "${contract}")

for name in ${names}; do
  file=${directory}/${name}
  if [ -L "${file}" ] || [ ! -f "${file}" ] || [ ! -r "${file}" ] || [ ! -s "${file}" ]; then
    echo "invalid backoffice secret mount" >&2
    exit 66
  fi
  value=$(cat "${file}")
  if [ -z "${value}" ]; then
    echo "invalid backoffice secret mount" >&2
    exit 66
  fi
  export "${name}=${value}"
done

exec "$@"
