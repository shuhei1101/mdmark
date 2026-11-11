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

<!-- table: data -->

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/00-undecidable.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/00-undecidable.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/commands.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/commands.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/export.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/open-config.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/open-config.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/preview-link.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/preview-link.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/preview-open.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/preview-reload.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/preview-reload.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/preview-rerender.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/release.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |
| [vscode/tests/integration/scroll-sync.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/vscode/tests/integration/scroll-sync.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024104000_b83ed09_結合テスト.log` |

<!-- /table -->

### E2E

<!-- table: data -->

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/e2e/単一ユースケース/配布物をビルドして検査する.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E9%85%8D%E5%B8%83%E7%89%A9%E3%82%92%E3%83%93%E3%83%AB%E3%83%89%E3%81%97%E3%81%A6%E6%A4%9C%E6%9F%BB%E3%81%99%E3%82%8B.spec.ts) | 全実行（8 件） | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/複合ユースケース/VSCodeで書きながら確かめてPDFにする.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E6%9B%B8%E3%81%8D%E3%81%AA%E3%81%8C%E3%82%89%E7%A2%BA%E3%81%8B%E3%82%81%E3%81%A6PDF%E3%81%AB%E3%81%99%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/VSCodeでプレビューを開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/書いた内容をプレビューに映す.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.spec.ts) | 全実行 | 実行のみ | ✅ | 1 回目の通しで `test_normal_when_config_saved` が 4 ワーカーの並列下で Ctrl+P のクイック入力を待つ 30 秒を超えて fail し、単独の再実行と 2 回目の通しは全 pass（`テスト結果/20261024105817_43691c2_E2Eテスト.log` は 2 回目） |
| [tests/e2e/単一ユースケース/エディタとプレビューのスクロールを合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/プレビューをVSCodeのテーマに合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92VSCode%E3%81%AE%E3%83%86%E3%83%BC%E3%83%9E%E3%81%AB%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/プレビューのリンクと画像を開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%83%AA%E3%83%B3%E3%82%AF%E3%81%A8%E7%94%BB%E5%83%8F%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/HTMLに書き出す.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/PDFに印刷する.spec.ts](https://github.com/shuhei1101/mdmark/blob/fix/e2e/typecheck-without-vscode-deps/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261024105817_43691c2_E2Eテスト.log` |

<!-- /table -->

E2E の全件実行（`npm run test:e2e`）は流していない。影響するユースケースの 9 spec（38 件）だけを Chromium のプロジェクトで流した。
