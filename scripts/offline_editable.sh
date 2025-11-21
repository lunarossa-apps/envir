#!/usr/bin/env bash
set -euo pipefail

# Install the project in editable mode without reaching PyPI (no deps fetched).
PIP_USE_PEP517=0 PIP_NO_BUILD_ISOLATION=1 pip install -e . --no-deps
