# mdmark-style

## 現状

<!-- table: {"kind": "data"} -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-97.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/scenario/SC-472-97.yaml) | 返答を共通スタイルで描く | 追加する部品の期待を追加する |
| ドキュメント | [docs/scenario/SC-472-99.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/scenario/SC-472-99.yaml) | セッションの開始でマーカーの記載方法を受け取る | 追加する部品のマーカーの記載方法を説明に含める |
| ドキュメント | [docs/scenario/SC-472-98.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/scenario/SC-472-98.yaml) | 発言と返答の用語にマーカーを付ける | 実行のみ |
| ドキュメント | [docs/interface/IF-472-45.tsx.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/interface/IF-472-45.tsx.yaml) | 返答を共通スタイルで描く | 制約の「描き換えるブロック」に部品を追加し、部品ごとの制約とフローを追加する |
| ドキュメント | [docs/interface/IF-472-47.ts.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/interface/IF-472-47.ts.yaml) | マーカーの記載方法を注入する | 制約「説明の文」に追加する部品のマーカーを含める |
| ドキュメント | [docs/config/CFG-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/config/CFG-472-4.yaml) | 設定: mdmark-style | `parts` のキーを追加する |
| ドキュメント | [docs/screen/SCR-472-5.tsx.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/screen/SCR-472-5.tsx.yaml) | ClaudeCodeの返答と発言 | 行の詳細の開閉のボタン・ステップ・ファイルツリー・バッジなどの要素を追加する |
| ドキュメント | [docs/mock/pages/claude-code-terminal/699/mdmark-style/index.html](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/mock/pages/claude-code-terminal/699/mdmark-style/index.html) | claude-code-terminal のモック | この PR の番号のフォルダに、追加する部品を描いた画面のモックを作る |
| ドキュメント | [docs/module/](https://github.com/shuhei1101/mdmark/tree/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/module) の MOD-472-352・MOD-472-353・MOD-472-355・MOD-472-358 | settings.ts・blocks.ts・reply.tsx・marker-guide.ts のモジュール構成 | 部品の分け方と描き方を追加する。reply.tsx が大きくなるときは部品ごとのモジュールに分ける |
| 実装 | [src/mdmark-style/](https://github.com/shuhei1101/mdmark/tree/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/src/mdmark-style) | 返答の描き換え・ブロックへの分け方・設定・マーカーの記載方法の注入 | 部品の追加 |
| 実装 | [mdmark-style/settings.sample.yaml](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/mdmark-style/settings.sample.yaml) | 設定のキーの見本 | 追加する `parts` のキーを追加する |
| テスト | [tests/unit/src/mdmark-style/](https://github.com/shuhei1101/mdmark/tree/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/tests/unit/src/mdmark-style) | 単体テスト | 部品ごとのケースを追加する |
| テスト | [tests/integration/ClaudeCodeプラグイン/mdmark-style/](https://github.com/shuhei1101/mdmark/tree/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/mdmark-style) | 結合テスト（render-reply・screen・inject-marker-guide） | 追加するフローと画面の要素のケースを追加する |

<!-- /table -->

## 変更方針

<!-- table: {"kind": "data"} -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| マーカーの解釈 | 行の詳細・ステップ・タブ・段組み・カードの格子・wide・ビュー・CSV・図と表の番号のマーカーと、行内のバッジ・文字の色・蛍光ペン・キーの記法を、ライブラリ本体の記法の解釈と同じ規則で解釈する | ライブラリ本体の関数をまとめて使用できるかはモジュール構成設計で決める |
| 行の詳細 | 表の行ごとに開閉の Button を描き、開閉の状態は今の開閉の範囲と同じ鍵で持つ | - |
| ステップ | 番号を共通スタイルの色で描き、項目の中身は今の段落・箇条書きと同じ描き方にする | - |
| ファイルツリー | 罫線のツリーを等幅のまま描き、注釈を薄い色にする | 階層を解釈できない行があるときはコードブロックのまま描く |
| バッジ・文字の色・蛍光ペン・キー | 色の名前の文字色・背景色を共通スタイルの定義から取り、キーは `[Ctrl]` の囲みで描く | 色の名前に無い値は色を付けずに描く |
| タブ・段組み・カードの格子・wide・ビュー・CSV | 区切りの名前を見出しにして中身を縦に並べ、ビュー・CSV の表は今の表の部品で描く | - |
| 図と表の番号 | 番号を付けた表の前に番号の文字を描く | 番号を図に付けたときは、図をコードブロックとして描く今の描き方の前に番号を描く |
| 設定 | 追加する部品ごとに `parts` のキーを追加し、既定を `true` にする | キーの分け方は `未確定`（[要件](./要件.mark.md)） |
| マーカーの記載方法の注入 | 追加する部品のうちステップ・ファイルツリー・バッジの記載方法を説明の文に含め、今の文字数の上限に収める | - |
| 既存機能への影響 | 今の表・注意書き・見出し・コードブロック・開閉の範囲・用語のマーカーの描き方を変えない | SC-472-97・SC-472-98 の結合テストと E2E で確認する |
| 部品の木の上限 | 追加した部品も、今の上限（ノードの数・深さ・文字数）を超えるときは `next(e)` を返却する | - |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `4e2ff264..e1ab85ea` | - |

## テスト結果

なし
