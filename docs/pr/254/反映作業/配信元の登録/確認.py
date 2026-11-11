#!/usr/bin/env python3
"""mdmark の配信元が配信され、タグの一覧とタグで絞った文書が返ることを読むだけで確かめる。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_client import CWD, DOCS_MCP, SOURCE_ID, call_tool  # noqa: E402

NO_TAG = "（なし）"


def main() -> int:
    """describe・タグの集計・タグでの絞り込みを順に観測する。"""
    described = call_tool(DOCS_MCP, "describe", {"format": "json", "cwd": CWD})
    ids = [s["source_id"] for s in described.get("structuredContent", {}).get("sources", [])]
    if SOURCE_ID not in ids:
        print(f"describe の配信元: failed（{ids}）")
        return 1
    print(f"describe の配信元: ok（{SOURCE_ID}）")

    grouped = call_tool(DOCS_MCP, "search_docs", {
        "source": SOURCE_ID, "group_by": "tags", "format": "json", "limit": 1, "cwd": CWD})
    groups = [g for g in grouped.get("structuredContent", {}).get("groups", []) if g["value"] != NO_TAG]
    if not groups:
        print("タグの集計: failed（タグが 0 件）")
        return 1
    tag = groups[0]["value"]
    print(f"タグの集計: ok（{len(groups)} 種類、最多は {tag} の {groups[0]['count']} 件）")

    counted = call_tool(DOCS_MCP, "search_docs", {
        "source": SOURCE_ID, "filter": {"field": "tags", "op": "eq", "values": [tag]},
        "view": "count", "format": "json", "cwd": CWD})
    total = counted.get("structuredContent", {}).get("total_count", 0)
    if total == 0:
        print(f"タグでの絞り込み: failed（{tag} で 0 件）")
        return 1
    print(f"タグでの絞り込み: ok（{tag} で {total} 件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
