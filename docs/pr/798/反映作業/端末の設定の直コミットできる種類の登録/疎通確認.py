"""端末の設定のファイル・端末の設定の API・配信元 mdmark の設定に、読み取りだけでつながるかを確認する。"""

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402


def main() -> int:
    """対象ごとに 1 行の結果を出し、`failed` があれば 1 を返却する。"""
    failed = False
    # 端末の設定のファイルと、その中の配信元 mdmark の行
    if not common.SETTINGS.is_file():
        print("端末の設定のファイル: failed")
        print(f"{common.SETTINGS} がありません", file=sys.stderr)
        failed = True
    else:
        row = common.target_row(common.load_yaml(common.SETTINGS))
        if row is None:
            print("端末の設定のファイル: failed")
            print(f"{common.TARGET} の行がありません", file=sys.stderr)
            failed = True
        else:
            print("端末の設定のファイル: ok")
            # 配信元の設定（マージの後に direct_commit が入る）
            configs = row["config"] if isinstance(row["config"], list) else [row["config"]]
            missing = [c for c in configs if not Path(c).is_file()]
            print("配信元の設定: " + ("failed" if missing else "ok"))
            if missing:
                print(f"{missing} がありません", file=sys.stderr)
                failed = True
    # 端末の設定の API と、配信元 mdmark の行
    try:
        status, body = common.request("GET", "/settings/sources")
        ok = status == 200 and common.api_row(body) is not None
        print("端末の設定の API: " + ("ok" if ok else "failed"))
        if not ok:
            print(f"GET /settings/sources: {status}", file=sys.stderr)
            failed = True
    except RuntimeError as error:
        print("端末の設定の API: failed")
        print(error, file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
