# library

採用済みの外部ライブラリ / 外部ツールのリファレンス

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [esbuild](./LIB-472-10.yaml) | TS と CSS を配布物の ES モジュールの JS と CSS にまとめる |
| [esbuild-wasm](./LIB-472-11.yaml) | VS Code 拡張機能が拡張機能ホストの中で設定の extensions をまとめる |
| [vitest](./LIB-472-33.yaml) | 単体テスト（Node）と結合テスト（実ブラウザ）のランナー |
| [playwright](./LIB-472-20.yaml) | 結合テストのブラウザの起動と操作 |
| [biome](./LIB-472-7.yaml) | lint と整形の検査 |
| [typescript](./LIB-472-30.yaml) | 型の検査 |
| [markdown-it](./LIB-472-16.yaml) | GitHub Flavored Markdown をトークンに解析し、HTML 文字列にする |
| [sanitize-html](./LIB-472-23.yaml) | 描く前の HTML からスクリプトと許可していない要素・属性を落とす |
| [Storybook](./LIB-472-3.yaml) | UI の部品を状態ごとのストーリーとして並べる（react-vite） |
| [valibot](./LIB-472-31.yaml) | テストで拡張の引数の Standard Schema を作る（配布物にまとめない） |
| [yaml](./LIB-472-36.yaml) | CLI が設定と索引の YAML を読み込む（配布物にまとめない） |
| [lucide](./LIB-472-15.yaml) | 図と記法のアイコンの形状 |
| [diff](./LIB-472-9.yaml) | 2 つのリビジョンの Markdown を行と単語で比べる（jsdiff） |
| [vscode](./LIB-472-35.yaml) | VS Code の拡張機能の API（コマンド・設定・エディタ・Webview） |
| [vsce](./LIB-472-34.yaml) | VS Code の拡張機能を .vsix にまとめる |
| [test-electron](./LIB-472-27.yaml) | VS Code を取得して起動し、拡張機能ホストの中で結合テストを走らせる |
| [mocha](./LIB-472-18.yaml) | 拡張機能ホストの中で結合テストを走らせるテストフレームワーク |
| [MCP-SDK](./LIB-472-2.yaml) | Claude Code のプラグインの MCP サーバーとテストのクライアント |
| [ClaudeCode](./LIB-472-1.yaml) | プラグインの導入・PreToolUse のフック・プラグインの MCP サーバーの起動 |
| [eslint](./LIB-472-12.yaml) | まとめた JS を構文木にして規則を適用する（対応ブラウザの下限の確認と、Webview の React の規則） |
| [eslint-plugin-compat](./LIB-472-13.yaml) | 対応ブラウザの下限のバージョンに無い API の使用を報告する |
| [highlight.js](./LIB-472-14.yaml) | コードブロックを言語に応じて色分けする（配布物にまとめず jsDelivr から読み込む） |
| [mermaid](./LIB-472-17.yaml) | 言語 mermaid のコードブロックを図にする（配布物にまとめず jsDelivr から読み込む） |
| [@babel/standalone](./LIB-472-6.yaml) | 範囲の TypeScript の型を削除して JavaScript にする（配布物にまとめず jsDelivr から読み込む） |
| [ajv](./LIB-472-4.yaml) | CLI が設定の aliases を取り込んだ JSON Schema で検証する（配布物にまとめない） |
| [dev-docs](./LIB-472-8.yaml) | 配信元の文書を MCP で検索・参照する（Claude Code がガイドを参照する先） |
| [react](./LIB-472-21.yaml) | VS Code の Webview の画面と hook（React Compiler を含む） |
| [vite](./LIB-472-32.yaml) | VS Code の Webview を 1 つの JS と CSS にまとめる |
| [tailwindcss](./LIB-472-26.yaml) | Webview の部品の class とトークン（Preflight を読み込まない） |
| [shadcn-ui](./LIB-472-24.yaml) | Webview の部品のソース（Button・Alert・Spinner） |
| [msw](./LIB-472-19.yaml) | ストーリーと単体テストの配布物の HEAD のモック |
| [axe-core](./LIB-472-5.yaml) | テストのときだけパネルをアクセシビリティの規則で検査する |
| [react-error-boundary](./LIB-472-22.yaml) | Webview の画面の最上位の Error Boundary |
| [testing-library](./LIB-472-28.yaml) | Webview のコンポーネントと hook の単体テスト |
| [tmux](./LIB-472-29.yaml) | global-setup が常駐サーバーを動かすセッションの確認・起動・閉じる操作 |
| [systemd](./LIB-472-25.yaml) | global-setup が常駐サーバーを動かす user の unit の起動・停止・状態の確認と journal |

<!-- /table -->
