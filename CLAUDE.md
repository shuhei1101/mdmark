# mdmark

Markdown 文書の表示（拡張記法・図・差分・部品）を各アプリで共通に使用するライブラリ

## ドキュメント

実体は開発ドキュメント [dev/](./dev/) と公開ドキュメント [docs/](./docs/) にある。
使用方法は [使用方法](./docs/使用方法/)。

着手前に索引を参照して読み込む。

```bash
PROJECT_ROOT="$PWD" PYTHONPATH="$AI_MONITOR_HOME/src" python3 -m ai_monitor.inject.build_docs_index
```

## VS Code 拡張機能の Webview

- `vscode/src/webview/` は React（Vite・shadcn/ui・Tailwind）で記載し、knowledge の React の規約（`docs/rule/react-*`・`ui-*`）に従う
  - それ以外の `src/`・`vscode/src/` は React にしない

## 設定・索引の Schema

`schemas/` の設定・索引の JSON Schema を変えるときは、`migrations/next/` に移行の手順か、`migrations/no-steps.yaml` に行を配置する（[移行の手順](./dev/設計書/ER図/移行の手順.yaml)）。
