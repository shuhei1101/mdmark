"""project-index の端末の設定の mdmark の行が、develop の worktree の project-index.yaml を指すかを読むだけで確かめる。"""

import os
import sys

TARGET = os.path.expanduser("~/.config/project-index/settings.yaml")
OLD = "/home/shuhei2441/repo/mdmark/.claude/worktrees/develop/dev-docs.yaml"
NEW = "/home/shuhei2441/repo/mdmark/.claude/worktrees/develop/project-index.yaml"

with open(TARGET, encoding="utf-8") as f:
    text = f.read()
if NEW in text and OLD not in text and os.path.isfile(NEW):
    print(f"mdmark の config: ok（{NEW}）")
    sys.exit(0)
print(f"mdmark の config: failed（新しいパスの有無 {NEW in text}・古いパスの有無 {OLD in text}・ファイルの有無 {os.path.isfile(NEW)}）")
sys.exit(1)
