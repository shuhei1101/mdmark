"""実行で退避した agent_context.yaml と 3 つのエージェントの設定を、配布先のリポジトリへ戻す。"""

from __future__ import annotations

# 対象のリポジトリの場所が無ければ、作業ディレクトリ（叩いたブランチのリポジトリの直下）を対象にする
import os as _os, sys as _sys  # noqa: E401, E402
if not _sys.argv[1:] or _sys.argv[1].startswith("--"):
    _sys.argv.insert(1, _os.getcwd())


import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import follow


def main() -> int:
    """退避先にあるファイルだけを元の場所へ戻す。"""
    repo = Path(sys.argv[1])
    backup = follow.backup_dir(repo)
    restored = False
    for name in (follow.AGENT_CONTEXT, *follow.AGENT_SETTINGS):
        # 退避したファイルが無い: 実行で触らなかったファイル
        if not (backup / name).is_file():
            continue
        (repo / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backup / name, repo / name)
        print(f"{name} の書き戻し: changed")
        restored = True
    # 1 つも戻せない: 戻す元が無い
    if not restored:
        print("退避したファイル: failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
