# ADR-0004: Build and test natively on Windows, macOS, and Ubuntu

- Status: Accepted
- Date: 2026-07-21

## Context

Tauri uses platform-specific toolchains and WebView implementations. The project has access to a Windows PC, a Mac, and an Ubuntu machine. WSL and containers cannot fully validate native application integration, signing, packaging, or the actual target WebView.

## Decision

Develop and build with native toolchains on each supported operating system:

- Windows for MSVC, WebView2, and Windows installers;
- macOS for WebKit, Keychain, signing, notarization, and macOS packages;
- Ubuntu for WebKitGTK, Secret Service integration, and Linux packages.

Use the same Git branch strategy and shared source tree on every platform. Use WSL or containers only for auxiliary services, mock APIs, and focused compatibility checks.

## Consequences

- Platform behavior and packaging are tested in realistic environments.
- Development dependencies must be maintained on three machines.
- CI should eventually run checks on Windows, macOS, and Ubuntu.
- Platform-specific code must remain isolated behind small interfaces.
- Signing and notarization credentials remain outside the repository and protected by the target platform or CI secret store.

## Alternatives considered

- **WSL as the main Windows environment**: produces Linux builds and adds cross-filesystem friction for a Windows-hosted checkout.
- **Docker for all builds**: useful for services, but does not replace native Windows and macOS application toolchains.
- **Cross-compilation from one host**: insufficient for complete packaging and integration verification across all targets.
