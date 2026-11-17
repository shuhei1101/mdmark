"""第 1 引数の配布先のリポジトリと、その docs/rules.yaml を読めるかを確かめる。"""
from __future__ import annotations

# 対象のリポジトリの場所が無ければ、作業ディレクトリ（叩いたブランチのリポジトリの直下）を対象にする
import os as _os, sys as _sys  # noqa: E401, E402
if not _sys.argv[1:] or _sys.argv[1].startswith("--"):
    _sys.argv.insert(1, _os.getcwd())


import subprocess
import sys
from pathlib import Path


def main() -> int:
    """リポジトリであることと、索引の有無を読むだけで確かめる。"""
    if len(sys.argv) < 2 or not (Path(sys.argv[1]) / ".git").exists():
        print("配布先のリポジトリ: failed")
        return 1
    repo = Path(sys.argv[1])
    result = subprocess.run(["git", "-C", str(repo), "status", "--porcelain"], capture_output=True, text=True)
    print(f"配布先のリポジトリ: {'ok' if result.returncode == 0 else 'failed'}")
    old, new = repo / "docs" / "rules.yaml", repo / "rules.yaml"
    print(f"索引（docs/rules.yaml={old.is_file()} / rules.yaml={new.is_file()}）: ok")
    return 0 if result.returncode == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
