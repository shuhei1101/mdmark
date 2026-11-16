# Claude Code プラグイン

## 現状

<!-- table: {"kind": "data"} -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/ER図/使い方集.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/ER%E5%9B%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.yaml) | 使い方集の索引のスキーマ | 変えない（行を追加するだけ） |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | 使い方集の索引 | 色の使い方のガイドと、画像・動画を置く手順の行を追加する |

<!-- /table -->

## 変更方針

<!-- table: {"kind": "data"} -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 使い方集 | `guide/index.yaml` に、[色で強調する](https://github.com/shuhei1101/mdmark/blob/1a8e22d03b9a55a7c72933c45fa0a4a8a0f21fb8/docs/%E4%BD%BF%E3%81%84%E6%96%B9/%E6%9B%B8%E3%81%8F/%E8%89%B2%E3%81%A7%E5%BC%B7%E8%AA%BF%E3%81%99%E3%82%8B.md) と [画像と動画を置く](https://github.com/shuhei1101/mdmark/blob/1a8e22d03b9a55a7c72933c45fa0a4a8a0f21fb8/docs/%E4%BD%BF%E3%81%84%E6%96%B9/%E6%9B%B8%E3%81%8F/%E7%94%BB%E5%83%8F%E3%81%A8%E5%8B%95%E7%94%BB%E3%82%92%E7%BD%AE%E3%81%8F.md) を指す行を足す | 使い方集の索引の文字数は非機能要件『使い方集の索引の文字数』の内に収める |
| 既存機能への影響 | `check`・`export_html`・`build_site` は CLI と同じ処理を使い、ツールの引数は変えない | |

<!-- /table -->

## テスト結果

なし
