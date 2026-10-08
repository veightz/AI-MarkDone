#!/usr/bin/env bash
# Build a Chrome Web Store Unlisted upload zip: no manifest.key, no update_url.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../releases/AI-MarkDone-veightz-chrome-store-unlisted.zip}"
STAGE="${TMPDIR:-/tmp}/aimd-store-unlisted-$$"
cd "$ROOT"
npm run build:chrome
python3 - "$ROOT/dist-chrome" "$STAGE" <<'PY'
import json, shutil, sys
from pathlib import Path
src, stage = Path(sys.argv[1]), Path(sys.argv[2])
if stage.exists():
    shutil.rmtree(stage)
shutil.copytree(src, stage, ignore=shutil.ignore_patterns('.DS_Store'))
mf_path = stage / 'manifest.json'
mf = json.loads(mf_path.read_text())
if 'update_url' in mf:
    raise SystemExit('refusing to package: update_url present')
mf.pop('key', None)
mf_path.write_text(json.dumps(mf, indent=4, ensure_ascii=False) + '\n')
print('staged', stage, 'without key; update_url absent')
PY
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
(cd "$STAGE" && zip -r -q "$OUT" . -x '*.DS_Store')
rm -rf "$STAGE"
python3 - "$OUT" <<'PY'
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    m = json.loads(z.read('manifest.json'))
assert 'key' not in m and 'update_url' not in m
print('OK', sys.argv[1], 'version', m.get('version'))
PY
