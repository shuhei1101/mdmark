# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/panel.ts) | プレビューのパネル | 違反 5 件 |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/config.ts) | 拡張機能の設定 | 違反 2 件 |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/export/embed.ts) | 書き出しの埋め込み | 違反 2 件 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/export/export.ts) | HTML の書き出し | 違反 2 件 |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/version.ts) | 配布物のバージョン | 違反 2 件 |
| 実装 | [vscode/src/preview/includes.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/includes.ts) | 取り込む文書の読み込み | 違反 1 件 |
| 実装 | [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/manager.ts) | プレビューの管理 | 違反 1 件 |
| ドキュメント | `docs/module/` の、上のファイルの関数を持つモジュールの設計書 | 違反した関数の処理 | 関数を分けた箇所の処理・関数の一覧を更新する |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 検査の範囲 | `vscode/src/**/*.ts` を複雑さの 4 規則の `files` に含める（設定はライブラリ本体の計画書の `tools/eslint/eslint.config.js`） | Webview（`vscode/src/webview/`）の他の規則は今のまま |
| 違反の修正 | ライブラリ本体の計画書の「違反の修正」「分けた関数の配置」と同じ方針で、違反した関数を分ける | 拡張機能のコマンド・設定・Webview との通信の挙動を変えない |
| 回帰の確認 | ルートの単体テスト（`vscode/src/` の単体テストを含む）・`vscode/` の結合テスト（`npm --prefix vscode run test:integration`）・型検査（`npm --prefix vscode run typecheck`）を全て回し、全 pass を確認する | - |

## テスト結果

なし（テスト作成・実装で記入する）
