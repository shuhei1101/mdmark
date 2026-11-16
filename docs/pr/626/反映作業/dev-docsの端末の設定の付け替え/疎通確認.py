"""dev-docs の端末の設定と、develop の worktree の配信元の設定を読み取りだけで確かめる。"""

import os
import sys

TARGET = os.path.expanduser("~/.config/dev-docs/settings.yaml")
NEW_CONFIG = "/home/shuhei2441/repo/mdmark/.claude/worktrees/develop/project-index.yaml"

ok = True
if os.path.isfile(TARGET):
    print("dev-docs の端末の設定: ok")
else:
    print("dev-docs の端末の設定: failed")
    ok = False
if os.path.isfile(NEW_CONFIG):
    print("develop の project-index.yaml: ok")
else:
    print("develop の project-index.yaml: missing")
sys.exit(0 if ok else 1)
