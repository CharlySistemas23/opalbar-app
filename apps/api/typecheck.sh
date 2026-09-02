#!/bin/sh
# Real type errors only (strict-mode noise like TS2564/TS6133/TS1272 is filtered;
# the webpack build does not use those checks). Run from apps/api.
cd "$(dirname "$0")"
node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 \
  | grep "error TS" \
  | grep -v "__tests__\|\.spec\.ts" \
  | grep -v "TS2564\|TS6133\|TS6138\|TS1272\|TS7006\|TS4114"
