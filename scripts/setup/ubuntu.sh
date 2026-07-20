#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
NODE_VERSION="$(tr -d '[:space:]' < "${REPOSITORY_ROOT}/.node-version")"
RUST_TOOLCHAIN="$(sed -nE 's/^channel[[:space:]]*=[[:space:]]*"([^"]+)"$/\1/p' "${REPOSITORY_ROOT}/rust-toolchain.toml")"
NVM_VERSION="v0.40.4"

echo "Installing Ubuntu packages required by Tauri..."
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  file \
  git \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  wget

export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [[ ! -s "${NVM_DIR}/nvm.sh" ]]; then
  echo "Installing nvm ${NVM_VERSION}..."
  curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
fi

# shellcheck source=/dev/null
source "${NVM_DIR}/nvm.sh"
nvm install "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"
nvm use "${NODE_VERSION}"

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
