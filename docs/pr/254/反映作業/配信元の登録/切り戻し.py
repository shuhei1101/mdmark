#!/usr/bin/env python3
"""実行が退避した端末の設定を書き戻し、dev-docs に設定を読み直させる。"""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_client import ADMIN_MCP, SETTINGS, call_tool, result_text  # noqa: E402

BACKUP = SETTINGS.with_name("settings.yaml.pr254.bak")


def main() -> int:
    """退避したファイルから戻し、読み直す。"""
    if not BACKUP.is_file():
        print("退避したファイル: failed")
        return 1
    shutil.copy2(BACKUP, SETTINGS)
    print("端末の設定の書き戻し: changed")
    result = call_tool(ADMIN_MCP, "reload", {})
    if result.get("isError"):
        print(result_text(result))
        print("設定の読み直し: failed")
        return 1
    print("設定の読み直し: changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
