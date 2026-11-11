#!/usr/bin/env python3
"""配信元の登録が触る端末の設定と dev-docs の管理の MCP に、読み取りだけでつながるかを確かめる。"""
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_client import ADMIN_MCP, SETTINGS, call_tool  # noqa: E402


def main() -> int:
    """対象ごとに結果の行を出す。"""
    failed = False
    try:
        yaml.safe_load(SETTINGS.read_text(encoding="utf-8"))
        print("端末の設定の読み取り: ok")
    except (OSError, yaml.YAMLError):
        print("端末の設定の読み取り: failed")
        failed = True
    try:
        result = call_tool(ADMIN_MCP, "status", {})
        # isError は管理の MCP がツールの失敗を返したとき
        ok = not result.get("isError")
        print("dev-docs の管理の MCP: " + ("ok" if ok else "failed"))
        failed = failed or not ok
    except OSError:
        print("dev-docs の管理の MCP: failed")
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
