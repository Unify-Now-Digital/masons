#!/bin/bash

# Script to create a new feature branch and specification file
# Usage: create-new-feature.sh --json "feature description"

set -e

if [ "$1" != "--json" ] || [ -z "$2" ]; then
  echo "Usage: $0 --json \"feature description\"" >&2
  exit 1
fi

FEATURE_DESC="$2"
REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC_DIR="${REPO_ROOT}/specs"

# Generate branch name from feature description (sanitize)
BRANCH_NAME=$(echo "$FEATURE_DESC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g' | cut -c1-50 | sed 's/-$//')
BRANCH_NAME="feature/${BRANCH_NAME}"

# Generate spec filename
SPEC_FILENAME=$(echo "$FEATURE_DESC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g' | cut -c1-100 | sed 's/-$//')
SPEC_FILE="${SPEC_DIR}/${SPEC_FILENAME}/spec.md"

# Create branch if it doesn't exist
if ! git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
  git checkout -b "$BRANCH_NAME"
else
  git checkout "$BRANCH_NAME"
fi

# Create spec file with initial content if it doesn't exist
if [ ! -f "$SPEC_FILE" ]; then
  mkdir -p "$(dirname "$SPEC_FILE")"
  touch "$SPEC_FILE"
fi

# Output JSON
cat <<EOF
{
  "BRANCH_NAME": "${BRANCH_NAME}",
  "SPEC_FILE": "${SPEC_FILE}"
}
EOF

