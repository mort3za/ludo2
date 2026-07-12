#!/usr/bin/env bash
# Release helper.
#
# Reads the version from package.json, commits any pending changes as the
# version-bump commit, creates an annotated v<version> tag, and pushes the
# branch and tag to the remote.
#
# Usage: bump the "version" field in package.json, then run `bun run release`.
set -euo pipefail

VERSION=$(sed -nE 's/.*"version" *: *"([^"]+)".*/\1/p' package.json | head -1)
TAG="v$VERSION"

if [ -z "$VERSION" ]; then
  echo "Could not read version from package.json" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag $TAG already exists — bump the version in package.json first." >&2
  exit 1
fi

# Commit the version bump (and any other pending changes) if the tree is dirty.
if ! git diff-index --quiet HEAD --; then
  git commit -am "Bump version to $VERSION"
fi

git tag -a "$TAG" -m "Release $VERSION"
git push --follow-tags

echo "Released $TAG"
