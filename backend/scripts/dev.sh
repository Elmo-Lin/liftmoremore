#!/usr/bin/env bash
# Local development: Firestore emulator (data kept in ./data/firestore) + backend on :8080.
# Requires: firebase-tools and a Java 21+ runtime for the emulator.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/firestore
exec firebase emulators:exec --only firestore --project demo-coachlog \
  --import=./data/firestore --export-on-exit=./data/firestore \
  "./mvnw spring-boot:run"
