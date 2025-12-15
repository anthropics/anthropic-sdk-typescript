#!/usr/bin/env node
/**
 * Anthropic TypeScript SDK Native Build Script
 *
 * This script builds standalone binaries of the SDK using Bun's bundler.
 * The resulting binaries can be distributed without requiring Node.js.
 *
 * Usage:
 *   node scripts/native/build-native.js [--platform <platform>] [--all]
 *
 * Platforms:
 *   darwin-x64, darwin-arm64
 *   linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl
 *   win32-x64, win32-arm64
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const NATIVE_DIST_DIR = path.join(ROOT_DIR, "dist-native");

// Supported platforms for Bun compilation
const PLATFORMS = {
  "darwin-x64": { bunTarget: "bun-darwin-x64", ext: "" },
  "darwin-arm64": { bunTarget: "bun-darwin-arm64", ext: "" },
  "linux-x64": { bunTarget: "bun-linux-x64", ext: "" },
  "linux-arm64": { bunTarget: "bun-linux-arm64", ext: "" },
  "linux-x64-musl": { bunTarget: "bun-linux-x64-musl", ext: "" },
  "linux-arm64-musl": { bunTarget: "bun-linux-arm64-musl", ext: "" },
  "win32-x64": { bunTarget: "bun-windows-x64", ext: ".exe" },
  // Note: win32-arm64 support depends on Bun's Windows ARM64 support
};

// Entry point for the standalone binary
const ENTRY_POINT = path.join(ROOT_DIR, "src/native-entry.ts");

/**
 * Check if Bun is installed
 */
function checkBun() {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create the native entry point file
 * This wraps the SDK to work as a standalone binary
 */
function createEntryPoint() {
  const entryContent = `#!/usr/bin/env bun
/**
 * Anthropic TypeScript SDK - Native Entry Point
 *
 * This file serves as the entry point for the standalone binary distribution.
 * It re-exports the SDK and provides CLI functionality.
 */

// Re-export everything from the main SDK
export * from './index';
export { default } from './index';

// CLI functionality for standalone usage
import Anthropic from './index';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(\`
Anthropic TypeScript SDK v\${require('./version').VERSION}

This is the native binary distribution of the Anthropic TypeScript SDK.
You can import this SDK in your TypeScript/JavaScript projects.

Usage in code:
  import Anthropic from '@anthropic-ai/sdk';

  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude!' }]
  });

CLI Commands:
  --help, -h      Show this help message
  --version, -v   Show SDK version
  --info          Show SDK and runtime information

For more information, visit:
  https://docs.anthropic.com/sdk/typescript
\`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(require('./version').VERSION);
    process.exit(0);
  }

  if (args.includes('--info')) {
    console.log(\`
Anthropic TypeScript SDK
========================
Version: \${require('./version').VERSION}
Runtime: \${typeof Bun !== 'undefined' ? 'Bun' : 'Node.js'}
Platform: \${process.platform}
Architecture: \${process.arch}
\`);
    process.exit(0);
  }

  // If no arguments, show help
  if (args.length === 0) {
    console.log('Anthropic TypeScript SDK - Native Binary');
    console.log('Run with --help for usage information.');
    process.exit(0);
  }

  console.error('Unknown command. Run with --help for usage information.');
  process.exit(1);
}

// Only run CLI if executed directly
if (require.main === module || process.argv[1]?.includes('anthropic-sdk')) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
`;

  fs.writeFileSync(ENTRY_POINT, entryContent);
  console.log(`Created entry point: ${ENTRY_POINT}`);
}

/**
 * Build for a specific platform
 */
function buildForPlatform(platform) {
  const config = PLATFORMS[platform];
  if (!config) {
    console.error(`Unknown platform: ${platform}`);
    process.exit(1);
  }

  const outputDir = path.join(NATIVE_DIST_DIR, platform);
  const binaryName = `anthropic-sdk${config.ext}`;
  const outputPath = path.join(outputDir, binaryName);

  console.log(`\nBuilding for ${platform}...`);

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Build with Bun
  const buildCmd = [
    "bun",
    "build",
    ENTRY_POINT,
    "--compile",
    `--target=${config.bunTarget}`,
    `--outfile=${outputPath}`,
    "--minify",
  ].join(" ");

  try {
    console.log(`Running: ${buildCmd}`);
    execSync(buildCmd, { cwd: ROOT_DIR, stdio: "inherit" });
    console.log(`Built: ${outputPath}`);

    // Calculate SHA256 checksum
    const fileBuffer = fs.readFileSync(outputPath);
    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    console.log(`SHA256: ${checksum}`);

    return { platform, path: outputPath, checksum };
  } catch (error) {
    console.error(`Failed to build for ${platform}:`, error.message);
    return null;
  }
}

/**
 * Generate manifest.json with checksums
 */
function generateManifest(builds, version) {
  const manifest = {
    version,
    generated: new Date().toISOString(),
    platforms: {},
  };

  for (const build of builds) {
    if (build) {
      manifest.platforms[build.platform] = build.checksum;
    }
  }

  const manifestPath = path.join(NATIVE_DIST_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nGenerated manifest: ${manifestPath}`);

  return manifest;
}

/**
 * Main build function
 */
async function main() {
  const args = process.argv.slice(2);

  // Check for Bun
  if (!checkBun()) {
    console.error("Error: Bun is required for native builds.");
    console.error("Install Bun: curl -fsSL https://bun.sh/install | bash");
    process.exit(1);
  }

  // Parse arguments
  let platforms = [];
  let buildAll = args.includes("--all");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      platforms.push(args[i + 1]);
      i++;
    }
  }

  // If --all or no specific platform, build for all
  if (buildAll || platforms.length === 0) {
    platforms = Object.keys(PLATFORMS);
  }

  // Get version from package.json
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")
  );
  const version = packageJson.version;

  console.log(`Anthropic TypeScript SDK Native Build`);
  console.log(`=====================================`);
  console.log(`Version: ${version}`);
  console.log(`Platforms: ${platforms.join(", ")}`);

  // Clean dist-native directory
  if (fs.existsSync(NATIVE_DIST_DIR)) {
    fs.rmSync(NATIVE_DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(NATIVE_DIST_DIR, { recursive: true });

  // Create entry point
  createEntryPoint();

  // Build for each platform
  const builds = [];
  for (const platform of platforms) {
    const result = buildForPlatform(platform);
    builds.push(result);
  }

  // Generate manifest
  const manifest = generateManifest(builds.filter(Boolean), version);

  // Write version files for installer
  fs.writeFileSync(path.join(NATIVE_DIST_DIR, "stable"), version);
  fs.writeFileSync(path.join(NATIVE_DIST_DIR, "latest"), version);

  console.log(`\nBuild complete!`);
  console.log(`Output directory: ${NATIVE_DIST_DIR}`);
  console.log(`\nSuccessfully built: ${builds.filter(Boolean).length}/${platforms.length} platforms`);

  // Summary
  const failed = builds.filter((b) => !b);
  if (failed.length > 0) {
    console.log(`\nFailed builds: ${failed.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
