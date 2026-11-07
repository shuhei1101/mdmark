# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/VSCodeでプレビューを開く.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.yaml) | プレビューを開いて描くシナリオ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/書いた内容をプレビューに映す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.yaml) | 書き換えで描き直すシナリオ | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューを開く操作と `render` のメッセージ | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 書き換えで描き直す処理 | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューをリロードする.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E3%83%AA%E3%83%AD%E3%83%BC%E3%83%89%E3%81%99%E3%82%8B.ts.yaml) | 設定ファイルを決め直して描く処理 | 更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) | `loadConfig` と `PreviewConfig` | 更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの描き直しと見張るファイル | 更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | Webview の `mount` の呼び出しとメッセージの型 | 更新対象 |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | 重ねて参照した設定から `mount` に指定するキーを取り出す | `aliases` を取り出していない |
| 実装 | [vscode/src/messages.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/messages.ts) | 拡張機能ホストと Webview のメッセージの型 | `render` は `markdown`・`config`・`theme` だけを持つ |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) | 設定の再読み込み・`render` の送信・見張るファイル | - |
| 実装 | [vscode/src/webview/features/preview/panel/document-view.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/features/preview/panel/document-view.ts) | Webview で `mount`・`update` を呼ぶ | エイリアスを指定していない |
| 実装 | [src/cli/aliases.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/cli/aliases.ts) | 設定の `aliases` の YAML を参照してエイリアスとずれを返却する `loadAliases` | CLI の書き出しが使用。プレビューからも呼ぶ |
| 実装 | [src/cli/check.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/cli/check.ts) | `mdmark check` の点検とずれの出力 | ずれの 1 行の組み立てを `formatCheckIssue` に切り出す |
| テスト | [tests/e2e/単一ユースケース/VSCodeでプレビューを開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | プレビューを開く E2E | ケースを追加 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| エイリアスの作成 | `loadConfig` の後に、重ねた設定と最も近い設定ファイルから `loadAliases` を呼び、エイリアスとずれを受け取る | 設定に `aliases` が無ければ YAML を参照しない |
| メッセージ | `render` のメッセージに `aliases`（`MdmarkAlias[]`。無ければ持たない）を追加する | - |
| Webview の描画 | `mount` の `opts.aliases` にメッセージの `aliases` を指定する。`aliases` が変わったときは `config` と同じく `mount` し直す | `update` は `opts.aliases` を変えない |
| エラー表示 | `loadAliases` のずれは出力チャネルに警告として記録し、除かれた行・レコード以外で描く | 設定ファイルを参照できない帯は出さない |
| 描き直し | `aliases` の行が指す YAML をパネルの見張るファイルに追加し、書き換えで描き直す | - |
| 既存機能への影響 | 設定に `aliases` が無い文書の描画・メッセージは今と同じ | - |
| 性能 | YAML の参照は設定の再読み込みのときだけ行い、Markdown の書き換えごとには行わない | - |
| 保守性 | `{file}:{where}: {kind}: {message}` の組み立てを `src/cli/check.ts` の `formatCheckIssue` にまとめ、`mdmark check`・`mdmark export`・`mdmark upgrade` とプレビューの警告で使う | 3 か所の重複にプレビューが 4 か所目として加わるため |
| エイリアスの元の YAML | `loadAliases` の戻り値に、当たった YAML の絶対パス `files` を追加し、プレビューの見張るファイルに入れる | CLI の呼び出し元は `files` を使わない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `ebcad280..8ccbfae8` | - |
| 単一ユースケース設計 | `008729cf..0ca531c5` | レビューの指摘の修正 |
| インターフェース定義設計 | `2218cc68..93c23883` | - |
| インターフェース定義設計 | `14cf3214..3235d19a` | レビューの指摘の修正 |
| モジュール構成設計 | `af5be2f6..fc8e6833` | - |

## テスト結果

なし
