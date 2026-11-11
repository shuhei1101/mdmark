# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/vscode-diff.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/vscode-diff.ts) | 差分ビューを開いて操作する E2E のヘルパー | `focusModifiedSide` が押す `MODIFIED_LINES`（`:56`）が、削除した行の view zone（`div.view-lines.line-delete`）にも当たる |
| テスト | [tests/e2e/単一ユースケース/差分ビューの変更をプレビューで見る.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E5%B7%AE%E5%88%86%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E5%A4%89%E6%9B%B4%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%A7%E8%A6%8B%E3%82%8B.spec.ts) | 差分ビューから開く E2E | `focusModifiedSide` を使う 3 ケースが fail する |
| テスト | [tests/e2e/単一ユースケース/エディタとプレビューのスクロールを合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | スクロールを合わせる E2E | `test_normal_when_diff_preview` がヘルパー経由で fail する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `focusModifiedSide` のロケーター | `MODIFIED_LINES` を `.monaco-diff-editor .editor.modified .view-lines:not(.line-delete) .view-line` にし、変更後の側の本文の行を押す | PoC で 4 ケースが 3 回の繰り返しで pass した |
| 製品のコード・設計書・`docs/` | 変えない。`vscode/package.json` の `when` は今のまま | [確認ログ](./確認ログ.md) |
| 既存機能への影響 | ヘルパーを使う E2E を流し、他のケースが変わらず pass することを確かめる | - |

## PoC 結果

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| 今の `when`（`editorLangId == markdown`）のまま、変更後の側の本文の行を押して `Shift+Alt+D` | 差分のパネルが開き `div.mdmark-diff-block` が描かれる | ✅ 開いた | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | `when` を変えなくても成り立つ |
| 今の `when` のまま、変更前の側を押して `Shift+Alt+D` | 同じ差分のパネルが開く | ✅ 開いた | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | - |
| 差分ビューのタイトル（両側） | `mdmark: プレビューを横に開く` のボタンが出る | ✅ 1 個 | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | 変更後の側・変更前の側のどちらを押した後も出る |
| 普通に開いた Markdown | ボタンが出て、`Shift+Alt+D` でプレビューが開く | ✅ 開いた | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | - |
| Markdown でないエディタ（`notes.txt`） | ボタンが出ず、`Shift+Alt+D` でパネルが開かない | ✅ 0 個・開かない | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | - |
| 落ちていた 4 ケース（E2E のヘルパー `focusModifiedSide` のロケーターだけを修正） | 4 ケースが pass する | ✅ 3 回繰り返して 12/12 pass | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | `vscode/package.json` は変えていない |
| 落ちていた 4 ケース（ヘルパーを変えない） | - | ❌ 4 ケースとも fail | [#239](https://github.com/shuhei1101/mdmark/pull/239)（closed） | Issue の事象を手元で再現した |

結論: 成立。
ただし、Issue の前提だった「`editorLangId == markdown` が差分エディターで当たらない」は誤りで、`when` を変える必要は無い。
`Developer: Inspect Context Keys` で見ると、差分エディターの変更後・変更前の側はどちらも `editorLangId` が `markdown`、`resourceLangId` が `markdown`、`isInDiffEditor` が `true` だった。

fail の原因は E2E のヘルパー `focusModifiedSide`（`tests/e2e/vscode-diff.ts`）のロケーター `.monaco-diff-editor .editor.modified .view-lines` の `.first()` が、本文の行より DOM の前にある、削除した行を出す view zone（`div.view-lines.line-delete`）に当たること。
この view zone を押してもエディタにフォーカスが入らず（`document.activeElement` が `BODY`）、`Shift+Alt+D` が `no when clauses matched the context` になる。
view zone が描かれる前に押すと本文の行に当たるため、繰り返すと pass と fail が混ざる。
ロケーターを本文の行（`.view-lines:not(.line-delete) .view-line`）に当てると、フォーカスが変更後の側のエディタ（`native-edit-context`）に入り、今の `when` で差分のパネルが開く。

本番（.vsix を入れた VS Code）との違いは、拡張機能を `--extensionDevelopmentPath` で読み込むことだけで、`when` の評価には効かない。
変更前の側は `.monaco-diff-editor .editor.original .view-lines` を `force: true` で押してから `Shift+Alt+D` を押した。

最小再現コードの要点（[541bcc60 の diff](https://github.com/shuhei1101/mdmark/commit/541bcc6063c2e58dea8c28f80cf53827a888b6d5)）:

```ts
// 修正前: 削除した行の view zone（div.view-lines.line-delete）に当たることがある
const MODIFIED_LINES = ".monaco-diff-editor .editor.modified .view-lines";
// 修正後: 変更後の側の本文の行に当てる
const MODIFIED_LINES =
  ".monaco-diff-editor .editor.modified .view-lines:not(.line-delete) .view-line";
```

diff の見どころは `tests/e2e/poc/when.spec.ts` の `poc_modified_click_point`（押した位置にある要素が `DIV.view-lines.line-delete` の中の行だったことの記録）と `poc_modified_text_line`（本文の行を押すと今の `when` で開くこと）。

## テスト結果
