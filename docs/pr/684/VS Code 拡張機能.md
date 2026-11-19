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

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `05a79a26..a8b140e6` | SC-472-10 に develop を読み込むケースを追加 |
| インターフェース定義設計 | `3ad08f5f..cab60972` | IF-472-22 に develop を読み込むフロー、CFG-472-2 の `mdmark.version` に `develop` を追加 |
| モジュール構成設計 | `c1b6d177..8ec11ad5` | MOD-472-22 に develop の単体テスト、MOD-472-84 の `mdmark.version` の `pattern` に `develop` を追加 |
| 実装中の設計の修正 | `a34accef..4806fa23` | 規約『VS Code 拡張機能の配布』に従い `package.json` の `contributes` を変えたため `version` を 0.2.0 に上げ、IF-472-23・SC-472-50 のバージョンを合わせた |

## テスト結果

### ドキュメント修正

なし（ガイド 2 ページと `vscode/README.md` の文書だけの修正で、規約『V字モデル』の対応表で対応する単体・結合テストが無い）

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/vscode/src/version.test.ts` | `test_decide_version_when_develop` | 新規 | ✅（実装の前から pass） | `decideVersion` が `latest` 以外をそのまま返却する（[7fb28e4d](https://github.com/shuhei1101/mdmark/commit/7fb28e4d)）<br>`テスト結果/20261119093735_1297cb8b_単体テスト.log` |
| 単体テスト（フロント）の全件 | 全実行 | 実行のみ | ✅ | 307 ファイル pass<br>`テスト結果/20261119094827_195cdb0b_単体テスト.log` |

### 実装中に直したテスト

| ファイル | 理由 |
| --- | --- |
| `vscode/tests/integration/release.test.ts` | 拡張機能のバージョンを 0.2.0 に上げたため、期待値のバージョンを 0.2.0 に、バージョンが違うときの確認のタグを `vscode-v0.3.0` にした（[a34accef](https://github.com/shuhei1101/mdmark/commit/a34accef)） |

### 結合テストの実行範囲

VS Code 拡張機能の結合テストは TL-3 の補足「VS Code 拡張機能」のコマンド（`xvfb-run -a npm --prefix vscode run test:integration`）で実行し、Vitest の `judge_integration_scope` の対象の外のため、変更したファイルを参照する結合テストを調べて決めた。

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無いエントリーポイント |
| --- | --- | --- | --- |
| `docs/config/CFG-472-2.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/dev-command/CMD-472-1.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/guide/VSCodeで確認する-プレビューを開く.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/guide/VSCode拡張機能.mark.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/interface/IF-472-22.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/interface/IF-472-23.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/interface/IF-472-41.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/module/MOD-472-166.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/module/MOD-472-168.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/module/MOD-472-22.ts.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/module/MOD-472-84.json.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/README.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/VS Code 拡張機能.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/タスク一覧.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/テスト結果/20261119093735_1297cb8b_単体テスト.log` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/テスト結果/20261119094226_4806fa23_lint.log` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/テスト結果/20261119094827_195cdb0b_単体テスト.log` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/ライブラリ本体.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/確認ログ.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/要件.md` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/pr/684/要件.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/scenario/SC-472-10.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/scenario/SC-472-50.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `docs/scenario/SC-472-82.yaml` | R7（拡張機能の結合テストが参照しない） | - | - |
| `migrations/v0.11.0/THIRD_PARTY_LICENSES.txt` | R7（拡張機能の結合テストが参照しない） | - | - |
| `migrations/v0.11.0/legacy-marks.js` | R7（拡張機能の結合テストが参照しない） | - | - |
| `migrations/v0.13.0/retired-diagrams.js` | R7（拡張機能の結合テストが参照しない） | - | - |
| `migrations/v0.14.0/retired-diagrams.js` | R7（拡張機能の結合テストが参照しない） | - | - |
| `scripts/build.ts` | R7（拡張機能の結合テストが参照しない） | - | - |
| `scripts/migrations.ts` | R7（拡張機能の結合テストが参照しない） | - | - |
| `tests/unit/scripts/build.test.ts` | R7（拡張機能の結合テストが参照しない） | - | - |
| `tests/unit/scripts/migrations.test.ts` | R7（拡張機能の結合テストが参照しない） | - | - |
| `tests/unit/vscode/src/version.test.ts` | R7（拡張機能の結合テストが参照しない） | - | - |
| `vscode/README.md` | R7（.vsix に入る。`release.test.ts` が .vsix を作る） | `vscode/tests/integration/release.test.ts` | - |
| `vscode/package-lock.json` | R7（`version` を `release.test.ts` が作る .vsix が持つ） | `vscode/tests/integration/release.test.ts` | - |
| `vscode/package.json` | R7（`version` を `release.test.ts` が、`mdmark.version` の値を `preview-open.test.ts` が確かめる） | `vscode/tests/integration/release.test.ts`・`vscode/tests/integration/preview-open.test.ts` | - |
| `vscode/tests/integration/release.test.ts` | R2 | `vscode/tests/integration/release.test.ts` | - |

`vscode/tests/integration/` の他のファイルは `mdmark.version` を `latest`・`v{X}.{Y}.{Z}` で使い、今回の変更で振る舞いが変わらないため実行しない。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/preview-open.test.ts` | `test_normal_when_develop` | 新規 | ✅ | `vscode/tests/integration/stub-server.ts` の配布物の代役が `@develop` にも配布物を返却するようにした<br>`テスト結果/20261119100349_65875236_結合テスト_VSCode拡張機能.log` |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/05a79a26b04f557433469db12794a274629f3079/vscode/tests/integration/preview-open.test.ts) | 全実行 | 実行のみ | ❌ | 21 件 pass・1 件 fail。fail は `test_normal_when_mermaid`（`mermaid の図を描かない`）で、origin/develop でも同じく fail する既知の事象（[#642](https://github.com/shuhei1101/mdmark/issues/642)。スコープ外）<br>`テスト結果/20261119100349_65875236_結合テスト_VSCode拡張機能.log` |
| `vscode/tests/integration/release.test.ts` | 全実行 | 変更 | ✅ | 2 件。バージョン 0.2.0 の .vsix を作る<br>`テスト結果/20261119100349_65875236_結合テスト_VSCode拡張機能.log` |

VS Code 1.141.0 の実行が #642 の fail で終わるため、stable の VS Code の実行には進んでいない。

