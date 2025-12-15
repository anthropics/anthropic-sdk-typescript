#!/usr/bin/env node
/**
 * Postinstall script for @anthropic-ai/sdk
 *
 * This script runs after npm install and downloads the native binary
 * for the current platform, replacing the Node.js version with the
 * faster Bun-compiled binary.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const PACKAGE_DIR = path.resolve(__dirname, "..");
const GCS_BUCKET =
  process.env.ANTHROPIC_SDK_GCS_BUCKET ||
  "https://storage.googleapis.com/anthropic-sdk-typescript";

// Platform mapping
const PLATFORM_MAP = {
  "darwin-x64": "darwin-x64",
  "darwin-arm64": "darwin-arm64",
  "linux-x64": null, // Will be resolved to glibc or musl
  "linux-arm64": null,
  "win32-x64": "win32-x64",
  "win32-arm64": "win32-x64", // Fallback to x64 via emulation
};

/**
 * Detect if running on musl libc (Alpine Linux, etc.)
 */
function isMusl() {
  try {
    // Check for Alpine
    if (fs.existsSync("/etc/alpine-release")) {
      return true;
    }

    // Check ldd output
    const lddOutput = execSync("ldd /bin/ls 2>/dev/null || true", {
      encoding: "utf8",
    });
    if (lddOutput.includes("musl")) {
      return true;
    }

    // Check for musl library files
    const libFiles = fs.readdirSync("/lib").filter((f) => f.startsWith("libc.musl-"));
    if (libFiles.length > 0) {
      return true;
    }
  } catch {
    // Ignore errors, assume glibc
  }
  return false;
}

/**
 * Get the platform identifier for the current system
 */
function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  const key = `${platform}-${arch}`;

  if (platform === "linux") {
    const suffix = isMusl() ? "-musl" : "";
    return `linux-${arch}${suffix}`;
  }

  const mapped = PLATFORM_MAP[key];
  if (mapped === undefined) {
    return null; // Unsupported platform
  }
  return mapped || key;
}

/**
 * Download a file from URL
 */
function download(url) {
  return new Promise((resolve, reject) => {
    const makeRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      const protocol = url.startsWith("https") ? https : require("http");
      protocol
        .get(url, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            makeRequest(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${url}`));
            return;
          }

          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        })
        .on("error", reject);
    };

    makeRequest(url);
  });
}

/**
 * Get SHA256 checksum of a buffer
 */
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Main postinstall function
 */
async function main() {
  // Check if native install is disabled
  if (process.env.ANTHROPIC_SDK_SKIP_NATIVE === "1") {
    console.log("[@anthropic-ai/sdk] Skipping native binary (ANTHROPIC_SDK_SKIP_NATIVE=1)");
    return;
  }

  // Check if running in CI where we might want to skip
  if (process.env.CI && process.env.ANTHROPIC_SDK_FORCE_NATIVE !== "1") {
    // In CI, only install native if explicitly requested
    if (process.env.ANTHROPIC_SDK_NATIVE !== "1") {
      console.log("[@anthropic-ai/sdk] Skipping native binary in CI (set ANTHROPIC_SDK_NATIVE=1 to enable)");
      return;
    }
  }

  const platform = getPlatform();
  if (!platform) {
    console.log(`[@anthropic-ai/sdk] No native binary available for ${process.platform}-${process.arch}, using Node.js version`);
    return;
  }

  // Read package.json to get version
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8")
  );
  const version = packageJson.version;

  console.log(`[@anthropic-ai/sdk] Downloading native binary for ${platform}...`);

  try {
    // Download manifest to get checksum
    const manifestUrl = `${GCS_BUCKET}/releases/v${version}/manifest.json`;
    let manifest;
    try {
      const manifestData = await download(manifestUrl);
      manifest = JSON.parse(manifestData.toString());
    } catch (err) {
      // Try without 'v' prefix
      const altManifestUrl = `${GCS_BUCKET}/releases/${version}/manifest.json`;
      try {
        const manifestData = await download(altManifestUrl);
        manifest = JSON.parse(manifestData.toString());
      } catch {
        console.log(`[@anthropic-ai/sdk] Native binary not available for v${version}, using Node.js version`);
        return;
      }
    }

    const expectedChecksum = manifest.platforms?.[platform];
    if (!expectedChecksum) {
      console.log(`[@anthropic-ai/sdk] No native binary for ${platform} in v${version}, using Node.js version`);
      return;
    }

    // Download binary
    const ext = platform.startsWith("win32") ? ".exe" : "";
    const binaryUrl = `${GCS_BUCKET}/releases/v${version}/${platform}/anthropic-sdk${ext}`;
    let binaryData;
    try {
      binaryData = await download(binaryUrl);
    } catch {
      // Try without 'v' prefix
      const altBinaryUrl = `${GCS_BUCKET}/releases/${version}/${platform}/anthropic-sdk${ext}`;
      binaryData = await download(altBinaryUrl);
    }

    // Verify checksum
    const actualChecksum = sha256(binaryData);
    if (actualChecksum !== expectedChecksum) {
      console.error(`[@anthropic-ai/sdk] Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
      console.log(`[@anthropic-ai/sdk] Falling back to Node.js version`);
      return;
    }

    // Write binary to package directory
    const binaryPath = path.join(PACKAGE_DIR, `native-binary${ext}`);
    fs.writeFileSync(binaryPath, binaryData);
    fs.chmodSync(binaryPath, 0o755);

    // Write marker file to indicate native binary is installed
    fs.writeFileSync(
      path.join(PACKAGE_DIR, ".native-installed"),
      JSON.stringify({ platform, version, checksum: actualChecksum })
    );

    console.log(`[@anthropic-ai/sdk] Native binary installed successfully`);
  } catch (err) {
    console.log(`[@anthropic-ai/sdk] Failed to download native binary: ${err.message}`);
    console.log(`[@anthropic-ai/sdk] Using Node.js version instead`);
  }
}

main().catch((err) => {
  // Don't fail the install if postinstall fails
  console.error(`[@anthropic-ai/sdk] Postinstall error: ${err.message}`);
  process.exit(0);
});
