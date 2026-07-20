# Development prerequisites

Run the setup script for the host operating system from any directory.

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

Node.js is pinned in `.node-version`. Rust is pinned in `rust-toolchain.toml`. Update these files deliberately and keep all development machines on the same versions.
