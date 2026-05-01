#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed."
  echo "Install it first, then run this script again."
  exit 1
fi

echo "Installing project dependencies if needed..."
uv sync

echo "Starting CampusCloud app..."
echo "Open http://127.0.0.1:8000/ui"

uv run uvicorn campuscloud_dp.main:app --reload
