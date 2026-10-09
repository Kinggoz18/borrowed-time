#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm test
npm run test:gates
npm run build
npx playwright test
