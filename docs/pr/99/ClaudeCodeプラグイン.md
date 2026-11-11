# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeにプラグインを入れる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.yaml) | セットアップの「push したブランチ」が、ビルドした `plugin/` を含むこのブランチを GitHub へ push したものを前提にする | 変更しない |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | 準備は `git rev-parse --abbrev-ref HEAD` のブランチ名と `git cat-file -e HEAD:plugin/server/mcp.js` だけを見る | 準備に検査を加える |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| detached の検査 | `git rev-parse --abbrev-ref HEAD` が `HEAD` のとき、detached で GitHub のブランチを決められないことと、ブランチを checkout して流すことを出して失敗させる | `plugin/server/mcp.js` の検査より前に置く |
| commit の一致の検査 | `git rev-parse HEAD` と `git ls-remote origin refs/heads/{ブランチ}` の commit を比べ、違うときは両方の commit と、push してから流すことを出して失敗させる | GitHub にブランチが無い（`ls-remote` の出力が空）ときも一致しないとして扱う。`ls-remote` が 0 以外で終わったときはその標準エラーを出して失敗させる |
| 既存の判定 | 検査を通ったときのプラグインを入れる操作と検証は変えない | - |

## テスト結果

なし
