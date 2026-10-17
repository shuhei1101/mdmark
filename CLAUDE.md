# mdmark

Markdown 文書の表示（拡張記法・図・差分・部品）を各アプリで共通に使うライブラリ

## ドキュメント

実体は開発ドキュメント [dev/](./dev/) と公開ドキュメント [docs/](./docs/) にある。
使い方は [使い方](./docs/使い方/)。

着手前に索引を引いて読む。

```bash
PROJECT_ROOT="$PWD" PYTHONPATH="$AI_MONITOR_HOME/src" python3 -m ai_monitor.inject.build_docs_index
```

## 設定・索引の Schema

`schemas/` の設定・索引の JSON Schema を変えるときは、`migrations/next/` に移行の手順か、`migrations/no-steps.yaml` に行を置く（[移行の手順](./dev/設計書/ER図/移行の手順.yaml)）。
