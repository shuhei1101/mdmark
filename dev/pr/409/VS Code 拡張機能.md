# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/単一ユースケース/PDFに印刷する.spec.ts](https://github.com/shuhei1101/mdmark/blob/4bb3708be49be0d95be47b793f54e5d07e412fad/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.spec.ts) | `test_normal_when_theme_selected` の 1 行だけのリンクがリンクのカードで描かれ、本文のリンクの色が当たらない | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/VSCodeでプレビューを開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/4bb3708be49be0d95be47b793f54e5d07e412fad/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | `test_normal_when_range_scripts` が `script-src` を 4 単語と期待する。`vscode/src/preview/html.ts` は `Webview.cspSource` も入れる | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/書いた内容をプレビューに映す.spec.ts](https://github.com/shuhei1101/mdmark/blob/4bb3708be49be0d95be47b793f54e5d07e412fad/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.spec.ts) | `test_normal_when_aliases_yaml_saved` がツールチップを開いたまま本文の `innerText` を比べる | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `test_normal_when_theme_selected` | リンクを文の中に配置した段落にして、リンクのカードでなく本文のリンクの色を確認する | - |
| `test_normal_when_range_scripts` | `script-src` の単語を、nonce・スタブの配信元・jsDelivr と、プレビューの HTML の `Webview.cspSource` の単語に限ることで確認する。固定の数を期待しない | VS Code のバージョンで `cspSource` の単語の数が変わるため |
| `test_normal_when_aliases_yaml_saved` | ツールチップを閉じて（ポインターを要素の外へ移して）から本文の `innerText` を比べる | - |

## テスト結果

### 単体

なし

### 結合

なし
