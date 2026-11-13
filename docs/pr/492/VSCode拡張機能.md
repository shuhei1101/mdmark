# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-50.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/scenario/SC-472-50.yaml) | 拡張機能の配布物を作る。開始の契機が「master の commit に `vscode-v{バージョン}` のタグを打つ」 | develop の commit に修正する |
| ドキュメント | [docs/interface/IF-472-23.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-23.ts.yaml) | `vscode-v*` のタグの push でワークフローが .vsix を作る | タグを打つ commit の記述を合わせる |
| ドキュメント | [docs/module/MOD-472-83.yml.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-83.yml.yaml)・[docs/module/MOD-472-17.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-17.yaml) | ワークフロー `vscode-release.yml` の構成 | 契機のタグを変えない場合は変えない |
| 実装 | [.github/workflows/vscode-release.yml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/.github/workflows/vscode-release.yml) | `vscode-v*` のタグで .vsix を作り Release に添える | タグはブランチによらず動くため、契機のタグを変えない場合は変えない |
| ドキュメント | [docs/guide/VSCodeで確認する-プレビューを開く.md](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/guide/VSCode%E3%81%A7%E7%A2%BA%E8%AA%8D%E3%81%99%E3%82%8B-%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.md) | Release のタグ `vscode-v{バージョン}` から .vsix を入れる | ブランチに触れる記述があれば合わせる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| タグを打つ commit | スプリントの区切りに、`vscode/package.json` の `version` を上げた commit が develop に入った後、その commit に拡張機能のタグを打つ | - |
| タグの名前 | `vscode-v{X}.{Y}.{Z}` のまま | - |
| 既存機能への影響 | 拡張機能が読み込む mdmark のバージョンを GitHub のタグ一覧から選ぶ処理は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `e4a15bad..16385f70` | 拡張機能の配布物を作る |

## テスト結果

なし（テスト作成・実装で記入する）
