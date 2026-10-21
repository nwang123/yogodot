#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != Darwin ]]; then
  echo "Build the macOS application on a Mac." >&2
  exit 1
fi
PYTHON="${YOGO_PYTHON:-python3}"
"$PYTHON" -m venv .buildenv
.buildenv/bin/python -m pip install -r macos/requirements.txt
.buildenv/bin/python -m unittest discover -s tests -v
.buildenv/bin/python macos/build.py
