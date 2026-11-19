# mdmark の文書を MCP・CLI・ビュワーのボタンで純粋な Markdown（GFM と Mermaid）に書き出す

## 概要

文書の作成者が、mdmark の記法で記載した文書を、MCP・CLI・ビュワーのボタンから純粋な Markdown（GFM と Mermaid）に書き出し、mdmark を使わない人や道具（GitHub・VS Code の標準のプレビューなど）へ渡せるようになる。

## 背景

[mdmark の文書を、MCP と CLI で純粋な Markdown（GFM と Mermaid）に書き出す](https://github.com/shuhei1101/mdmark/issues/313) の要望。
mdmark の無い表示で読むと、注意書き・バッジ・コードブロックの飾りなどは記法の文字が残り、図の部品・埋め込んだ HTML・拡張のマーカーの範囲は定義の JSON やコードがそのまま見え、目次は何も出ない。
今の CLI（[src/cli/export.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/cli/export.ts)・[src/cli/build.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/cli/build.ts)）と MCP のツール（[src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/plugin/tools.ts) の `export_html`・`build_site`）は HTML への書き出しだけを持つ。
話し合いの D-59 で、書き出す Markdown は GitHub と同じ書き方（GFM と Mermaid）にし、Mermaid にできない図は SVG の画像のリンクにすると決めた。
ユーザーの追加の要望（[コメント](https://github.com/shuhei1101/mdmark/issues/313#issuecomment-6828694292)）で、ビュワーの「Markdown でコピー」「Markdown でエクスポート」のボタンもこの作業 PR の範囲に含めた。
依存先の [新しい図（map）](https://github.com/shuhei1101/mdmark/issues/324) と [flow・sequence の廃止](https://github.com/shuhei1101/mdmark/issues/467) は完了している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | 純粋な Markdown への変換・CLI・ビュワーのボタンの計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | MCP のツールの計画書 |
