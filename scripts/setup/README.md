# Development prerequisites

Run the setup script for the host operating system from any directory.

## Arch Linux and derivatives

Run:

```bash
bash ./scripts/setup/arch.sh
```

The script uses `sudo` to update the system and install the native packages
required by Tauri. It supports Arch Linux derivatives such as Omarchy.

Development and native application builds work on current Arch releases. The
AppImage bundler distributed by Tauri can lag behind rolling-release ELF and
GDK Pixbuf changes. If AppImage packaging fails inside `linuxdeploy`, build
the native application without bundles:

```bash
npm run tauri -- build --no-bundle
```

## Windows

Open PowerShell and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup\windows.ps1
```

The script uses WinGet and may request administrator elevation while installing Microsoft C++ Build Tools.

## macOS

Run:

```bash
bash ./scripts/setup/macos.sh
```

Installing Xcode Command Line Tools can open an Apple installer. If that happens, finish the installation and run the script again.

## Ubuntu

Run:

```bash
bash ./scripts/setup/ubuntu.sh
```

The script uses `sudo` to install the native packages required by Tauri.

## Version policy

Node.js is pinned in `.node-version`, npm is pinned in `package.json`, and
Rust is pinned in `rust-toolchain.toml`. Update these files deliberately and
keep all development machines on the same versions.
