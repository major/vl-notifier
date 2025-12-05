#!/usr/bin/env bash
# Version bump script for VL Touch Notify
# Usage: ./bump.sh <version>
# Example: ./bump.sh 1.3

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <version>"
    echo "Example: $0 1.3"
    exit 1
}

# Require version argument
if [[ $# -ne 1 ]]; then
    usage
fi

VERSION="$1"

# Validate version format (semver-ish: X.Y or X.Y.Z)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    echo -e "${RED}❌ Invalid version format: $VERSION${NC}"
    echo "Expected format: X.Y or X.Y.Z (e.g., 1.3 or 1.3.0)"
    exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed${NC}"
    echo "Install with: sudo dnf install jq"
    exit 1
fi

echo -e "${GREEN}📦 Bumping version to $VERSION${NC}"

# Update Firefox manifest
echo "  → firefox/manifest.json"
jq --arg v "$VERSION" '.version = $v' firefox/manifest.json > firefox/manifest.json.tmp
mv firefox/manifest.json.tmp firefox/manifest.json

# Update Chrome manifest
echo "  → chrome/manifest.json"
jq --arg v "$VERSION" '.version = $v' chrome/manifest.json > chrome/manifest.json.tmp
mv chrome/manifest.json.tmp chrome/manifest.json

# Update package.json (add .0 if needed for semver compliance)
PACKAGE_VERSION="$VERSION"
if [[ "$VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
    PACKAGE_VERSION="${VERSION}.0"
fi
echo "  → package.json (${PACKAGE_VERSION})"
jq --arg v "$PACKAGE_VERSION" '.version = $v' package.json > package.json.tmp
mv package.json.tmp package.json

echo -e "\n${GREEN}🏷️  Creating tag v${VERSION}${NC}"
git tag "v${VERSION}"

echo -e "\n${GREEN}✅ Done!${NC}"
echo -e "\nTo publish the release, run:"
echo -e "  ${YELLOW}git push origin v${VERSION}${NC}"
echo -e "\nGitHub Actions will automatically create the release."
