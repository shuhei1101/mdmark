"""配信元の登録のスクリプトが共通で使う、dev-docs の MCP を HTTP で 1 回呼ぶ処理。"""
import json
import urllib.request
from pathlib import Path

SETTINGS = Path("/home/shuhei2441/.config/dev-docs/settings.yaml")
SOURCE_CONFIG = "/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/develop/dev-docs.yaml"
SOURCE_ID = "mdmark"
ADMIN_MCP = "http://127.0.0.1:8781/_admin/mcp"
DOCS_MCP = "http://127.0.0.1:8781/mcp"
CWD = "/mnt/c/Users/shuhe/repo/mdmark"
TIMEOUT_SEC = 120


def _extract(body: str, request_id: int) -> dict | None:
    """SSE の data 行か JSON の本文から、指定した id の応答を取り出す。"""
    messages = [json.loads(line[5:]) for line in body.splitlines() if line.startswith("data:")]
    if not messages and body.strip().startswith("{"):
        messages = [json.loads(body)]
    for msg in messages:
        if msg.get("id") == request_id:
            return msg
    return None


def call_tool(url: str, name: str, arguments: dict) -> dict:
    """MCP のツールを 1 回呼び、tools/call の result を返す。"""
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    payloads = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize",
         "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                    "clientInfo": {"name": "pr254", "version": "1"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": name, "arguments": arguments}},
    ]
    session_id = None
    response = None
    for payload in payloads:
        # サーバーがセッションを返したときだけ、以降の要求に付ける
        if session_id:
            headers["mcp-session-id"] = session_id
        req = urllib.request.Request(url, json.dumps(payload).encode(), headers)
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as res:
            session_id = res.headers.get("mcp-session-id") or session_id
            body = res.read().decode()
        if payload.get("id") == 2:
            response = _extract(body, 2)
    if response is None or "result" not in response:
        raise OSError(f"{name} の応答がありません: {response}")
    return response["result"]


def result_text(result: dict) -> str:
    """tools/call の result から本文の文字列をつなげて返す。"""
    return "\n".join(c.get("text", "") for c in result.get("content", []))
