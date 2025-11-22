#!/usr/bin/env bash
set -euo pipefail

# Simple helper to create a virtual environment, install dependencies, and run the dev server.
# Usage: ./scripts/devserver.sh

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
VENV_DIR="$PROJECT_ROOT/.venv"

if [ ! -d "$VENV_DIR" ]; then
  python -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements.txt"

cd "$PROJECT_ROOT"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
