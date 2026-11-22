"""API secret 묶음 설치·검사(D-AB7). API 배포 document가 host에서 python3 표준 library만으로 돌린다(host에는 Node가 없다).

  install <contract> <releases dir> <release id>   표준 입력의 묶음 JSON을 release 디렉터리에 key별 파일로 쓴다
  verify <contract> <bundle dir>                   기존 Node 검사(infra/deploy/scripts/verify-api-secret-bundle.sh)와 같은 판정
  extract <contract> <key> <file>                  표준 입력의 JSON object에서 key 하나만 있는지 보고 그 값을 0400 파일로 쓴다
  observability <contract> <dir>                   표준 입력의 관측 묶음을 OBSERVABILITY_FILES의 파일과 수신 gateway 접근
                                                   include(GATEWAY_FILES)로 쓴다(그 파일을 읽는 container UID 소유 0400,
                                                   compose 조각의 관측 secret mount와 같은 이름)

판정 규칙은 secret-mount contract(infra/deploy/api/secret-mount.contract.json)가 소유한다: 파일 이름 = requiredFiles,
일반 파일(symlink 아님), 크기 1..maximumFileBytes, mode는 allowedFileModes, 빈 값 아님. 설치 모양은 파일 0400, 디렉터리
0500, 소유는 contract의 runtimeUid:runtimeGid(root로 돌 때만 바꾼다). 값은 출력하지 않는다. 오류 문구는 고정이다.
"""

import ipaddress
import json
import os
import re
import stat
import sys


class BundleError(Exception):
    pass


# 관측 secret 묶음(/dormduri/production/observability, D-AB6) key → (파일 이름, 소유 UID, GID). UID는 그 파일을 읽는 container의
# 실행 user다(Alertmanager 65534, Grafana 472:0). scripts/infra/user-host/compose-contract.mjs가 compose 조각과 대조한다.
OBSERVABILITY_FILES = {
    "GRAFANA_ADMIN_PASSWORD": ("grafana-admin-password", 472, 0),
    "SLACK_ALERT_WEBHOOK_URL": ("slack-webhook-url", 65534, 65534),
}

# 관측 수신 gateway(obs-gateway, nginx 101:101)의 접근 include(backoffice-foundation D-BF15). 관측 묶음의 선택 key 둘
# (BACKOFFICE_HOST_PRIVATE_IP: 백오피스 host 사설 IPv4, BACKOFFICE_INGEST_TOKEN: base64url 32..256자)이 함께 있으면 그 /32와
# Bearer token만 받는 geo·map을 쓰고, 둘 다 없으면 모두 거부하는 include를 쓴다. 하나만 있으면 묶음 오류다.
GATEWAY_KEYS = ("BACKOFFICE_HOST_PRIVATE_IP", "BACKOFFICE_INGEST_TOKEN")
GATEWAY_FILES = {
    "BACKOFFICE_GATEWAY_ACCESS": ("gateway-access.conf", 101, 101),
}
GATEWAY_TOKEN = re.compile(r"[A-Za-z0-9_-]{32,256}")


def read_contract(path):
    with open(path, encoding="utf-8") as handle:
        contract = json.load(handle)
    names = contract.get("requiredFiles")
    if not isinstance(names, list) or not all(isinstance(name, str) for name in names):
        raise BundleError("invalid secret mount contract")
    for name in names:
        if not name or not all(c.isupper() or c.isdigit() or c == "_" for c in name) or not name[0].isupper():
            raise BundleError("invalid secret file name")
    if not isinstance(contract.get("maximumFileBytes"), int):
        raise BundleError("invalid secret mount contract")
    return contract


def read_object():
    try:
        value = json.load(sys.stdin)
    except ValueError:
        raise BundleError("secret bundle is not JSON") from None
    if not isinstance(value, dict):
        raise BundleError("secret bundle is not a JSON object")
    return value


def encoded_value(contract, value):
    if not isinstance(value, str):
        raise BundleError("secret bundle value is not a string")
    data = value.encode("utf-8")
    if len(data) < 1 or len(data) > contract["maximumFileBytes"]:
        raise BundleError("invalid secret bundle file size")
    if not value.strip():
        raise BundleError("blank secret bundle file")
    return data


def owner(contract):
    if os.geteuid() != 0:
        return None
    return contract["runtimeUid"], contract["runtimeGid"]


def write_file(path, data, ids):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400)
    try:
        os.write(fd, data)
        os.fchmod(fd, 0o400)
        if ids:
            os.fchown(fd, ids[0], ids[1])
    finally:
        os.close(fd)


def verify(contract, directory):
    expected = sorted(contract["requiredFiles"])
    actual = sorted(os.listdir(directory))
    if actual != expected:
        raise BundleError("secret bundle inventory mismatch")
    for name in expected:
        path = os.path.join(directory, name)
        metadata = os.lstat(path)
        if not stat.S_ISREG(metadata.st_mode):
            raise BundleError("unsafe secret bundle file")
        if metadata.st_size < 1 or metadata.st_size > contract["maximumFileBytes"]:
            raise BundleError("invalid secret bundle file size")
        mode = format(stat.S_IMODE(metadata.st_mode), "04o")
        if mode not in contract["allowedFileModes"]:
            raise BundleError("invalid secret bundle file mode")
        with open(path, "rb") as handle:
            if not handle.read().decode("utf-8", "replace").strip():
                raise BundleError("blank secret bundle file")


def install(contract, releases, release):
    if not release or any(not (c.isalnum() or c in "._-") for c in release):
        raise BundleError("invalid release id")
    bundle = read_object()
    names = sorted(contract["requiredFiles"])
    if sorted(bundle) != names:
        raise BundleError("secret bundle keys differ from the contract")
    files = {name: encoded_value(contract, bundle[name]) for name in names}
    destination = os.path.join(releases, release)
    if os.path.lexists(destination):
        raise BundleError("release id already exists")
    os.makedirs(releases, mode=0o700, exist_ok=True)
    incoming = os.path.join(releases, ".incoming-%s-%d" % (release, os.getpid()))
    ids = owner(contract)
    os.mkdir(incoming, 0o700)
    try:
        for name, data in files.items():
            write_file(os.path.join(incoming, name), data, ids)
        verify(contract, incoming)
        os.chmod(incoming, 0o500)
        if ids:
            os.chown(incoming, ids[0], ids[1])
        os.rename(incoming, destination)
    except BaseException:
        for name in os.listdir(incoming) if os.path.isdir(incoming) else []:
            os.unlink(os.path.join(incoming, name))
        if os.path.isdir(incoming):
            os.rmdir(incoming)
        raise


def extract(contract, key, path):
    bundle = read_object()
    if sorted(bundle) != [key]:
        raise BundleError("secret bundle keys differ from the expected key")
    write_file(path, encoded_value(contract, bundle[key]), owner(contract))


def gateway_access(bundle):
    present = [key for key in GATEWAY_KEYS if key in bundle]
    if not present:
        return "geo $dormduri_backoffice_peer {\n  default 0;\n}\nmap $http_authorization $dormduri_backoffice_token {\n  default 0;\n}\n"
    if len(present) != len(GATEWAY_KEYS):
        raise BundleError("set both backoffice gateway keys or neither")
    try:
        address = ipaddress.IPv4Address(bundle["BACKOFFICE_HOST_PRIVATE_IP"])
    except (ipaddress.AddressValueError, TypeError):
        raise BundleError("backoffice host address is not an IPv4 address") from None
    if not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified:
        raise BundleError("backoffice host address is not a private host address")
    token = bundle["BACKOFFICE_INGEST_TOKEN"]
    if not isinstance(token, str) or not GATEWAY_TOKEN.fullmatch(token):
        raise BundleError("backoffice ingest token is not base64url of 32 to 256 characters")
    # map의 문자열 key는 대소문자를 가리지 않으므로 대소문자를 가리는 정규식으로 쓴다(token 글자는 정규식 특수 문자가 아니다).
    return (
        "geo $dormduri_backoffice_peer {\n  default 0;\n  %s/32 1;\n}\n"
        'map $http_authorization $dormduri_backoffice_token {\n  default 0;\n  "~^Bearer %s$" 1;\n}\n'
    ) % (address, token)


def observability(contract, directory):
    bundle = read_object()
    if sorted(key for key in bundle if key not in GATEWAY_KEYS) != sorted(OBSERVABILITY_FILES):
        raise BundleError("secret bundle keys differ from the observability keys")
    files = {key: encoded_value(contract, bundle[key]) for key in OBSERVABILITY_FILES}
    access = gateway_access(bundle).encode("utf-8")
    root = os.geteuid() == 0
    for key, (name, uid, gid) in OBSERVABILITY_FILES.items():
        write_file(os.path.join(directory, name), files[key], (uid, gid) if root else None)
    for name, uid, gid in GATEWAY_FILES.values():
        write_file(os.path.join(directory, name), access, (uid, gid) if root else None)


def main(argv):
    try:
        if len(argv) == 5 and argv[1] == "install":
            install(read_contract(argv[2]), argv[3], argv[4])
        elif len(argv) == 4 and argv[1] == "verify":
            verify(read_contract(argv[2]), argv[3])
        elif len(argv) == 5 and argv[1] == "extract":
            extract(read_contract(argv[2]), argv[3], argv[4])
        elif len(argv) == 4 and argv[1] == "observability":
            observability(read_contract(argv[2]), argv[3])
        else:
            print("usage: secret_bundle.py install|verify|extract|observability ...", file=sys.stderr)
            return 64
    except BundleError as error:
        print(str(error), file=sys.stderr)
        return 65
    except OSError as error:
        print("secret bundle file error: %s" % error.strerror, file=sys.stderr)
        return 66
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
