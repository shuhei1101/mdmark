# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/ビルドと配布.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%93%E3%83%AB%E3%83%89%E3%81%A8%E9%85%8D%E5%B8%83.ts.yaml) | `vscode/tests/integration/` のディレクトリ構成と `runIntegrationTests` を持ち、代役の配信（`createStubServer`）の置き場所は持たない | 更新対象 |
| テスト | [vscode/tests/integration/run.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/vscode/tests/integration/run.ts) | 代役の配信 `createStubServer` と結合テストの入口 `runIntegrationTests` を同じファイルに持ち、`@vscode/test-electron` の `runTests` を import する | 更新対象 |
| テスト | [tests/e2e/vscode.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/vscode.ts) | 24 行目で `createStubServer` を `run.ts` から import するため、直下の型検査が `@vscode/test-electron` の型を引く | 更新対象 |
| 設定 | [tsconfig.json](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tsconfig.json) | `include` に `tests` を含み、`tests/e2e/vscode.ts` から辿る `vscode/` のファイルも型検査する | 変えない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 代役の配信の置き場所 | `createStubServer` と、それだけが使う定義（代役の状態の型・配布物の配り方・JSON の読み書き）を、`@vscode/test-electron` を import しない `vscode/tests/integration/` の別のファイルへ移す | 振る舞いは変えない |
| 結合テストの入口 | `run.ts` は移した先から `createStubServer` を import し、`runIntegrationTests` と `TEST_VSCODE_VERSIONS` を持ち続ける | `npm --prefix vscode run test:integration` の流し方は変えない |
| E2E の import | `tests/e2e/vscode.ts` は `createStubServer` を移した先から import する | `buildExtension`（`vscode/scripts/build.ts`）は直下の `esbuild` だけを引くため変えない |
| モジュール構成 | ビルドと配布のディレクトリ構成に移した先のファイルを加える | |
| 直下の依存と型検査の範囲 | 直下の `package.json` と `tsconfig.json` は変えない | |

## テスト結果

### 単体

なし

### 結合

なし

### E2E

なし
