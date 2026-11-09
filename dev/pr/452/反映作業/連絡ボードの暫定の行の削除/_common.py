"""連絡ボードの暫定の行の削除の 3 本のスクリプトが共通で使う固定値と読み取り。"""

import sqlite3
import subprocess
from pathlib import Path

REPO = "shuhei1101/mdmark"
ISSUE = 373
PROJECT = "mdmark"
SECTION = "共通"
TITLE = "結合テストの全件は maxWorkers=4 で流す"
LABEL = "確認:task-planner"
# 連絡ボードを持つ AI Monitor の計画データストア
PLAN_DB = Path("/mnt/c/Users/shuhe/repo/ai-monitor/data/plan.db")
# 依頼のコメントを見分ける本文の見出しの行
REQUEST_HEADING = "## 連絡ボードの暫定の行の削除の依頼"


def row_remains() -> bool:
    """削除していない暫定の行が残っているかを読み取りだけで返す。"""
    conn = sqlite3.connect(f"file:{PLAN_DB}?mode=ro", uri=True)
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM notice_row"
            " WHERE project = ? AND section = ? AND title = ? AND deleted_at IS NULL",
            (PROJECT, SECTION, TITLE),
        ).fetchone()[0]
    finally:
        conn.close()
    return count > 0


def request_posted() -> bool:
    """起点 Issue に依頼のコメントを投稿済みかを返す。"""
    bodies = subprocess.run(
        ["gh", "issue", "view", str(ISSUE), "-R", REPO, "--json", "comments", "-q", ".comments[].body"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return REQUEST_HEADING in bodies
