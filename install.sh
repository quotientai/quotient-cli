#!/usr/bin/env bash
# Installer for the Quotient CLI (`qt`).
# Usage: curl -fsSL https://raw.githubusercontent.com/quotient/cli/main/install.sh | bash
#   INSTALL_DIR=~/.local/bin VERSION=v0.1.0 ./install.sh

set -euo pipefail

REPO="${QUOTIENT_CLI_REPO:-quotient/cli}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "$uname_s" in
  Darwin) os="darwin" ;;
  Linux)  os="linux"  ;;
  *) echo "qt: unsupported OS: $uname_s" >&2; exit 1 ;;
esac

case "$uname_m" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) echo "qt: unsupported architecture: $uname_m" >&2; exit 1 ;;
esac

target="${os}-${arch}"

if [ -n "${VERSION:-}" ]; then
  tag="$VERSION"
else
  echo "qt: resolving latest release..." >&2
  tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -E '"tag_name"' \
    | head -n1 \
    | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

[ -z "$tag" ] && { echo "qt: could not determine release tag" >&2; exit 1; }
version="${tag#v}"

archive="qt-${version}-${target}.tar.gz"
url="https://github.com/${REPO}/releases/download/${tag}/${archive}"

echo "qt: downloading ${archive} from ${url}" >&2
curl -fsSL "$url" -o "${TMP}/${archive}"

echo "qt: extracting..." >&2
tar -xzf "${TMP}/${archive}" -C "$TMP"

mkdir -p "$INSTALL_DIR"
mv -f "${TMP}/qt" "${INSTALL_DIR}/qt"
chmod +x "${INSTALL_DIR}/qt"

echo "qt: installed ${tag} -> ${INSTALL_DIR}/qt" >&2

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo "" >&2
    echo "qt: ${INSTALL_DIR} is not on \$PATH. Add this to your shell rc:" >&2
    echo "    export PATH=\"${INSTALL_DIR}:\$PATH\"" >&2
    ;;
esac

"${INSTALL_DIR}/qt" --version || true
