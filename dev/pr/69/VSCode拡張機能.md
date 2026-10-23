# VS Code 拡張機能

## 現状

なし（新規。アーキテクチャ図のサブシステム一覧に「VS Code 拡張機能」を足す）

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 置き場所 | `vscode/` に独自の `package.json`・TypeScript のソース・テストを置き、ルートの `package.json` とは依存を分ける | npm workspaces は vsce が扱えないため使わない |
| プレビューの出し方 | 独自の Webview パネルを開き、その中で jsDelivr から読んだ mdmark の `mount` を呼ぶ。本文の差し替えは `update` で行う | 1 つの Markdown に 1 つのパネル |
| 読む版 | `mdmark.version` が `latest` のときは、プレビューを開くときに GitHub のタグ一覧の API から `vX.Y.Z` の最新を選ぶ。取れたら版を拡張機能の状態に残し、取れないときは残した前回の版を使う | 前回の版も無いときは描けない理由を出す。タグ一覧を取る待ちの上限は非機能要件で決める |
| 描けないとき | 配布物の読み込みに失敗したら、プレビューに理由（オフライン・版が無い）と `mdmark.refreshPreview` を出す | - |
| ライブ更新 | エディタの変更を受けて `mdmark.preview.updateDelayMs` 待ち、最後の全文を Webview へ送る。表に戻ったときは全文を送り直す | 背面のパネルへの送信は届く前提にしない |
| スクロールの同期 | ブロックの元の行番号の属性から、エディタの見えている先頭行とプレビューの位置を相互に引く | 片方を動かした直後の逆向きの同期は止め、往復で揺れないようにする |
| テーマ | `mdmark.preview.theme` が `auto` のときは Webview の `body` に VS Code が付ける class をそのまま使い、`light` / `dark` のときは拡張機能が class を付け替える | mdmark が親の class で配色を切り替える変更（ライブラリ本体.md）が要る |
| リンクと画像 | Webview からのリンクの押下を拡張機能が受け、外部 URL は `openExternal`、`.md` は VS Code で開き、`#` はプレビューの中で移る。相対パスの画像は `asWebviewUri` で直す | `localResourceRoots` はワークスペースのフォルダに限る |
| 設定ファイル | `mdmark.configPath` の YAML を拡張機能が読み、`features`・`libraries` だけを取り出して渡す。ファイルの保存を見て描き直す | 読めない YAML は描くのを止めず、プレビューに知らせる |
| CSP | Webview の CSP は jsDelivr と `libraries` の配信元・ワークスペースの画像だけを許し、スクリプトは nonce で許す | - |
| 印刷と書き出し | 要件.md の推奨案 A で、jsDelivr の配布物を読んで `mount` で描く HTML を書き出し、`openInBrowser` で開く。`printToPdf` は書き出した HTML を開いた後に印刷のダイアログを出す | Webview の中では `print()` が効かない。含めるかと HTML の形は `未確定`（要件.md） |
| 版とタグ | 拡張機能の版は `vscode/package.json` の `version` で持ち、タグ `vscode-v{版}` を打つ | jsDelivr が mdmark の版として拾う `v{版}` と混ぜない |
| .vsix の配布 | `.github/workflows/` に、`vscode-v*` のタグで .vsix を作って GitHub Release に添えるワークフローを置く | Marketplace・Open VSX への登録は手で行う（反映作業） |
| テスト | 拡張機能の処理（版の選び方・設定の取り出し・URL の直し方・行番号の引き方）は単体テスト、Webview とコマンドは VS Code を起動する結合テストにする | テストのランナーは設計で決める |

## テスト結果

なし
