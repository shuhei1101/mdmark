# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/複合ユースケース/プラグインを入れて端末と文書のフォルダをセットアップする.spec.ts](https://github.com/shuhei1101/mdmark/blob/4bb3708be49be0d95be47b793f54e5d07e412fad/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%81%A6%E7%AB%AF%E6%9C%AB%E3%81%A8%E6%96%87%E6%9B%B8%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97%E3%81%99%E3%82%8B.spec.ts) | `test_normal`・`test_normal_when_already_set_up` が、作成していない `terminal.env.CLAUDE_CONFIG_DIR` を `installPlugin` に指定し、`execFile` が `ENOENT` になる | 更新対象 |
| テスト | [tests/e2e/setup-skill.ts](https://github.com/shuhei1101/mdmark/blob/4bb3708be49be0d95be47b793f54e5d07e412fad/tests/e2e/setup-skill.ts) | 端末の `env.CLAUDE_CONFIG_DIR` を `{home}/claude` にする | 共通の準備は変えない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `test_normal`・`test_normal_when_already_set_up` | `installPlugin` を呼ぶ前に、`terminal.env.CLAUDE_CONFIG_DIR` のフォルダを作成する | - |

## テスト結果

### 単体

なし

### 結合

なし
