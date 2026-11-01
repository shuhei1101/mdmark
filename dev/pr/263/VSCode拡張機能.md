# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューの HTML と CSP | `media-src` と、相対パスの動画・音声の解決を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの HTML と CSP | `media-src` を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト。相対パスの画像を Webview の URI に替える | 動画・音声・ポスターも替える |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) | `mdmark.config.yaml` の取り出し | アセットのルートを読み、設定ファイルのフォルダを基準に絶対パスにする |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | 拡張機能が読む `mdmark.config.yaml` のキー | アセットのルートを追加する |
| 実装 | [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | CSP は `img-src` だけを持ち、`media-src` が無い | `media-src` を追加する |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.ts) | 相対パスの `img` を Webview の URI に替える | `video`・`audio`・`source`・`poster` とアセットのルートを当てる |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| CSP | `media-src` に `cspSource` と `https:` を足す | |
| 相対パスの動画・音声 | 相対パスの `video`・`audio`・`source` の `src` と `poster` を、`img` と同じく Webview の URI に替える。文書からの相対パスで見つからないときはアセットのルートで探す | |
| 再生できない形式 | 動画・音声の `error` で、要素を知らせの枠に替え、ファイルを既定のアプリで開くリンクを出す | PoC 結果。m4a（AAC）・webm が当たる |
| 音の出ない形式 | mp4・mov はプレビューで映像だけが再生され、AAC の音声が出ないことを使い方に書く | PoC 結果 |
| 既存機能への影響 | 相対パスの画像・リンクの開き方を保つ | |

<!-- /table -->

## PoC 結果

<!-- table: data -->

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| mp4（H.264・AAC）の動画 | `canplay` が来て、`play()` の 1 秒後に `currentTime` が 0.5 秒以上進む | ❌ 映像は 1.0 秒進むが、音声を復号しない | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | `webkitAudioDecodedByteCount` が 0 |
| m4a（AAC）の音声 | 同上 | ❌ 開けない | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`。AAC だけの mp4 も同じ |
| mp3 の音声 | 同上 | ✅ 0.92 秒 | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | |
| webm（記録だけ） | 同上 | ❌ 開けない | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | VP9・Opus と VP8・Vorbis のどちらも `DEMUXER_ERROR_COULD_NOT_OPEN` |
| ogg（Vorbis。記録だけ） | 同上 | ✅ 0.79 秒 | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | |
| wav（記録だけ） | 同上 | ✅ 0.70 秒 | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | |
| mov（H.264・AAC。記録だけ） | 同上 | 映像だけ ✅ 1.0 秒 | [#264](https://github.com/shuhei1101/mdmark/pull/264)（closed） | mp4 と同じく音声を復号しない |

<!-- /table -->

VS Code 1.141.0（Electron 43.7.7）と stable の 1.144.0（Electron 43.8.3）で、結果は同じだった（どちらも Chrome 150）。

結論: 不成立。プレビューの Webview は AAC の音声を再生できず、webm を開けない。

- CSP に `media-src` を追加し、`asWebviewUri` の URI を `src` に入れれば、対応する形式は再生できる
- ユーザーの操作なしの `play()` は、自動再生の制限で `NotAllowedError` になる。画面を 1 回クリックした後は再生できた

最小再現コードの要点（`poc/webview/test.cjs`）:

```js
`img-src ${cspSource} https: data:`,
`media-src ${cspSource} https: data:`,
// ...
const element = document.createElement(tag);
const pending = Promise.race([canplay, error, wait(10000)]);
element.src = webview.asWebviewUri(vscode.Uri.file(path)).toString();
await pending;
await element.play();
const start = element.currentTime;
await wait(1000);
result.currentTime = element.currentTime - start;
result.audioDecodedBytes = element.webkitAudioDecodedByteCount;
```

diff の見どころ: `poc/webview/test.cjs`（Webview の CSP と、形式ごとの再生の確かめ）、`poc/webview/run.ts`（`TEST_VSCODE_VERSIONS` の両方での起動）、`poc/webview/clicker.py`（Xvfb の画面へのクリック）。

## テスト結果

なし
