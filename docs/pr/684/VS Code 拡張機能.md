# VS Code 拡張機能

## 現状

<!-- table: {"kind": "data"} -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-10.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/scenario/SC-472-10.yaml) | VSCodeでプレビューを開く | `develop` を記載したときのケースを追加する |
| ドキュメント | [docs/config/CFG-472-2.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/config/CFG-472-2.yaml) | 設定: VS Code 拡張機能 | `mdmark.version` の `allowed`・`description` に `develop` を追加する |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/interface/IF-472-22.ts.yaml) | プレビューを開く | 読み込むバージョンの決め方の制約に `develop` を追加する |
| ドキュメント | [docs/interface/IF-472-20.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/interface/IF-472-20.ts.yaml) | プレビューをリロードする | 読み込むバージョンの決め方に追随するかを設計で確認する |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す | 書き出した HTML が `@develop` を読み込むかを設計で確認する |
| ドキュメント | [docs/module/MOD-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/module/MOD-472-22.ts.yaml) | 読み込むバージョン / version.ts | `develop` のときにタグ一覧を取らずにそのまま使用する |
| ドキュメント | [docs/module/MOD-472-84.json.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/module/MOD-472-84.json.yaml) | ビルドと配布 / package.json | `mdmark.version` の `pattern` を修正する |
| ドキュメント | [docs/module/MOD-472-103.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/docs/module/MOD-472-103.ts.yaml) | 設定 / settings.ts | 範囲外の値を既定に戻す処理が `develop` を受け付けるかを設計で確認する |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/vscode/package.json) | 拡張機能の定義 | `mdmark.version` の `pattern` が `^(latest\|v\d+\.\d+\.\d+)$` |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/vscode/src/version.ts) | 読み込むバージョンを決める | `latest` 以外はそのまま返却するため、`develop` も受け付ける |
| 実装 | [vscode/src/settings.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/vscode/src/settings.ts) | settings.json の `mdmark.*` を読み込む | 既定値 `latest` |
| テスト | [tests/unit/vscode/src/version.test.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/tests/unit/vscode/src/version.test.ts) | version.ts の単体テスト | `develop` のケースを追加する |
| テスト | [tests/unit/vscode/src/settings.test.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/tests/unit/vscode/src/settings.test.ts) | settings.ts の単体テスト | 設計で settings.ts を変える場合にケースを追加する |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/vscode/tests/integration/preview-open.test.ts) | プレビューを開くの結合テスト | 結合テストの実行範囲は設計の後に決める |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設定の値 | `mdmark.version` に `latest`・`v{X}.{Y}.{Z}`・`develop` を記載できる | 既定値は `latest` のまま |
| 読み込むバージョンの決め方 | `develop` のときはタグ一覧を取らず、jsDelivr の `@develop` の配布物を読み込む | - |
| 状態の表示 | 差分の表示に対応するかは、今と同じく読み込んだ配布物の公開関数で判定する | 判定は配布物の中身によるため、`develop` で変える処理は無い |
| 文言 | `patternErrorMessage` と公開ドキュメントの設定の表に `develop` を追加する | 画面に出す文言のため、変える文面はレビューで確定する |
