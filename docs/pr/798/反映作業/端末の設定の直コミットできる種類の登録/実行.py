"""配信元 mdmark の行に、書き込みの API から直コミットできる種類を登録する。

端末の設定の API の 1 行の変更（PATCH）で `write_api_kinds` を送信し、配信元を再読み込みさせる。
送信の前の値は、切り戻しのために端末の設定と同じフォルダへ JSON で記録する。
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402


def fail(step: str, detail: str) -> int:
    """失敗の行と詳細を出して 1 を返却する。"""
    print(f"{step}: failed")
    print(detail, file=sys.stderr)
    return 1


def main(argv: list[str]) -> int:
    """前提確認 → 計画 → 適用の順に進める。"""
    # 前提確認: 引数は無しか --dry-run だけ
    if len(argv) > 1 or (len(argv) == 1 and argv[0] != "--dry-run"):
        return fail("前提確認", f"受け付けない引数です: {argv}")
    dry_run = argv == ["--dry-run"]
    if not common.SETTINGS.is_file():
        return fail("前提確認", f"{common.SETTINGS} がありません")
    row = common.target_row(common.load_yaml(common.SETTINGS))
    if row is None:
        return fail("前提確認", f"端末の設定に {common.TARGET} の行がありません")
    kinds = common.allowed_kinds(row)
    # 配信元の設定に direct_commit が無い: 登録する種類を決められない（マージの前）
    if not kinds:
        return fail("前提確認", f"{common.TARGET} の配信元の設定に direct_commit.kinds がありません")
    try:
        status, body = common.request("GET", "/settings/sources")
    except RuntimeError as error:
        return fail("前提確認", str(error))
    if status != 200 or common.api_row(body) is None:
        return fail("前提確認", f"GET /settings/sources: {status} {body}")
    print("前提確認: ok")

    # 計画: 今の write_api_kinds と、送信する値
    current = common.write_api_kinds(common.api_row(body))
    if current == kinds:
        print("直コミットできる種類の登録: skipped")
        return 0
    print(f"{common.TARGET} の write_api_kinds: {current} -> {kinds}")
    if dry_run:
        print("直コミットできる種類の登録: changed")
        return 0

    # 適用: 今の値を記録 → 送信
    backup = common.SETTINGS.with_name(f"{common.BACKUP_PREFIX}{datetime.now():%Y%m%d-%H%M%S}.json")
    backup.write_text(json.dumps({"write_api_kinds": current}, ensure_ascii=False), encoding="utf-8")
    print(f"退避: changed（{backup}）")
    status, result = common.request(
        "PATCH",
        f"/settings/sources/{common.TARGET}",
        {"expectedVersion": body["version"], "source": {"direct_commit": {"write_api_kinds": kinds}}},
    )
    if status != 200:
        return fail("直コミットできる種類の登録", f"PATCH /settings/sources/{common.TARGET}: {status} {result}")
    print("直コミットできる種類の登録: changed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
