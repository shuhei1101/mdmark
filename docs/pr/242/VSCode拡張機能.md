# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/vscode-diff.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/vscode-diff.ts) | 差分ビューを開いて操作する E2E のヘルパー | `openCommitDiff`（`:79`）が VS Code 1.141.0 に無いコマンド名 `Timeline: Focus on Timeline View` を探す |
| テスト | [tests/e2e/単一ユースケース/差分ビューの変更をプレビューで見る.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E5%B7%AE%E5%88%86%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E5%A4%89%E6%9B%B4%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%A7%E8%A6%8B%E3%82%8B.spec.ts) | 差分ビューから開く E2E | `test_normal_when_commit_diff`（`:38`）が `openCommitDiff` で fail する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `openCommitDiff` のコマンド名 | `session.runCommand` に渡す名前を `Explorer: Focus on Timeline View` にする | E2E が使う VS Code は `tests/e2e/vscode-binary.ts` の `VSCODE_VERSION` で固定している |
| 製品のコード・設計書・`docs/` | 変えない | - |
| 既存機能への影響 | `差分ビューの変更をプレビューで見る.spec.ts` を全件流し、他のケースが変わらず pass することを確かめる | - |

## テスト結果
