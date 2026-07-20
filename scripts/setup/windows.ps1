[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$nodeVersion = (Get-Content -LiteralPath (Join-Path $repositoryRoot ".node-version") -Raw).Trim()
$rustToolchain = (Select-String -LiteralPath (Join-Path $repositoryRoot "rust-toolchain.toml") -Pattern '^channel\s*=\s*"([^"]+)"$').Matches.Groups[1].Value

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Install-WinGetPackage {
    param(
        [Parameter(Mandatory)] [string] $Id,
        [string[]] $ExtraArguments = @()
    )

    $arguments = @(
        "install",
        "--id", $Id,
        "--exact",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity"
    ) + $ExtraArguments

    & winget @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "WinGet failed while installing $Id (exit code $LASTEXITCODE)."
    }
}

function Test-WinGetPackage {
    param([Parameter(Mandatory)] [string] $Id)

    & winget list --id $Id --exact --accept-source-agreements *> $null
    return $LASTEXITCODE -eq 0
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "WinGet is required. Install or update App Installer from Microsoft Store."
}

Refresh-ProcessPath

Write-Host "Installing Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Install-WinGetPackage -Id "Git.Git" -ExtraArguments @("--silent")
    Refresh-ProcessPath
}

Write-Host "Installing Node.js $nodeVersion (LTS line)..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Install-WinGetPackage -Id "OpenJS.NodeJS.LTS" -ExtraArguments @("--version", $nodeVersion, "--silent")
    Refresh-ProcessPath
}

Write-Host "Installing rustup..."
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    Install-WinGetPackage -Id "Rustlang.Rustup" -ExtraArguments @("--silent")
    Refresh-ProcessPath
}

Write-Host "Installing Microsoft C++ Build Tools..."
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasCppTools = $false
if (Test-Path -LiteralPath $vsWhere) {
    $installationPath = & $vsWhere -products Microsoft.VisualStudio.Product.BuildTools -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath
    $hasCppTools = -not [string]::IsNullOrWhiteSpace(($installationPath -join ""))
}

if (-not $hasCppTools) {
    Install-WinGetPackage -Id "Microsoft.VisualStudio.BuildTools" -ExtraArguments @(
        "--override",
        "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    )
}

Write-Host "Ensuring Microsoft Edge WebView2 Runtime is installed..."
if (-not (Test-WinGetPackage -Id "Microsoft.EdgeWebView2Runtime")) {
    Install-WinGetPackage -Id "Microsoft.EdgeWebView2Runtime" -ExtraArguments @("--silent")
    Refresh-ProcessPath
}

Write-Host "Installing the pinned Rust toolchain..."
& rustup toolchain install $rustToolchain --profile default --component clippy --component rustfmt
if ($LASTEXITCODE -ne 0) {
    throw "Could not install Rust $rustToolchain."
}

$installedNode = (& node --version).TrimStart("v")
if ($installedNode -ne $nodeVersion) {
    throw "Node.js $installedNode is active, but the project requires $nodeVersion."
}

Write-Host ""
Write-Host "Development prerequisites are ready:" -ForegroundColor Green
& git --version
& node --version
& npm --version
& rustup run $rustToolchain rustc --version
& rustup run $rustToolchain cargo --version

if (Test-Path -LiteralPath $vsWhere) {
    & $vsWhere -products Microsoft.VisualStudio.Product.BuildTools -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath
}
