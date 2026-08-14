#!/usr/bin/env sh
set -eu
umask 077

command="${1:?install or activate command is required}"
script_directory=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

case "$command" in
  install)
    candidate_directory="${2:?candidate directory is required}"
    release_root="${3:?release root is required}"
    release_id="${4:?release id is required}"
    case "$release_id" in *[!A-Za-z0-9._-]*|'') echo 'invalid release id' >&2; exit 65;; esac
    releases_directory="$release_root/releases"
    destination="$releases_directory/$release_id"
    incoming="$releases_directory/.incoming-$release_id-$$"
    [ ! -e "$destination" ] || { echo 'release id already exists' >&2; exit 65; }
    mkdir -p "$releases_directory"
    trap 'rm -rf "$incoming"' EXIT HUP INT TERM
    cp -R "$candidate_directory" "$incoming"
    if [ "$(id -u)" -eq 0 ]; then
      runtime_gid=$(node -p "require('${API_SECRET_MOUNT_CONTRACT:-$script_directory/../api/secret-mount.contract.json}').runtimeGid")
      chown -R "root:$runtime_gid" "$incoming"
      find "$incoming" -type d -exec chmod 0750 {} +
      find "$incoming" -type f -exec chmod 0440 {} +
    fi
    "$script_directory/verify-api-secret-bundle.sh" "$incoming" >/dev/null
    mv "$incoming" "$destination"
    trap - EXIT HUP INT TERM
    printf '%s\n' 'secret release installed'
    ;;
  activate)
    release_root="${2:?release root is required}"
    release_id="${3:?release id is required}"
    destination="$release_root/releases/$release_id"
    [ -d "$destination" ] || { echo 'secret release does not exist' >&2; exit 66; }
    "$script_directory/verify-api-secret-bundle.sh" "$destination" >/dev/null
    temporary_link="$release_root/.current-$$"
    trap 'rm -f "$temporary_link"' EXIT HUP INT TERM
    ln -s "releases/$release_id" "$temporary_link"
    node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' \
      "$temporary_link" "$release_root/current"
    trap - EXIT HUP INT TERM
    printf '%s\n' 'secret release activated'
    ;;
  *)
    echo 'unsupported secret bundle command' >&2
    exit 64
    ;;
esac
