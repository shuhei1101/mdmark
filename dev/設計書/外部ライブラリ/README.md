# 外部ライブラリ

採用済みの外部ライブラリ / 外部ツールのリファレンス

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [esbuild](./esbuild.yaml) | TS と CSS を配布物の ES モジュールの JS と CSS にまとめる |
| [esbuild-wasm](./esbuild-wasm.yaml) | VS Code 拡張機能が拡張機能ホストの中で設定の extensions をまとめる |
| [vitest](./vitest.yaml) | 単体テスト（Node）と結合テスト（実ブラウザ）のランナー |
| [playwright](./playwright.yaml) | E2E のブラウザ操作と、結合テストのブラウザの起動 |
| [biome](./biome.yaml) | lint と整形の検査 |
| [typescript](./typescript.yaml) | 型の検査 |
| [markdown-it](./markdown-it.yaml) | GitHub Flavored Markdown をトークンに解析し、HTML 文字列にする |
| [sanitize-html](./sanitize-html.yaml) | 描く前の HTML からスクリプトと許可していない要素・属性を落とす |
| [Storybook](./Storybook.yaml) | UI の部品を状態ごとのストーリーとして並べる（react-vite） |
| [valibot](./valibot.yaml) | テストで拡張の引数の Standard Schema を作る（配布物にまとめない） |
| [yaml](./yaml.yaml) | CLI が設定と索引の YAML を読み込む（配布物にまとめない） |
| [lucide](./lucide.yaml) | 図と記法のアイコンの形状 |
| [diff](./diff.yaml) | 2 つのリビジョンの Markdown を行と単語で比べる（jsdiff） |
| [vscode](./vscode.yaml) | VS Code の拡張機能の API（コマンド・設定・エディタ・Webview） |
| [vsce](./vsce.yaml) | VS Code の拡張機能を .vsix にまとめる |
| [test-electron](./test-electron.yaml) | VS Code を取得して起動し、拡張機能ホストの中で結合テストを走らせる |
| [mocha](./mocha.yaml) | 拡張機能ホストの中で結合テストを走らせるテストフレームワーク |
| [MCP-SDK](./MCP-SDK.yaml) | Claude Code のプラグインの MCP サーバーとテストのクライアント |
| [ClaudeCode](./ClaudeCode.yaml) | プラグインの導入・PreToolUse のフック・プラグインの MCP サーバーの起動 |
| [eslint](./eslint.yaml) | まとめた JS を構文木にして規則を適用する（対応ブラウザの下限の確認と、Webview の React の規則） |
| [eslint-plugin-compat](./eslint-plugin-compat.yaml) | 対応ブラウザの下限のバージョンに無い API の使用を報告する |
| [highlight.js](./highlight.js.yaml) | コードブロックを言語に応じて色分けする（配布物にまとめず jsDelivr から読み込む） |
| [mermaid](./mermaid.yaml) | 言語 mermaid のコードブロックを図にする（配布物にまとめず jsDelivr から読み込む） |
| [babel-standalone](./babel-standalone.yaml) | 範囲の TypeScript の型を削除して JavaScript にする（配布物にまとめず jsDelivr から読み込む） |
| [ajv](./ajv.yaml) | CLI が設定の aliases を取り込んだ JSON Schema で検証する（配布物にまとめない） |
| [dev-docs](./dev-docs.yaml) | 配信元の文書を MCP で検索・参照する（Claude Code がガイドを参照する先） |
| [react](./react.yaml) | VS Code の Webview の画面と hook（React Compiler を含む） |
| [vite](./vite.yaml) | VS Code の Webview を 1 つの JS と CSS にまとめる |
| [tailwindcss](./tailwindcss.yaml) | Webview の部品の class とトークン（Preflight を読み込まない） |
| [shadcn-ui](./shadcn-ui.yaml) | Webview の部品のソース（Button・Alert・Spinner） |
| [msw](./msw.yaml) | ストーリーと単体テストの配布物の HEAD のモック |
| [axe-core](./axe-core.yaml) | テストのときだけパネルをアクセシビリティの規則で検査する |
| [react-error-boundary](./react-error-boundary.yaml) | Webview の画面の最上位の Error Boundary |
| [testing-library](./testing-library.yaml) | Webview のコンポーネントと hook の単体テスト |
| [tmux](./tmux.yaml) | global-setup が常駐サーバーを動かすセッションの確認・起動・閉じる操作 |
| [systemd](./systemd.yaml) | global-setup が常駐サーバーを動かす user の unit の起動・停止・状態の確認と journal |

<!-- /table -->
