# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | Markdown の横か同じ列にプレビューを開く | 差分ビューから開く流れを追加 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 書き換えと背面からの復帰で描き直す | 変更後の側の書き換えで差分を描き直す流れを追加 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/スクロールを合わせる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.ts.yaml) | エディタとプレビューのスクロールを合わせる | 差分で描いたときの合わせ方を追加 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの管理・描き直し・スクロール | 差分ビューの判定と変更前・変更後の読み取りを追加 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト・メッセージの型 | 変更前の Markdown を渡すメッセージと、差分で描く呼び出しを追加 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/拡張機能の入口.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%E3%81%AE%E5%85%A5%E5%8F%A3.ts.yaml) | activate と package.json の contributes | 差分ビューでのボタンの表示条件（コマンドを追加するならその行） |
| ドキュメント | [dev/設計書/画面設計/VSCodeのプレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | プレビューのパネルの要素 | 差分で描いた文書と、差分に対応しないバージョンの理由を追加 |
| ドキュメント | [dev/設計書/画面設計/VSCodeのコマンドと通知.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89%E3%81%A8%E9%80%9A%E7%9F%A5.ts.yaml) | エディタのボタン・コマンドの表示名 | 差分ビューでのボタン（コマンドを追加するならその表示名） |
| ドキュメント | [dev/設計書/外部ライブラリ/vscode.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/vscode.yaml) | VS Code の拡張機能の API | 差分ビューのタブ（`window.tabGroups`・`TabInputTextDiff`）と、`git:` の URI の文書の読み取りを追加 |
| 実装 | [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/manager.ts) | Markdown の URI ごとのパネルの管理と、コマンドの対象の決定 | アクティブなタブが差分ビューのときの対象の決め方 |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) | 1 つの Markdown のパネル | 変更前の Markdown を読み、描くメッセージに入れる |
| 実装 | [vscode/src/messages.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/messages.ts) | 拡張機能と Webview のメッセージの型 | `render` に変更前の Markdown を追加 |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.ts) | Webview の中で `mount` を呼ぶ | 変更前と変更後の 2 つのリビジョンを返す取り出し元を作り、開いた状態で描く指定と一緒に渡す |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/develop/vscode/package.json) | コマンド・メニュー・設定 | 差分ビューでのボタンの表示条件 |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 差分ビューの判定 | プレビューを開くとき、アクティブなタブの入力が `TabInputTextDiff` で、変更前と変更後の両方の文書の `languageId` が `markdown` なら差分ビューとして扱う | 判定と読み取りが Git の作業ツリー・ステージ・コミットの差分で通るかは PoC 検証で確かめる |
| パネルの対象 | パネルは変更後の側の URI で持ち、変更前の側の URI を添える。同じ変更後の URI で差分でないパネルがあっても、差分のパネルは別に持つ | 差分のパネルのタブの題は画面設計で決める |
| 変更前と変更後の読み取り | 2 つの側の URI を `workspace.openTextDocument` で読む。`git:` の URI も VS Code の Git の機能が返す内容をそのまま使う | 拡張機能は Git を呼ばない |
| Webview への受け渡し | `render` のメッセージに変更前の Markdown を加える。Webview は変更前と変更後の 2 つのリビジョンを返す `DiffSource` を作り、`mount` に開いた状態で描く指定と一緒に渡す | 指定の名前はライブラリ本体のインターフェース定義で決める |
| 描き直し | 変更後の側の文書の書き換えを、今の `mdmark.preview.liveUpdate`・`mdmark.preview.updateDelayMs` に従って差分の描き直しに使う。変更前の側の書き換えは受け取らない | - |
| スクロール | 差分ビューの変更後の側のエディタとプレビューを合わせる | 削除したブロックの位置の扱いは、色分けの描き方を決めてからインターフェース定義で決める |
| ボタンとコマンド | 差分ビューでも `mdmark.openPreviewToSide` のボタンを出す | `未確定`（[要件](./要件.md) のプレビューを差分で開く操作） |
| 差分に対応しないバージョン | 読んだ配布物が開いた状態で描く指定を持たないときは、差分を描かず、描けない理由をプレビューに出す | 理由の文言は画面設計で決める |
| 既存機能への影響 | 差分ビューでないエディタから開いたプレビュー・書き出し・印刷は変えない | 書き出し・印刷を差分のパネルから呼んだときは、変更後の文書を対象にする |

<!-- /table -->

## テスト結果

なし
