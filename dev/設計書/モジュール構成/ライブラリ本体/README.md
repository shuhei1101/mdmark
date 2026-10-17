# ライブラリ本体

ライブラリ本体の公開の入口・描く処理・部品と、ビルドと部品の描画のスクリプト

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [公開の入口.ts](./公開の入口.ts.yaml) | 配布物の入口の JavaScript（version()・mount()・render()）と、描いた文書の CSS |
| [描く.ts](./描く.ts.yaml) | 要素に文書を描く mount と、外部ライブラリの読み込み・印刷の前後の折り畳み |
| [描画.ts](./描画.ts.yaml) | Markdown を本文の HTML 文字列にする render と、印の読み取り・落とす設定 |
| [設定と機能.ts](./設定と機能.ts.yaml) | 設定に既定を当てる処理と、文書の印で機能のオン・オフを決める処理 |
| [部品.ts](./部品.ts.yaml) | 知らせの枠・読み込み中の枠の HTML を返す関数とストーリー |
| [ビルド.ts](./ビルド.ts.yaml) | 版を決めて検査し、esbuild で dist/ を書き、サイズを検査する |
| [部品の描画.ts](./部品の描画.ts.yaml) | Storybook のストーリーに部品の HTML を出す描画の口と Storybook の設定 |
| [記法.ts](./記法.ts.yaml) | 印と記法を HTML にする markdown-it のコアルール |
| [操作.ts](./操作.ts.yaml) | mount が描いた記法に付ける表・タブ・節と行の詳細の操作 |
| [拡張.ts](./拡張.ts.yaml) | registerExtension の登録表と、Standard Schema での引数の検査 |
| [索引と用語.ts](./索引と用語.ts.yaml) | 索引の形の検査・参照の表・索引の点検と、用語集の表・用語の下線・関連文書の一覧・ツールチップの操作 |
| [CLI.ts](./CLI.ts.yaml) | init・check・export・build の CLI と、設定・文書の読み取り・埋め込み・HTML の組み立て |
| [書き出したHTMLの起動.ts](./書き出したHTMLの起動.ts.yaml) | 書き出した HTML を開いたときに埋めたモジュールを用意して描き、まとめた HTML で文書を行き来する処理 |
| [版を上げる.ts](./版を上げる.ts.yaml) | mdmark upgrade の版の比較・移行の手順の読み取りと適用・写しと戻し・変更履歴・問い |

<!-- /table -->
