"""project-index・dev-docs・develop の worktree に読み取りだけでつながるかを確かめる。"""

import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CONFIG_FILE, DEV_DOCS_URL, SOURCE_CONFIG_URL  # noqa: E402

failed = False
for name, url in [("project-index の配信元 mdmark", SOURCE_CONFIG_URL), ("dev-docs の画面", DEV_DOCS_URL)]:
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            print(f"{name}: ok" if response.status == 200 else f"{name}: failed")
            failed |= response.status != 200
    except Exception as error:  # noqa: BLE001
        print(f"{name}: failed")
        print(f"GET {url}: {error}", file=sys.stderr)
        failed = True
if CONFIG_FILE.is_file():
    print("develop の worktree の project-index.yaml: ok")
else:
    print("develop の worktree の project-index.yaml: failed")
    print(f"ファイルが無い: {CONFIG_FILE}", file=sys.stderr)
    failed = True
sys.exit(1 if failed else 0)
