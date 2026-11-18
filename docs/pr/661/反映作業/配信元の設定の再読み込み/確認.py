"""配信元 mdmark の配信中の nav のタブが、develop の worktree の project-index.yaml と一致するかを読むだけで確かめる。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import file_tab_titles, served_tab_titles  # noqa: E402

served = served_tab_titles()
expected = file_tab_titles()
print(f"配信中のタブ: {served}")
if served == expected and len(served) == 6:
    print("nav のタブ: ok")
    sys.exit(0)
print("nav のタブ: failed")
print(f"期待したタブ: {expected}", file=sys.stderr)
sys.exit(1)
