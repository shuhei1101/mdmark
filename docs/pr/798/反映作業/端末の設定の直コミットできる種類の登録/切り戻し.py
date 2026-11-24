"""実行で記録した最新の write_api_kinds を、配信元 mdmark の行へ送信し直す。"""

import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402


def main() -> int:
    """記録した値を 1 行の変更で送信し、配信元を再読み込みさせる。"""
    backups = sorted(common.SETTINGS.parent.glob(f"{common.BACKUP_PREFIX}*.json"))
    # 記録が無い: 戻す元が無いので止める
    if not backups:
        print("記録した値: failed")
        print(f"{common.SETTINGS.parent} に {common.BACKUP_PREFIX}*.json がありません", file=sys.stderr)
        return 1
    backup = backups[-1]
    kinds = json.loads(backup.read_text(encoding="utf-8"))["write_api_kinds"] or []
    print(f"記録した値: ok（{backup}: {kinds}）")
    status, body = common.request("GET", "/settings/sources")
    if status != 200:
        print("直コミットできる種類の戻し: failed")
        print(f"GET /settings/sources: {status} {body}", file=sys.stderr)
        return 1
    status, result = common.request(
        "PATCH",
        f"/settings/sources/{common.TARGET}",
        {"expectedVersion": body["version"], "source": {"direct_commit": {"write_api_kinds": kinds}}},
    )
    if status != 200:
        print("直コミットできる種類の戻し: failed")
        print(f"PATCH /settings/sources/{common.TARGET}: {status} {result}", file=sys.stderr)
        return 1
    print("直コミットできる種類の戻し: changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
