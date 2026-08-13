#!/usr/bin/env bash
set -exuo pipefail

# Tag the version with the branch (as a prerelease identifier) so a preview
# build never shares a version with a published release, and make subpackage
# previews depend on the core preview from the same commit — it is uploaded
# first below — since a prerelease core no longer satisfies their version range.
stamp_preview_version() {
  local pkg_json="$1/package.json"
  local branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
  local slug version
  slug=$(printf '%s' "$branch" | LC_ALL=C sed -E 's/[^0-9A-Za-z-]+/-/g; s/^-+//; s/-+$//')
  version=$(jq -r '.version' "$pkg_json")
  if [[ -n "$slug" && "$version" == *-* ]]; then
    version="$version.$slug"
  elif [[ -n "$slug" ]]; then
    version="$version-$slug"
  fi
  jq --arg version "$version" --arg core "https://pkg.stainless.com/s/anthropic-typescript/$SHA" '
    .version = $version
    | if .dependencies["@anthropic-ai/sdk"] then .dependencies["@anthropic-ai/sdk"] = $core else . end
  ' "$pkg_json" > "$pkg_json.tmp"
  mv "$pkg_json.tmp" "$pkg_json"
}

RESPONSE=$(curl -X POST "$URL" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json")

SIGNED_URL=$(echo "$RESPONSE" | jq -r '.url')

if [[ "$SIGNED_URL" == "null" ]]; then
  echo -e "\033[31mFailed to get signed URL.\033[0m"
  exit 1
fi

stamp_preview_version dist
TARBALL=$(cd dist && npm pack --silent)

UPLOAD_RESPONSE=$(curl -v -X PUT \
  -H "Content-Type: application/gzip" \
  --data-binary "@dist/$TARBALL" "$SIGNED_URL" 2>&1)

if echo "$UPLOAD_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
  echo -e "\033[32mUploaded build to Stainless storage.\033[0m"
  echo -e "\033[32mInstallation: npm install 'https://pkg.stainless.com/s/anthropic-typescript/$SHA'\033[0m"
else
  echo -e "\033[31mFailed to upload artifact.\033[0m"
  exit 1
fi

# Upload aws-sdk tarball

AWS_RESPONSE=$(curl -X POST "$URL?subpackage=aws" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json")

AWS_SIGNED_URL=$(echo "$AWS_RESPONSE" | jq -r '.url')

if [[ "$AWS_SIGNED_URL" == "null" ]]; then
  echo -e "\033[31mFailed to get signed URL for aws-sdk.\033[0m"
  exit 1
fi

stamp_preview_version packages/aws-sdk/dist
AWS_TARBALL=$(cd packages/aws-sdk/dist && npm pack --silent)

AWS_UPLOAD_RESPONSE=$(curl -v -X PUT \
  -H "Content-Type: application/gzip" \
  --data-binary "@packages/aws-sdk/dist/$AWS_TARBALL" "$AWS_SIGNED_URL" 2>&1)

if echo "$AWS_UPLOAD_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
  echo -e "\033[32mUploaded aws-sdk build to Stainless storage.\033[0m"
  echo -e "\033[32mInstallation: npm install 'https://pkg.stainless.com/s/anthropic-typescript/$SHA?subpackage=aws'\033[0m"
else
  echo -e "\033[31mFailed to upload aws-sdk artifact.\033[0m"
  exit 1
fi

# Upload bedrock-sdk tarball

AWS_RESPONSE=$(curl -X POST "$URL?subpackage=bedrock" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json")

AWS_SIGNED_URL=$(echo "$AWS_RESPONSE" | jq -r '.url')

if [[ "$AWS_SIGNED_URL" == "null" ]]; then
  echo -e "\033[31mFailed to get signed URL for bedrock-sdk.\033[0m"
  exit 1
fi

stamp_preview_version packages/bedrock-sdk/dist
AWS_TARBALL=$(cd packages/bedrock-sdk/dist && npm pack --silent)

AWS_UPLOAD_RESPONSE=$(curl -v -X PUT \
  -H "Content-Type: application/gzip" \
  --data-binary "@packages/bedrock-sdk/dist/$AWS_TARBALL" "$AWS_SIGNED_URL" 2>&1)

if echo "$AWS_UPLOAD_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
  echo -e "\033[32mUploaded bedrock-sdk build to Stainless storage.\033[0m"
  echo -e "\033[32mInstallation: npm install 'https://pkg.stainless.com/s/anthropic-typescript/$SHA?subpackage=bedrock'\033[0m"
else
  echo -e "\033[31mFailed to upload bedrock-sdk artifact.\033[0m"
  exit 1
fi
