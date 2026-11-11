"""連絡ボードの暫定の行が削除されていることを、読み取りだけで確かめる。"""

import sys

from _common import PROJECT, SECTION, TITLE, row_remains

# 行が残っているか
if row_remains():
    print(f"{PROJECT} の {SECTION} の行「{TITLE}」: failed（残っている）")
    sys.exit(1)
print(f"{PROJECT} の {SECTION} の行「{TITLE}」: ok（無い）")
