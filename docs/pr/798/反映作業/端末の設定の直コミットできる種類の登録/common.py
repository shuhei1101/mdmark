"""端末の設定の直コミットできる種類の登録で、各スクリプトが共有する値と処理。"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True

# project-index の端末の設定のファイル
SETTINGS = Path.home() / ".config/project-index/settings.yaml"
# 実行の前の write_api_kinds を記録するファイル（端末の設定と同じフォルダ。切り戻しが最新を読む）
BACKUP_PREFIX = "mdmark-write_api_kinds.bak-"
# project-index の端末の設定の API
API = "http://127.0.0.1:8786"
# 直コミットできる種類を登録する配信元
TARGET = "mdmark"
# 一時的な通信エラー（再読み込みの間の接続の失敗・5xx）の再試行の回数と間隔
RETRIES = 3
RETRY_INTERVAL_SEC = 2
# 端末の設定の API の 1 回の要求の上限（project-index の再読み込みを待つ）
REQUEST_TIMEOUT_SEC = 60


def load_yaml(path: Path) -> object:
    """YAML のファイルを読み込む。"""
    import yaml

    return yaml.safe_load(path.read_text(encoding="utf-8"))


def request(method: str, path: str, body: object | None = None) -> tuple[int, object]:
    """端末の設定の API を呼び、状態コードと JSON の本文を返却する。

    書き換え（PATCH）は、適用された後に応答だけが失われると再試行が 409 になり
    適用済みかを判定できないため、再試行せず 1 回だけ送信する。
    """
    data = None if body is None else json.dumps(body).encode()
    last: Exception | None = None
    attempts = RETRIES if method == "GET" else 1
    for _ in range(attempts):
        req = urllib.request.Request(
            API + path, data=data, method=method, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as res:
                return res.status, json.loads(res.read() or b"null")
        except urllib.error.HTTPError as error:
            # 4xx: 再試行せずに状態コードを返却する
            if error.code < 500:
                return error.code, json.loads(error.read() or b"null")
            last = error
        except (urllib.error.URLError, TimeoutError) as error:
            last = error
        time.sleep(RETRY_INTERVAL_SEC)
    raise RuntimeError(f"{method} {path}: {last}")


def target_row(settings: dict) -> dict | None:
    """端末の設定の `sources[]` から配信元 mdmark の行を返却する。"""
    for row in settings.get("sources", []):
        if row.get("id") == TARGET:
            return row
    return None


def allowed_kinds(row: dict) -> list[str] | None:
    """配信元の設定の `direct_commit.kinds` の種類の ID を返却する。`direct_commit` が無ければ `None`。"""
    configs = row["config"] if isinstance(row["config"], list) else [row["config"]]
    kinds: list[str] = []
    found = False
    for config in configs:
        direct = (load_yaml(Path(config)) or {}).get("direct_commit")
        if not direct:
            continue
        found = True
        for kind in direct.get("kinds", []):
            # 種類は文字列か `{id, body}` のどちらかで記載されている
            kind_id = kind["id"] if isinstance(kind, dict) else kind
            if kind_id not in kinds:
                kinds.append(kind_id)
    return kinds if found else None


def api_row(body: dict) -> dict | None:
    """`GET /settings/sources` の応答から配信元 mdmark の行を返却する。"""
    for row in body["sources"]:
        if row.get("id") == TARGET:
            return row
    return None


def write_api_kinds(row: dict) -> list[str] | None:
    """`GET /settings/sources` の行の `directCommit.writeApiKinds` を返却する。"""
    return (row.get("directCommit") or {}).get("writeApiKinds")
