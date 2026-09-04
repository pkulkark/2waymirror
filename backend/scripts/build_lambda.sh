#!/usr/bin/env bash
# Build the Lambda deployment package: backend/build/lambda.zip
#
# Produces arm64 manylinux wheels for Python 3.13, copies in the app source,
# and zips deterministically (fixed file order and timestamps) so repeated
# builds of the same source produce a byte-identical archive.
#
# Usage: backend/scripts/build_lambda.sh
# Requires: uv, python3 (with pip), zip. Run from anywhere; paths are
# resolved relative to this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${BACKEND_DIR}/build"
PACKAGE_DIR="${BUILD_DIR}/package"
ZIP_PATH="${BUILD_DIR}/lambda.zip"
REQUIREMENTS_FILE="${BUILD_DIR}/requirements.txt"

echo "==> Cleaning ${BUILD_DIR}"
rm -rf "${BUILD_DIR}"
mkdir -p "${PACKAGE_DIR}"

echo "==> Exporting locked dependencies (no dev group)"
(
  cd "${BACKEND_DIR}"
  uv export --frozen --no-dev --no-emit-project --no-hashes -o "${REQUIREMENTS_FILE}" -q
)

echo "==> Installing arm64 manylinux wheels for Python 3.13"
python3 -m pip install \
  --platform manylinux2014_aarch64 \
  --python-version 3.13 \
  --implementation cp \
  --abi cp313 \
  --only-binary=:all: \
  --target "${PACKAGE_DIR}" \
  --no-compile \
  -r "${REQUIREMENTS_FILE}"

echo "==> Copying application source"
cp -R "${BACKEND_DIR}/src/twowaymirror" "${PACKAGE_DIR}/twowaymirror"
find "${PACKAGE_DIR}" -name '__pycache__' -type d -prune -exec rm -rf {} +

echo "==> Zipping deterministic package to ${ZIP_PATH}"
(
  cd "${PACKAGE_DIR}"
  # Fixed mtime and sorted, null-separated file list so the same inputs
  # always produce the same zip bytes regardless of filesystem ordering
  # or build time.
  find . -type f -print0 | sort -z | while IFS= read -r -d '' f; do
    touch -h -t 202401010000 "$f"
  done
  find . -type f | sort | zip -X -q "${ZIP_PATH}" -@
)

echo "==> Built $(du -h "${ZIP_PATH}" | cut -f1) at ${ZIP_PATH}"
