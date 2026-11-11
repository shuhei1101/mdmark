"""起点 Issue へ task-planner 宛の削除の依頼を投稿し、確認ラベルを付ける（連絡ボードの行は task-planner が削除する）。"""

import subprocess
import sys

from _common import ISSUE, LABEL, PROJECT, REPO, REQUEST_HEADING, SECTION, TITLE, request_posted, row_remains

# 前提確認
args = sys.argv[1:]
if args not in ([], ["--dry-run"]):
    print("前提確認: failed")
    sys.exit(1)
dry_run = args == ["--dry-run"]
print("前提確認: ok")

# 計画（--dry-run もここを通る）
# 行が既に無いか、依頼を投稿済みなら何もしない
if not row_remains() or request_posted():
    print("削除の依頼: skipped")
    sys.exit(0)
body = (
    "> from: @planner\n> to: @task-planner\n\n"
    f"{REQUEST_HEADING}\n\n"
    f"#452 で結合テストの並列の上限を vitest.config.ts に入れたため、{PROJECT} の連絡ボードの節 `{SECTION}` の行"
    f"「{TITLE}」を削除してください。\n"
)
print(f"投稿先: https://github.com/{REPO}/issues/{ISSUE}")
print(body)
print(f"付けるラベル: {LABEL}")
if dry_run:
    print("削除の依頼: changed")
    sys.exit(0)

# 適用
subprocess.run(["gh", "issue", "comment", str(ISSUE), "-R", REPO, "--body", body], check=True)
subprocess.run(["gh", "issue", "edit", str(ISSUE), "-R", REPO, "--add-label", LABEL], check=True)
print("削除の依頼: changed")
