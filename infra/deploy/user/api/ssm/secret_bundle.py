"""API secret 묶음 설치·검사(D-AB7). API 배포 document가 host에서 python3 표준 library만으로 돌린다(host에는 Node가 없다).

  install <contract> <releases dir> <release id>   표준 입력의 묶음 JSON을 release 디렉터리에 key별 파일로 쓴다
  verify <contract> <bundle dir>                   기존 Node 검사(infra/deploy/scripts/verify-api-secret-bundle.sh)와 같은 판정
  extract <contract> <key> <file>                  표준 입력의 JSON object에서 key 하나만 있는지 보고 그 값을 0400 파일로 쓴다

판정 규칙은 secret-mount contract(infra/deploy/api/secret-mount.contract.json)가 소유한다: 파일 이름 = requiredFiles,
일반 파일(symlink 아님), 크기 1..maximumFileBytes, mode는 allowedFileModes, 빈 값 아님. 설치 모양은 파일 0400, 디렉터리
0500, 소유는 contract의 runtimeUid:runtimeGid(root로 돌 때만 바꾼다). 값은 출력하지 않는다. 오류 문구는 고정이다.
"""

import json
import os
import stat
import sys


class BundleError(Exception):
    pass


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


def main(argv):
    try:
        if len(argv) == 5 and argv[1] == "install":
            install(read_contract(argv[2]), argv[3], argv[4])
        elif len(argv) == 4 and argv[1] == "verify":
            verify(read_contract(argv[2]), argv[3])
        elif len(argv) == 5 and argv[1] == "extract":
            extract(read_contract(argv[2]), argv[3], argv[4])
        else:
            print("usage: secret_bundle.py install|verify|extract ...", file=sys.stderr)
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
