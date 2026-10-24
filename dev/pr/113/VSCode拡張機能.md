# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/単一ユースケース/VSCodeでプレビューを開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | `test_normal_when_tags_unreachable` が準備で `openPreviewWithShortcut()` の後に `session.win.keyboard.press("Control+W")` でプレビューを閉じ（108 行目）、プレビューのタブが 0 個になるのを待つ（109〜111 行目） | 更新対象。フォーカスがエディタ側にあると Markdown のタブが閉じ、プレビューのタブが残る |
| テスト | [tests/e2e/vscode.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/vscode.ts) | E2E の共通の処理。`focusEditor()` はエディタの文字を打つ場所を押してフォーカスを置く。プレビューへフォーカスを移す処理・タブを閉じる処理は持たない | 共通の処理に足す場合だけ更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プレビューの閉じ方 | `Control+W` の前に、プレビューのタブ（`.tab[aria-label*="プレビュー guide.md"]`）を押してフォーカスをプレビューへ移す | 同じ手で閉じている『書いた内容をプレビューに映す』の 175〜176 行目に揃える |
| 閉じた後の確かめ | プレビューのタブが 0 個になり、Markdown のタブ（`.tab[aria-label="guide.md"]`）が 1 個残ることを待つ | Markdown のタブが閉じていないことを確かめて、続く `focusEditor()` が同じファイルを指すようにする |
| 検証 | 変えない | |

## テスト結果

### 単体

なし

### 結合

なし

### E2E
