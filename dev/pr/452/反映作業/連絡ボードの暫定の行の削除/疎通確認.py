"""計画データストアの連絡ボードと GitHub の起点 Issue に、読み取りだけでつながるかを確かめる。"""

import sqlite3
import subprocess
import sys

from _common import ISSUE, PLAN_DB, REPO, row_remains

failed = False
# 連絡ボードの表を読めるか
try:
    row_remains()
    print(f"計画データストア（{PLAN_DB}）: ok")
except sqlite3.Error as error:
    print(f"計画データストア（{PLAN_DB}）: failed（{error}）")
    failed = True
# 起点 Issue を読めるか
result = subprocess.run(["gh", "issue", "view", str(ISSUE), "-R", REPO, "--json", "number"], capture_output=True)
print(f"GitHub の起点 Issue #{ISSUE}: {'ok' if result.returncode == 0 else 'failed'}")
failed = failed or result.returncode != 0
sys.exit(1 if failed else 0)
