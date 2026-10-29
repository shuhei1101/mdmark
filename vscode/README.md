# mdmark

Markdown を mdmark で描いたプレビューを VS Code に出し、HTML への書き出しと PDF への印刷ができる拡張機能。

mdmark は、表・注意書き・タブ・図などの拡張記法を、各アプリで共通に描くライブラリ。
VS Code 組み込みのプレビューでは出ない拡張記法を、書きながら確かめられる。

## 機能

- Markdown の横にプレビューを開く（`Shift+Alt+D`、Mac は `Shift+Option+D`）
- 打つたびにプレビューを描き直す。保存したときだけ描き直す設定もある
- エディタとプレビューのスクロールを両方向に合わせる
- VS Code のテーマの明暗に合わせて配色を切り替える。ライト・ダークに固定もできる
- 配色のテーマを選べる。プレビューのタイトルの歯車のボタンから、mdmark の設定を開ける
- 外部の URL は既定のブラウザ、`.md` へのリンクは VS Code で開く。相対パスの画像も出る
- `mdmark.config.yaml` の `features`・`libraries` で、機能のオン・オフと外部ライブラリを決める
- 開いている Markdown を HTML に書き出し、ブラウザで開き、PDF に印刷する

## 使い方

Markdown を開き、`Shift+Alt+D`（Mac は `Shift+Option+D`）か、エディタのタイトルのボタンを押す。
コマンドパレットでは `mdmark:` から探す。

| コマンド | 内容 |
| --- | --- |
| `mdmark: プレビューを横に開く` | Markdown の横の列にプレビューを開く |
| `mdmark: プレビューを開く` | Markdown と同じ列にプレビューを開く |
| `mdmark: プレビューをリロード` | 設定ファイルと読むバージョンを決め直し、配布物を読み直して描く |
| `mdmark: 設定ファイルを開く` | `mdmark.config.yaml` を開く。無ければ雛形を作るかを尋ねる |
| `mdmark: 設定を開く` | VS Code の設定画面を、mdmark の項目に絞って開く。プレビューのタイトルの歯車のボタンも同じ |
| `mdmark: HTML に書き出す` | 開いている Markdown を HTML に書き出す |
| `mdmark: ブラウザで開く` | 書き出し直した HTML を既定のブラウザで開く |
| `mdmark: PDF に印刷` | 書き出し直した HTML をブラウザで開き、印刷のダイアログを出す |

PDF は、印刷のダイアログの送信先で「PDF に保存」を選んで作る。

## 設定

| 設定 | 既定 | 内容 |
| --- | --- | --- |
| `mdmark.version` | `latest` | 読む mdmark のバージョン。`latest` は最新の `v{X}.{Y}.{Z}`、`v0.6.0` のように記載するとそのバージョンに固定する |
| `mdmark.configPath` | `mdmark.config.yaml` | `features`・`libraries` を読む設定ファイルのパス |
| `mdmark.preview.liveUpdate` | `true` | `true` は打つたびに、`false` は保存したときに描き直す |
| `mdmark.preview.updateDelayMs` | `300` | 最後に打ってから描き直すまでのミリ秒（0〜5000） |
| `mdmark.preview.scrollPreviewWithEditor` | `true` | エディタに合わせてプレビューを動かす |
| `mdmark.preview.scrollEditorWithPreview` | `true` | プレビューに合わせてエディタを動かす |
| `mdmark.preview.theme` | `auto` | `auto` は VS Code のテーマに合わせ、`light`・`dark` は固定する |
| `mdmark.colorTheme` | 空 | 配色のテーマ。`dev-swiss`・`theme-paper`・`theme-slate`・`theme-contrast` から選ぶ。空のときは設定ファイルの `colorTheme` に従う。書き出す HTML にも当たる |
| `mdmark.export.outputDir` | 空 | 書き出す先のフォルダ。空のときは Markdown と同じフォルダ |

## 必要なもの

- VS Code 1.141.0 以上
- ネットワーク接続。mdmark の配布物は拡張機能に同梱せず、jsDelivr の版付きの URL から読む。バージョンを `latest` にしたときは、GitHub のタグ一覧も取る
- 書き出した HTML も、開くときに jsDelivr へ届く必要がある

オフラインのときや配布物を読めないときは、プレビューに理由と「リロード」のボタンが出る。

## ドキュメント

使い方と設定の一覧は、mdmark のドキュメントにある。

https://shuhei1101.github.io/mdmark/

ソースと Issue は https://github.com/shuhei1101/mdmark
