# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [.claude-plugin/marketplace.json](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/.claude-plugin/marketplace.json) | マーケットプレイスの定義。`plugins` は `mdmark`（`./plugin`）だけ | `mdmark-style` の行を追加する |
| 実装 | [plugin/](https://github.com/shuhei1101/mdmark/tree/560c24a9b8730808b8999fc7dcb35290103cfc7b/plugin) | プラグイン `mdmark`（MCP・フック・スキル） | 変更しない |
| ドキュメント | [docs/architecture/ARCH-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/architecture/ARCH-472-1.yaml) | アーキテクチャ図。サブシステム「Claude Code プラグイン」は MCP とフックを持つ | mdmark-style を加える |
| ドキュメント | [docs/library/LIB-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/library/LIB-472-1.yaml) | 外部ライブラリ『ClaudeCode』。確認したバージョンは 2.1.309 | mod の API を記録する |
| ドキュメント | [docs/nonfunctional/NFR-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/nonfunctional/NFR-472-1.yaml) | 非機能要件 | 確認した Claude Code のバージョンを見直す |
| ドキュメント | [docs/scenario/SC-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/scenario/SC-472-4.yaml) | ClaudeCodeにプラグインを入れる | mdmark-style を選んで入れる流れを追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プラグインの配置先 | リポジトリの直下に mdmark-style のフォルダを作り、`marketplace.json` の `plugins` に行を追加する。`plugin.json`・`plugins[]` に `version` を持たせない | フォルダ名はモジュール構成設計で決める |
| 返答の描き換え | `ui.render` の `AssistantMessage` で、返答の Markdown を解析して表・見出し・注意書き・コードを共通スタイルの部品の木にする | 部品の木の上限（20,000 ノード・深さ 32・100,000 文字）を超えるときは元の描画に任せる |
| マーカー | 返答の `<!-- ... -->` の mdmark のマーカーを参照して描き方（表の種類・注意書き 等）に使用し、マーカーの行と行内のマーカーを画面に出さない | 対応するマーカーの一覧は単一ユースケース設計で決める。`AssistantMessage.text` は画面が隠す部分を除いた本文のため、マーカーが残って届くかを PoC で確認する |
| 用語のマーカー | `AssistantMessage`・`UserMessage` の本文の用語に下線を付け、hover で開くカードと、本文の後ろの脚注を出す | カードと脚注の状態と引数は部品設計・画面設計で決める |
| マーカーの記載方法の注入 | mod の `classic.SessionStart` の結果の `additionalContext` で、マーカーの記載方法の短い説明を注入する。SessionStart は起動・再開・`/clear`・圧縮の後に発火するため、発火ごとに 1 回注入する（`/clear`・圧縮でモデルの文脈から消えた説明を入れ直す） | `inject_marker_guide: false` で止める。`session.start` の戻り値は文脈を変えないため使用しない |
| 設定 | `MDMARK_STYLE_CONFIG` が指す `settings.yaml`（無ければ `~/.config/mdmark-style/settings.yaml`）の `global`・`projects` を、knowledge の規約『Claude プラグインルール』の `## 設定ファイル` のとおりに重ねて参照する | 設定の設計書は新規の `docs/config/CFG-472-4.yaml` |
| 描けない部品 | 図（mermaid・map）・埋め込んだ HTML は描き換えない | - |
| 既存のプラグイン mdmark | 変えない | - |

## テスト結果

なし
