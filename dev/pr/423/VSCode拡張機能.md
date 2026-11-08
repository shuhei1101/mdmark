# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [設計書/シナリオ/単一ユースケース/エディタとプレビューのスクロールを合わせる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.yaml) | エディタとプレビューのスクロールの同期のシナリオ | 折りたたんだセクションのシナリオが無い |
| ドキュメント | [設計書/インターフェース定義/VSCode拡張機能/スクロールを合わせる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.ts.yaml) | `scrollToLine`・`revealLine` の流れと制約 | 閉じたセクションの中の要素を目印から外すことが制約に書かれていない |
| 実装 | [vscode/src/webview/features/preview/panel/scroll.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/features/preview/panel/scroll.ts) | `collectAnchors`・`topForLine` | `collectAnchors` は高さ 0 の要素を除くが、閉じたセクションの中の要素は高さを持ったまま残り、直後の見出しが「位置が戻る要素」として除かれる（[測った記録](./作業/閉じたセクションの要素の位置.log)） |
| テスト | [vscode/tests/integration/scroll-sync.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/scroll-sync.test.ts) | スクロールの同期の結合テスト | 折りたたんだセクションのケースが無い |
| テスト | [tests/e2e/単一ユースケース/エディタとプレビューのスクロールを合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | シナリオの E2E | 折りたたんだセクションのケースが無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| シナリオ | 正常シナリオ（折りたたんだセクションの中を編集する）を追加する。8 番目のセクションを閉じ、その中の最後の段落の行をエディタの先頭にすると、8 番目の見出しが見えている先頭にかかり、9 番目の見出しは先頭より下にあり、セクションは閉じたまま | - |
| インターフェース定義 | 同じ流れの正常系を追加し、制約「エディタから合わせる」に、閉じたセクションの中の行の配置先を書く | - |
| スクロールの同期の修正 | `scroll.ts` で、閉じたセクションの中の要素を目印から外し、その中の行は閉じたセクションの見出しへ配置する | 関数の分け方はモジュール構成設計で決める |
| 画面での確認 | 拡張機能を入れた VS Code で、閉じたセクションの中の行へエディタを動かし、修正前後のプレビューの位置を確認する | - |
| 結合テスト | `scroll-sync.test.ts` に、折りたたんだセクションの中の行の `scrollToLine` で、見出しが Webview の見えている先頭から 1 行分の高さの中にあり、セクションが閉じたままのケースを追加する | - |
| E2E | シナリオの spec に追加したシナリオのケースを追加する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `a3003b12..4b169b93` | - |
| 単一ユースケース設計 | `e447b78b..d014fd8c` | レビューの指摘の修正 |

## テスト結果

なし
