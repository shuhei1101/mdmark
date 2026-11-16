# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-50.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/scenario/SC-472-50.yaml) | 拡張機能の配布物を作る。例のバージョンが `0.1.3` | 例のバージョンを `0.1.4` にし、Marketplace にアイコンが表示されることを期待に加える |
| ドキュメント | [docs/interface/IF-472-23.ts.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/interface/IF-472-23.ts.yaml) | .vsix の中身の期待が `extension/package.json`・`extension/dist/`・`node_modules/` の有無 | 例のバージョンを `0.1.4` にし、.vsix にアイコンの PNG があり原本の SVG が無いことを期待に加える |
| ドキュメント | [docs/module/MOD-472-84.json.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/module/MOD-472-84.json.yaml) | `vscode/package.json` の `scripts`・`contributes` | 最上位の `icon` を加える |
| ドキュメント | [docs/module/MOD-472-17.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/module/MOD-472-17.yaml) | `vscode/` のディレクトリと `.vscodeignore` で除くもの | アイコンの原本と PNG の置き場所と、原本を .vsix から除くことを加える |
| ドキュメント | [docs/layout/LAY-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/layout/LAY-472-1.yaml) | `vscode/` のファイルのエントリ | アイコンの原本と PNG のエントリと、中身の種類 `icon` を加える |
| ドキュメント | [docs/dev-command/CMD-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/dev-command/CMD-472-1.yaml) | ビルド・生成のコマンド | アイコンの PNG を書き出すコマンドを加える |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/35edd638/vscode/package.json) | 最上位の `icon` が無い。`version` は `0.1.3` | `icon` を加え、`version` を `0.1.4` に上げる |
| 実装 | [vscode/.vscodeignore](https://github.com/shuhei1101/mdmark/blob/35edd638/vscode/.vscodeignore) | .vsix に入れないもの | アイコンの原本の SVG を加える |
| 実装 | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/vscode/files.yaml) | `vscode/` のファイルの管理用の YAML | アイコンの SVG と PNG の行を加える |
| テスト | [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/35edd638/vscode/tests/integration/release.test.ts) | バージョン `0.1.3` で .vsix を作って中身を確かめる | バージョンを `0.1.4` にし、.vsix のアイコンの有無を確かめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 図案 | 案ごとに SVG を作って配信し、ユーザーに確認して 1 つに決める | `未確定`（要件.md の `## 要望`） |
| 原本 | 決まった SVG を `vscode/icon.svg` に配置し、`.vscodeignore` で .vsix から除く | `vscode/media/` は git の管理の外のため使用しない |
| PNG | 原本から 256×256px の PNG を `vscode/icon.png` に書き出し、`vscode/package.json` の最上位の `icon` に `icon.png` を記載する | 書き出しは開発コマンドの `npx playwright screenshot`（ルートの devDependencies の Playwright） |
| 拡張機能のバージョン | `vscode/package.json` の `version` を `0.1.3` から `0.1.4` に上げる | 公開済みのバージョンは上書きできないため |
| 公開 | マージの後、develop の HEAD に `vscode-v0.1.4` のタグを打ち、`vscode-release.yml` に Marketplace へ公開させる | 反映作業『拡張機能のアイコンの公開』 |
| 既存機能への影響 | 拡張機能のコマンド・プレビュー・書き出しは変えない | - |
| 外部ライブラリ | 図案に既存の図形（Markdown のマーク 等）を使用する場合は、そのライセンスを確かめる | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `41fd8606..6f1bd6af` | 拡張機能の配布物を作る |
| 単一ユースケース設計 | `98f0c34c..e6c7bb64` | レビューの任意の指摘の修正（アイコンの期待値を読み取れる値にする） |
| インターフェース定義設計 | `537120ae..b4834038` | 拡張機能の配布物を作る |
| モジュール構成設計 | `6e0728ab..b4938155` | package.json・ビルドと配布・フォルダ構成・開発コマンド |
