#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
NODE_VERSION="$(tr -d '[:space:]' < "${REPOSITORY_ROOT}/.node-version")"
NPM_VERSION="$(sed -nE 's/^[[:space:]]*"packageManager"[[:space:]]*:[[:space:]]*"npm@([^"]+)"[,]?$/\1/p' "${REPOSITORY_ROOT}/package.json")"
RUST_TOOLCHAIN="$(sed -nE 's/^channel[[:space:]]*=[[:space:]]*"([^"]+)"$/\1/p' "${REPOSITORY_ROOT}/rust-toolchain.toml")"
NVM_VERSION="v0.40.4"

if [[ -r /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
fi

if [[ "${ID:-}" != "arch" && " ${ID_LIKE:-} " != *" arch "* ]]; then
  echo "This setup script supports Arch Linux and Arch-based distributions." >&2
  exit 1
fi

if ! command -v pacman >/dev/null 2>&1; then
  echo "pacman is required to install the Arch Linux system dependencies." >&2
  exit 1
fi

if [[ -z "${NODE_VERSION}" || -z "${NPM_VERSION}" || -z "${RUST_TOOLCHAIN}" ]]; then
  echo "Could not read the pinned Node.js, npm, or Rust version." >&2
  exit 1
fi

echo "Installing Arch Linux packages required by Tauri..."
sudo pacman -Syu --needed \
  appmenu-gtk-module \
  base-devel \
  curl \
  file \
  git \
  libappindicator \
  librsvg \
  openssl \
  webkit2gtk-4.1 \
  wget \
  xdotool

export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [[ ! -s "${NVM_DIR}/nvm.sh" ]]; then
  mkdir -p "${NVM_DIR}"
  echo "Installing nvm ${NVM_VERSION}..."
  curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
fi

# shellcheck source=/dev/null
source "${NVM_DIR}/nvm.sh"
nvm install "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"
nvm use "${NODE_VERSION}"
if [[ "$(npm --version)" != "${NPM_VERSION}" ]]; then
  npm install --global "npm@${NPM_VERSION}"
fi

if [[ -s "${HOME}/.cargo/env" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.cargo/env"
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "Installing rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile default --default-toolchain "${RUST_TOOLCHAIN}"
fi

# shellcheck source=/dev/null
source "${HOME}/.cargo/env"
rustup toolchain install "${RUST_TOOLCHAIN}" --profile default --component clippy --component rustfmt

echo
echo "Development prerequisites are ready:"
git --version
node --version
npm --version
rustup run "${RUST_TOOLCHAIN}" rustc --version
rustup run "${RUST_TOOLCHAIN}" cargo --version
pkg-config --modversion webkit2gtk-4.1
