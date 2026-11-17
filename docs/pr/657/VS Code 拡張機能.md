# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/956920321591ba00d3296f3c391b349b026468dd/vscode/src/export/embed.ts) | HTML への書き出しで、文書が使用するマーカーの取得を `src/render/used.ts` から import する | import のパスを修正 |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/956920321591ba00d3296f3c391b349b026468dd/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す。`src/render/used.ts` のパスを持つ | パスを更新 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| import | `src/render/used.ts` を移した場合、`vscode/src/export/embed.ts` の import のパスを移した先に修正する | 移さない場合は変えない |
| インターフェース定義 | IF-472-15 のパスを移した先に合わせる | - |
| 確認 | 拡張機能のビルドと `tests/unit/vscode/` の単体テストを実行して合格させる | - |
