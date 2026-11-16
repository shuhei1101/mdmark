"""alias-inject の端末の設定の mdmark の行の config を、develop の worktree の project-index.yaml へ書き換える。"""

import difflib
import os
import shutil
import sys
import tempfile
from datetime import datetime

TARGET = os.path.expanduser("~/.config/alias-inject/settings.yaml")
OLD = "/home/shuhei2441/repo/mdmark/.claude/worktrees/develop/dev-docs.yaml"
NEW = "/home/shuhei2441/repo/mdmark/.claude/worktrees/develop/project-index.yaml"

# 前提確認
args = sys.argv[1:]
if args not in ([], ["--dry-run"]):
    print("前提確認: failed")
    print(f"受け付けない引数: {args}")
    sys.exit(1)
dry_run = args == ["--dry-run"]
if not os.path.isfile(TARGET):
    print("前提確認: failed")
    print(f"端末の設定が無い: {TARGET}")
    sys.exit(1)
if not dry_run and not os.path.isfile(NEW):
    print("前提確認: failed")
    print(f"develop の worktree に project-index.yaml が無い（作業 PR のマージと worktree の更新の後に実行する）: {NEW}")
    sys.exit(1)
print("前提確認: ok")

# 計画（--dry-run もここを通る）
with open(TARGET, encoding="utf-8") as f:
    before = f.read()
count = before.count(OLD)
if count == 0 and NEW in before:
    print("config の書き換え: skipped")
    sys.exit(0)
if count != 1:
    print("config の書き換え: failed")
    print(f"書き換える行の数が 1 でない: {count}")
    sys.exit(1)
after = before.replace(OLD, NEW)
sys.stdout.writelines(difflib.unified_diff(before.splitlines(True), after.splitlines(True), TARGET, TARGET))
if dry_run:
    print("config の書き換え: changed")
    sys.exit(0)

# 適用（検証 → 退避 → 置き換え）
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(TARGET))
with os.fdopen(fd, "w", encoding="utf-8") as f:
    f.write(after)
with open(tmp, encoding="utf-8") as f:
    written = f.read()
if OLD in written or written.count(NEW) != 1:
    os.unlink(tmp)
    print("検証: failed")
    sys.exit(1)
print("検証: ok")
shutil.copy2(TARGET, f"{TARGET}.bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
shutil.copymode(TARGET, tmp)
os.replace(tmp, TARGET)
print("config の書き換え: changed")
