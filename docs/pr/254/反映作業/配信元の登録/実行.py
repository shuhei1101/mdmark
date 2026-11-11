#!/usr/bin/env python3
"""端末の設定の sources[] に mdmark の配信元の行を追加し、dev-docs に設定を読み直させる。"""
import difflib
import os
import shutil
import sys
import tempfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_client import ADMIN_MCP, SETTINGS, SOURCE_CONFIG, SOURCE_ID, call_tool, result_text  # noqa: E402

BACKUP = SETTINGS.with_name("settings.yaml.pr254.bak")
ENTRY = {
    "id": SOURCE_ID,
    "config": SOURCE_CONFIG,
    "scope": {
        "write": ["/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/**"],
        "read": ["/mnt/c/Users/shuhe/repo/mdmark/**"],
    },
}
ENTRY_TEXT = (
    f"  - id: {SOURCE_ID}\n"
    f"    config: {SOURCE_CONFIG}\n"
    "    scope:\n"
    '      write: ["/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/**"]\n'
    '      read: ["/mnt/c/Users/shuhe/repo/mdmark/**"]\n'
)


def main() -> int:
    """前提確認 → 計画 → 適用の順に進める。"""
    dry_run = len(sys.argv) > 1 and sys.argv[1] == "--dry-run"

    # 前提確認: 端末の設定が読め、develop の worktree に dev-docs.yaml がある
    try:
        current_text = SETTINGS.read_text(encoding="utf-8")
        current = yaml.safe_load(current_text)
    except (OSError, yaml.YAMLError):
        print("前提確認（端末の設定）: failed")
        return 1
    if not Path(SOURCE_CONFIG).is_file():
        print("前提確認（develop の dev-docs.yaml）: failed")
        return 1
    print("前提確認: ok")

    # 計画: 同じ config か同じ id の行が既にあれば何もしない
    sources = current.get("sources") or []
    if any(s.get("config") == SOURCE_CONFIG or s.get("id") == SOURCE_ID for s in sources):
        print("配信元の行の追加: skipped")
        return 0
    new_text = current_text if current_text.endswith("\n") else current_text + "\n"
    new_text += ENTRY_TEXT
    sys.stdout.writelines(difflib.unified_diff(
        current_text.splitlines(keepends=True), new_text.splitlines(keepends=True),
        fromfile=str(SETTINGS), tofile=str(SETTINGS)))
    if dry_run:
        print("配信元の行の追加: changed")
        print("設定の読み直し: changed")
        return 0

    # 適用: 一時ファイルに書く → 検証 → 退避 → 置き換え
    fd, tmp = tempfile.mkstemp(dir=SETTINGS.parent, prefix="settings.", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(new_text)
    parsed = yaml.safe_load(Path(tmp).read_text(encoding="utf-8"))
    # 追記した行が sources[] の末尾に入り、既存の行が変わっていないか
    if parsed.get("sources", [])[:-1] != sources or parsed["sources"][-1] != ENTRY:
        os.remove(tmp)
        print("検証: failed")
        return 1
    print("検証: ok")
    shutil.copy2(SETTINGS, BACKUP)
    os.replace(tmp, SETTINGS)
    print("配信元の行の追加: changed")

    result = call_tool(ADMIN_MCP, "reload", {})
    if result.get("isError"):
        print(result_text(result))
        print("設定の読み直し: failed")
        return 1
    print("設定の読み直し: changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
