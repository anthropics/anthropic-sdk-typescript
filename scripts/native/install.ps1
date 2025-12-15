#
# Anthropic TypeScript SDK Native Installer for Windows
#
# Usage:
#   irm https://sdk.anthropic.com/typescript/install.ps1 | iex
#   irm https://sdk.anthropic.com/typescript/install.ps1 | iex -Args "latest"
#   irm https://sdk.anthropic.com/typescript/install.ps1 | iex -Args "0.71.2"
#

param(
    [string]$Target = "stable"
)

$ErrorActionPreference = "Stop"

# Configuration
$GcsBucket = if ($env:ANTHROPIC_SDK_GCS_BUCKET) { $env:ANTHROPIC_SDK_GCS_BUCKET } else { "https://storage.googleapis.com/anthropic-sdk-typescript" }
$InstallDir = if ($env:ANTHROPIC_SDK_INSTALL_DIR) { $env:ANTHROPIC_SDK_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".anthropic-sdk" }
$BinDir = if ($env:ANTHROPIC_SDK_BIN_DIR) { $env:ANTHROPIC_SDK_BIN_DIR } else { Join-Path $env:USERPROFILE ".local\bin" }

function Write-Info {
    param([string]$Message)
    Write-Host "info: " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "success: " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "warning: " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "error: " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Get-Platform {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "win32-x64" }
        "ARM64" { return "win32-arm64" }
        default { throw "Unsupported architecture: $arch" }
    }
}

function Get-StableVersion {
    $url = "$GcsBucket/releases/stable"
    try {
        return (Invoke-WebRequest -Uri $url -UseBasicParsing).Content.Trim()
    } catch {
        throw "Failed to fetch stable version: $_"
    }
}

function Get-LatestVersion {
    $url = "$GcsBucket/releases/latest"
    try {
        return (Invoke-WebRequest -Uri $url -UseBasicParsing).Content.Trim()
    } catch {
        throw "Failed to fetch latest version: $_"
    }
}

function Get-BinaryChecksum {
    param(
        [string]$Version,
        [string]$Platform
    )

    $manifestUrl = "$GcsBucket/releases/$Version/manifest.json"
    try {
        $manifest = (Invoke-WebRequest -Uri $manifestUrl -UseBasicParsing).Content | ConvertFrom-Json
        return $manifest.$Platform
    } catch {
        Write-Warn "Could not fetch manifest, skipping checksum verification"
        return $null
    }
}

function Get-FileChecksum {
    param([string]$FilePath)
    $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
    return $hash.Hash.ToLower()
}

function Install-SDK {
    Write-Host ""
    Write-Host "Anthropic TypeScript SDK Installer"
    Write-Host "==================================="
    Write-Host ""

    # Detect platform
    $platform = Get-Platform
    Write-Info "Detected platform: $platform"

    # Resolve version
    $version = switch ($Target) {
        "stable" {
            Write-Info "Fetching stable version..."
            Get-StableVersion
        }
        "latest" {
            Write-Info "Fetching latest version..."
            Get-LatestVersion
        }
        default { $Target }
    }

    Write-Info "Installing version: $version"

    # Create directories
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

    # Download binary
    $downloadUrl = "$GcsBucket/releases/$version/$platform/anthropic-sdk.exe"
    $downloadPath = Join-Path $env:TEMP "anthropic-sdk.exe"

    Write-Info "Downloading Anthropic TypeScript SDK v$version for $platform..."

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath -UseBasicParsing
    } catch {
        throw "Failed to download binary from $downloadUrl : $_"
    }

    # Verify checksum
    Write-Info "Verifying checksum..."
    $expectedChecksum = Get-BinaryChecksum -Version $version -Platform $platform

    if ($expectedChecksum) {
        $actualChecksum = Get-FileChecksum -FilePath $downloadPath

        if ($expectedChecksum -ne $actualChecksum) {
            Remove-Item -Path $downloadPath -Force
            throw "Checksum verification failed!`nExpected: $expectedChecksum`nGot:      $actualChecksum"
        }

        Write-Success "Checksum verified"
    }

    # Install binary
    $installedPath = Join-Path $InstallDir "anthropic-sdk.exe"
    Move-Item -Path $downloadPath -Destination $installedPath -Force

    Write-Success "Installed to $installedPath"

    # Create symlink or copy to bin directory
    $binPath = Join-Path $BinDir "anthropic-sdk.exe"
    try {
        # Try to create symbolic link (requires admin or developer mode)
        New-Item -ItemType SymbolicLink -Path $binPath -Target $installedPath -Force | Out-Null
        Write-Success "Symlinked to $binPath"
    } catch {
        # Fall back to copy
        Copy-Item -Path $installedPath -Destination $binPath -Force
        Write-Success "Copied to $binPath"
    }

    # Check if bin directory is in PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$BinDir*") {
        Write-Warn "$BinDir is not in your PATH"
        Write-Host ""
        Write-Host "To add it to your PATH, run:"
        Write-Host ""
        Write-Host "  `$env:Path += `";$BinDir`""
        Write-Host "  [Environment]::SetEnvironmentVariable(`"Path`", `$env:Path + `";$BinDir`", `"User`")"
        Write-Host ""
    }

    # Print usage
    Write-Host ""
    Write-Host "Installation complete!"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  # Import in your TypeScript/JavaScript code:"
    Write-Host "  import Anthropic from '@anthropic-ai/sdk';"
    Write-Host ""
    Write-Host "  # Or use the CLI:"
    Write-Host "  anthropic-sdk --help"
    Write-Host ""
    Write-Host "For more information, visit:"
    Write-Host "  https://docs.anthropic.com/sdk/typescript"
    Write-Host ""
}

# Run installer
Install-SDK
