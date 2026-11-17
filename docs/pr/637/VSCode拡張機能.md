# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-21.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/docs/interface/IF-472-21.ts.yaml) | インターフェース定義『プレビューを再描画する』。`test_normal_when_map_configured` の名前だけを参照する | 変更しない |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/docs/interface/IF-472-22.ts.yaml) | インターフェース定義『プレビューを開く』。`test_normal_when_version_pinned` の名前だけを参照する | 変更しない |
| 実装 | [src/part-modules.ts](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/src/part-modules.ts) | map の部品のモジュール（`map.js`）を動的 `import()` で読み込む | 変更しない |
| テスト | [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_map_configured` が、`rect`・`hexagon` を書き込んだ後に `renders(record).length > before` だけを待ち、最後の `render` の `config.map` を比べる | 修正する |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/vscode/tests/integration/preview-open.test.ts) | `test_normal`・`test_normal_when_version_pinned` が、`waitForRendered` の直後に `distRequests()` を `map.js` を含む 3 件と比べる | 修正する |
| テスト | [vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/f29ba2f1/vscode/tests/integration/helpers.ts) | `waitFor`・`waitForRendered`・`renders`・`distRequests` を持つ | 必要なら修正する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `test_normal_when_map_configured` の待ち | `rect`・`hexagon` を書き込んだ後、最後の `render` の `config.map.kinds.store.shape` が書き込んだ値になるまで `waitFor` で待つ | 回数が増えたかだけの待ちは使用しない。その後の検証は変えない |
| `test_normal_when_version_pinned`・`test_normal` の配布物の要求の検証 | `distRequests()` が期待する 3 件を全て含むまで `waitFor` で待ってから、並べ替えた全件を `deepStrictEqual` で比べる | 全件の比較は残し、余計な要求が無いことも確認する |
| 実装 | 変えない | `map.js` の要求が `rendered` の後に記録されうるのは動的 `import()` の読み込みの時点によるもので、プレビューの振る舞いの誤りではない |

## テスト結果

### 単体

なし

### 結合

なし（結合テスト作成で記入する）
