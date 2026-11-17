"""配布先が dev-docs の配信元として登録され、共通設定に撤去した設計書のツールが残っていないことを確かめる。

配信元の dev-docs.yaml と端末の設定への登録は、`/dev-docs:setup {配布先のパス}` が判断を伴って作るため、無ければ failed で止める。
mdmark では配信元の定義を project-index.yaml に改名し、project-index の端末の設定に登録しているため、両方の名前と設定を受け付ける。
"""

import subprocess
import sys
from pathlib import Path

import yaml

SETTINGS = (Path.home() / ".config/project-index/settings.yaml", Path.home() / ".config/dev-docs/settings.yaml")
CONFIG_NAMES = ("project-index.yaml", "dev-docs.yaml")
AI_MONITOR_SETTINGS = Path.home() / ".config/ai-monitor/settings.yaml"
REMOVED_TOOLS = (
    "search_design_docs",
    "read_design_doc",
    "check_design_doc_refs",
    "diff_design_docs",
    "get_generated_design_docs",
    "list_design_doc_tags",
    "replace_in_design_docs",
    "write_design_doc",
)


def main() -> int:
    # 前提確認
    if len(sys.argv) < 2:
        print("前提確認: failed（対象のリポジトリの場所が無い）")
        return 1
    try:
        top = subprocess.run(
            ["git", "-C", sys.argv[1], "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        print("前提確認: failed（リポジトリでない）")
        return 1
    repo = Path(top)
    print("前提確認: ok")

    # 計画（--dry-run もここを通る。このスクリプトは書き換えないため適用は無い）
    status = 0
    found = [name for name in CONFIG_NAMES if (repo / name).is_file()]
    if found:
        print(f"{found[0]}: ok")
    else:
        print(f"dev-docs.yaml: failed（/dev-docs:setup {repo} で作る）")
        status = 1
    root = repo.parent.parent.parent if repo.parent.name == "worktrees" else repo
    configs = []
    for settings in SETTINGS:
        if not settings.is_file():
            continue
        for source in yaml.safe_load(settings.read_text(encoding="utf-8")).get("sources") or []:
            values = source.get("config") or []
            configs += [Path(value) for value in ([values] if isinstance(values, str) else values)]
    if any(config.is_relative_to(root) and config.name in CONFIG_NAMES for config in configs):
        print("配信元の登録: ok")
    else:
        print(f"配信元の登録: failed（/dev-docs:setup {repo} で登録する）")
        status = 1
    settings_text = AI_MONITOR_SETTINGS.read_text(encoding="utf-8")
    left = [name for name in REMOVED_TOOLS if name in settings_text]
    if left:
        print("共通設定の撤去した設計書のツール: failed（agents[].mcp_tools から外す: " + ", ".join(left) + "）")
        status = 1
    else:
        print("共通設定の撤去した設計書のツール: ok")
    return status


if __name__ == "__main__":
    sys.exit(main())
