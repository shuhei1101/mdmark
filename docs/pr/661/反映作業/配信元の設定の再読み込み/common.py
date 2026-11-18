"""反映作業『配信元の設定の再読み込み』のスクリプトが共通で使う値と関数。"""

import json
import urllib.request
from pathlib import Path

import yaml

ADMIN_MCP = "http://127.0.0.1:8786/_admin/mcp"
SOURCE_CONFIG_URL = "http://127.0.0.1:8786/sources/mdmark/config"
DEV_DOCS_URL = "http://127.0.0.1:8781/"
DEVELOP_WORKTREE = Path("/home/shuhei2441/repo/mdmark/.claude/worktrees/develop")
CONFIG_FILE = DEVELOP_WORKTREE / "project-index.yaml"


def call_admin(tool: str, arguments: dict) -> str:
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": arguments}}
    ).encode()
    request = urllib.request.Request(
        ADMIN_MCP,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.load(response)
    if "error" in result:
        raise RuntimeError(json.dumps(result["error"], ensure_ascii=False))
    if result["result"].get("isError"):
        raise RuntimeError(result["result"]["content"][0]["text"])
    return result["result"]["content"][0]["text"]


def served_tab_titles() -> list[str]:
    with urllib.request.urlopen(SOURCE_CONFIG_URL, timeout=30) as response:
        config = json.load(response)
    return [tab["title"] for tab in (config.get("nav") or {}).get("tabs", [])]


def file_tab_titles() -> list[str]:
    config = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
    return [tab["title"] for tab in (config.get("nav") or {}).get("tabs", [])]
