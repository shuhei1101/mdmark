"""develop の worktree の project-index.yaml の nav を、配信元 mdmark の配信へ入れる。"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DEVELOP_WORKTREE, call_admin, file_tab_titles, served_tab_titles  # noqa: E402

args = sys.argv[1:]
dry_run = args == ["--dry-run"]

# 前提確認
if args not in ([], ["--dry-run"]):
    print("前提確認: failed")
    print(f"受け付けない引数: {args}", file=sys.stderr)
    sys.exit(1)
subprocess.run(["git", "-C", str(DEVELOP_WORKTREE), "fetch", "origin", "--quiet"], check=True)
behind = subprocess.run(
    ["git", "-C", str(DEVELOP_WORKTREE), "rev-list", "--count", "HEAD..origin/develop"],
    check=True, capture_output=True, text=True,
).stdout.strip()
expected = file_tab_titles()
print("前提確認: ok")

# 計画
if behind == "0":
    print("develop の worktree の最新化: skipped")
elif dry_run:
    print(f"develop の worktree の最新化: changed（{behind} commit 遅れ）")
served = served_tab_titles()
print(f"配信中のタブ: {len(served)} 件 {served}")
if behind == "0" and served == expected and expected:
    print("配信元の再読み込み: skipped")
    sys.exit(0)
if dry_run:
    print("配信元の再読み込み: changed")
    sys.exit(0)

# 適用
if behind != "0":
    result = subprocess.run(
        ["git", "-C", str(DEVELOP_WORKTREE), "merge", "--ff-only", "origin/develop"], capture_output=True, text=True
    )
    if result.returncode != 0:
        print("develop の worktree の最新化: failed")
        print(f"git merge --ff-only origin/develop: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    print("develop の worktree の最新化: changed")
    expected = file_tab_titles()
if not expected:
    print("nav の有無: failed")
    print("develop の worktree の project-index.yaml に nav がありません", file=sys.stderr)
    sys.exit(1)
check = json.loads(call_admin("check_project", {"path": str(DEVELOP_WORKTREE), "storage_type": "disk", "format": "json"}))
if check.get("violations"):
    print("check_project: failed")
    print(json.dumps(check["violations"], ensure_ascii=False), file=sys.stderr)
    sys.exit(1)
print("check_project: ok")
call_admin("reload", {"format": "json"})
print("配信元の再読み込み: changed")
