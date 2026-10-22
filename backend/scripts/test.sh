#!/usr/bin/env bash
# Runs the backend test suite against a throwaway Firestore emulator.
# Requires: firebase-tools and a Java 21+ runtime for the emulator.
set -euo pipefail
cd "$(dirname "$0")/.."
exec firebase emulators:exec --only firestore --project demo-coachlog-test "./mvnw -B test"
