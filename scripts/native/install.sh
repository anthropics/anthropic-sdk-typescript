#!/usr/bin/env bash
#
# Anthropic TypeScript SDK Native Installer
#
# This script installs the Anthropic TypeScript SDK as a standalone binary,
# without requiring Node.js or npm to be installed.
#
# Usage:
#   curl -fsSL https://sdk.anthropic.com/typescript/install.sh | bash
#   curl -fsSL https://sdk.anthropic.com/typescript/install.sh | bash -s latest
#   curl -fsSL https://sdk.anthropic.com/typescript/install.sh | bash -s 0.71.2
#

set -euo pipefail

# Configuration
GCS_BUCKET="${ANTHROPIC_SDK_GCS_BUCKET:-https://storage.googleapis.com/anthropic-sdk-typescript}"
INSTALL_DIR="${ANTHROPIC_SDK_INSTALL_DIR:-$HOME/.anthropic-sdk}"
BIN_DIR="${ANTHROPIC_SDK_BIN_DIR:-$HOME/.local/bin}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
info() {
    echo -e "${BLUE}info${NC}: $1"
}

success() {
    echo -e "${GREEN}success${NC}: $1"
}

warn() {
    echo -e "${YELLOW}warning${NC}: $1"
}

error() {
    echo -e "${RED}error${NC}: $1" >&2
}

die() {
    error "$1"
    exit 1
}

# Detect OS
detect_os() {
    local os
    os="$(uname -s)"
    case "$os" in
        Darwin)
            echo "darwin"
            ;;
        Linux)
            echo "linux"
            ;;
        MINGW* | MSYS* | CYGWIN*)
            die "Windows detected. Please use the PowerShell installer instead:
  irm https://sdk.anthropic.com/typescript/install.ps1 | iex"
            ;;
        *)
            die "Unsupported operating system: $os"
            ;;
    esac
}

# Detect architecture
detect_arch() {
    local arch
    arch="$(uname -m)"
    case "$arch" in
        x86_64 | amd64)
            echo "x64"
            ;;
        arm64 | aarch64)
            echo "arm64"
            ;;
        *)
            die "Unsupported architecture: $arch"
            ;;
    esac
}

# Detect if running on musl libc (Alpine Linux, etc.)
detect_musl() {
    if [ -f /etc/alpine-release ]; then
        echo "-musl"
        return
    fi

    # Check for musl libc
    if command -v ldd >/dev/null 2>&1; then
        if ldd /bin/ls 2>/dev/null | grep -q 'musl'; then
            echo "-musl"
            return
        fi
    fi

    # Check for musl library files
    if ls /lib/libc.musl-*.so.1 >/dev/null 2>&1; then
        echo "-musl"
        return
    fi

    echo ""
}

# Get the download URL for the binary
get_download_url() {
    local version="$1"
    local platform="$2"
    echo "${GCS_BUCKET}/releases/${version}/${platform}/anthropic-sdk"
}

# Get the manifest URL
get_manifest_url() {
    local version="$1"
    echo "${GCS_BUCKET}/releases/${version}/manifest.json"
}

# Fetch the latest stable version
get_stable_version() {
    local stable_url="${GCS_BUCKET}/releases/stable"
    curl -fsSL "$stable_url" 2>/dev/null || die "Failed to fetch stable version"
}

# Fetch the latest version
get_latest_version() {
    local latest_url="${GCS_BUCKET}/releases/latest"
    curl -fsSL "$latest_url" 2>/dev/null || die "Failed to fetch latest version"
}

# Download and verify binary
download_binary() {
    local version="$1"
    local platform="$2"
    local download_dir="$3"

    local download_url
    download_url=$(get_download_url "$version" "$platform")

    local manifest_url
    manifest_url=$(get_manifest_url "$version")

    info "Downloading Anthropic TypeScript SDK v${version} for ${platform}..."

    # Create download directory
    mkdir -p "$download_dir"

    local binary_path="${download_dir}/anthropic-sdk"

    # Download binary
    if ! curl -fsSL "$download_url" -o "$binary_path"; then
        die "Failed to download binary from $download_url"
    fi

    # Download and verify checksum
    info "Verifying checksum..."
    local manifest
    if manifest=$(curl -fsSL "$manifest_url" 2>/dev/null); then
        local expected_checksum
        # Extract checksum for this platform from manifest JSON
        expected_checksum=$(echo "$manifest" | grep -o "\"${platform}\"[[:space:]]*:[[:space:]]*\"[a-f0-9]*\"" | grep -o '[a-f0-9]\{64\}' || true)

        if [ -n "$expected_checksum" ]; then
            local actual_checksum
            if command -v sha256sum >/dev/null 2>&1; then
                actual_checksum=$(sha256sum "$binary_path" | cut -d' ' -f1)
            elif command -v shasum >/dev/null 2>&1; then
                actual_checksum=$(shasum -a 256 "$binary_path" | cut -d' ' -f1)
            else
                warn "No SHA256 tool found, skipping checksum verification"
                return 0
            fi

            if [ "$expected_checksum" != "$actual_checksum" ]; then
                rm -f "$binary_path"
                die "Checksum verification failed!
Expected: $expected_checksum
Got:      $actual_checksum"
            fi

            success "Checksum verified"
        else
            warn "Could not extract checksum from manifest, skipping verification"
        fi
    else
        warn "Could not fetch manifest, skipping checksum verification"
    fi

    # Make executable
    chmod +x "$binary_path"

    echo "$binary_path"
}

# Install the binary
install_binary() {
    local binary_path="$1"

    # Create install directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$BIN_DIR"

    # Copy binary to install directory
    local installed_binary="${INSTALL_DIR}/anthropic-sdk"
    cp "$binary_path" "$installed_binary"
    chmod +x "$installed_binary"

    # Create symlink in bin directory
    local bin_link="${BIN_DIR}/anthropic-sdk"
    ln -sf "$installed_binary" "$bin_link"

    success "Installed to $installed_binary"
    success "Symlinked to $bin_link"

    echo "$bin_link"
}

# Check if PATH includes bin directory
check_path() {
    local bin_dir="$1"

    if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
        warn "$bin_dir is not in your PATH"
        echo ""
        echo "Add the following to your shell profile (.bashrc, .zshrc, etc.):"
        echo ""
        echo "  export PATH=\"\$PATH:$bin_dir\""
        echo ""
    fi
}

# Print usage information
print_usage() {
    local binary_path="$1"

    echo ""
    echo "Installation complete!"
    echo ""
    echo "Usage:"
    echo "  # Import in your TypeScript/JavaScript code:"
    echo "  import Anthropic from '@anthropic-ai/sdk';"
    echo ""
    echo "  # Or use the CLI:"
    echo "  anthropic-sdk --help"
    echo ""
    echo "For more information, visit:"
    echo "  https://docs.anthropic.com/sdk/typescript"
    echo ""
}

# Main installation function
main() {
    local target="${1:-stable}"

    echo ""
    echo "Anthropic TypeScript SDK Installer"
    echo "==================================="
    echo ""

    # Detect platform
    local os
    os=$(detect_os)

    local arch
    arch=$(detect_arch)

    local musl=""
    if [ "$os" = "linux" ]; then
        musl=$(detect_musl)
    fi

    local platform="${os}-${arch}${musl}"
    info "Detected platform: $platform"

    # Resolve version
    local version
    case "$target" in
        stable)
            info "Fetching stable version..."
            version=$(get_stable_version)
            ;;
        latest)
            info "Fetching latest version..."
            version=$(get_latest_version)
            ;;
        *)
            # Assume it's a version number
            version="$target"
            ;;
    esac

    info "Installing version: $version"

    # Create temporary download directory
    local download_dir
    download_dir=$(mktemp -d)
    trap 'rm -rf "$download_dir"' EXIT

    # Download binary
    local binary_path
    binary_path=$(download_binary "$version" "$platform" "$download_dir")

    # Install binary
    local installed_path
    installed_path=$(install_binary "$binary_path")

    # Check PATH
    check_path "$BIN_DIR"

    # Print usage
    print_usage "$installed_path"
}

main "$@"
