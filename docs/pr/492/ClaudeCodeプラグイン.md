# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [plugin/.claude-plugin/plugin.json](https://github.com/shuhei1101/mdmark/blob/e4a15bad/plugin/.claude-plugin/plugin.json) | プラグインの名前・バージョン・説明 | `version` を削除する |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/scripts/build-plugin.ts) | `writePluginManifest` が `plugin.json` の `version` を記載する | 削除する |
| 実装 | [src/plugin/setup/status.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/src/plugin/setup/status.ts)・[src/plugin/setup/server.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/src/plugin/setup/server.ts) | `target_version` と起動コマンドの `#v{バージョン}` を、ビルドで埋めた `__MDMARK_VERSION__` から作る | 出所は既に `version.ini`。コードは変えない見込み |
| ドキュメント | [docs/scenario/SC-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/scenario/SC-472-4.yaml) | プラグインを入れる | 更新で develop の commit が届くことを合わせる |
| ドキュメント | [docs/scenario/SC-472-69.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/scenario/SC-472-69.yaml) | 端末にセットアップする | 移行の目標のバージョンの出所の記述を合わせる |
| ドキュメント | [docs/interface/IF-472-11.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-11.ts.yaml)・[IF-472-12](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-12.ts.yaml)・[IF-472-8](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-8.ts.yaml)・[IF-472-7](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-7.ts.yaml)・[IF-472-9](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-9.ts.yaml)・[IF-472-13](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-13.ts.yaml) | 「プラグインのバージョン（`plugin.json` の `version`）」を移行の目標・雛形の `version`・同梱の配布物のバージョンにする | ビルドで埋めた mdmark のバージョンの記述に修正する |
| ドキュメント | [docs/interface/IF-472-41.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-41.ts.yaml) | 配布物のビルドが `plugin.json` の `version` を記載する | 記載しない振る舞いに修正する |
| ドキュメント | [docs/module/MOD-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-14.ts.yaml) | `writePluginManifest` の関数とテスト | 関数を削除する |
| ドキュメント | [docs/module/MOD-472-10.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-10.ts.yaml)・[MOD-472-11](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-11.ts.yaml)・[MOD-472-12](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-12.ts.yaml)・[MOD-472-8](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-8.ts.yaml) | 依存の「プラグインのバージョン」 | 呼び名を合わせる |
| テスト | [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/unit/scripts/build-plugin.test.ts)・[tests/unit/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/unit/scripts/build.test.ts)・[tests/integration/lib/build.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/integration/lib/build.test.ts) | `plugin.json` の `version` を確認するケース | `version` を記載しないことを確認するケースに修正する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プラグインの定義 | `plugin.json` から `version` を削除し、`name`・`description` だけにする | - |
| ビルド | `writePluginManifest` と呼び出しを削除し、`plugin.json` を書き換えない | - |
| バージョンを参照する処理 | `__MDMARK_VERSION__`（`version.ini`）を出所にしたまま、設計書の出所の記述を合わせる | - |
| プラグインの更新 | `version` の無いプラグインが commit で更新されることを PoC で確認し、外部ライブラリの制約に記録する | - |
| `plugin/` の生成物 | スプリントの区切りの管理作業でビルドして入れる | - |
| 既存機能への影響 | 雛形の `version`・常駐サーバーの起動コマンドのバージョンは今と同じ値になる | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `e4a15bad..16385f70` | プラグインを入れる・端末にセットアップする |
| 単一ユースケース設計 | `2f013a85..a02d82ae` | レビューの指摘の修正（使い捨てのブランチ） |
| インターフェース定義設計 | `e2d03794..ec621369` | 配布物をビルドする・端末の状態を調べる・端末の設定を書き込む・文書のフォルダの設定を書き込む・常駐サーバーを起動する・文書を書き出す・まとめる |
| モジュール構成設計 | `deb08b15..e6d1cf58` | プラグインのビルド（`writePluginManifest`・`PLUGIN_MANIFEST` を廃止）・セットアップの入口・書き込み・状態・起動 |

## PoC 結果

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| `version` の無いプラグインの導入 | `plugin install` が終了コード 0、導入の記録のバージョンが commit の SHA | ✅ `version: 8841e5f1e4ee` | [#493](https://github.com/shuhei1101/mdmark/pull/493)（closed） | `gitCommitSha` は commit の SHA の全桁、`installPath` は `cache/{マーケットプレイス}/{プラグイン}/{短縮 SHA}` |
| commit での更新 | `marketplace update` → `plugin update` で新しい commit に上がる | ✅ `0b17f55c38dc` | 同上 | `updated from 8841e5f1e4ee to 0b17f55c38dc`。導入先の `SKILL.md` が 2 つ目の commit の内容になった |
| `version` を持つプラグインとの差 | `version` を変えずに commit を追加すると更新されない | ✅ `v0.1.0` のまま | 同上 | `already at the latest version (v0.1.0)`。導入先の `SKILL.md` は 1 つ目の commit のまま |
| 自動更新 | `marketplace update` だけで上がるかを記録する | 上がらない | 同上 | `marketplace update` の後も `version`・`gitCommitSha` は変わらず、`plugin update` で上がった |

結論: 成立。
`plugin.json` から `version` を削除すれば、develop に入った commit がプラグインの更新で配布先に届く。
`plugin update` の後は Claude Code の再起動で反映する（出力の `Restart to apply changes.`）。

検証構成と本番の違いは次のとおりで、どちらも結論を変えない。

| 違い | 結論を変えない理由 |
| --- | --- |
| マーケットプレイスを GitHub（`shuhei1101/mdmark`）ではなく、手元の smart HTTP の git URL で追加した（`file://` と `git://` は `marketplace add` が受け付けない） | どちらも git の clone でマーケットプレイスを取り、導入の記録の `version`・`gitCommitSha` の決め方は取得元によらない |
| Claude Code のバージョンが 2.1.322 | 利用者の手元と同じ系列で、`version` が無いときに commit の SHA をバージョンにする振る舞いは公式の資料（[Plugins の公開](https://code.claude.com/docs/en/plugins/publish)）と合う |

最小再現コードの要点（[poc/verify.sh](https://github.com/shuhei1101/mdmark/blob/e9bf5ea5/poc/verify.sh)）:

```bash
python3 -I "$HERE/git_http.py" "$WORK" "$PORT" &   # git http-backend の smart HTTP で bare リポジトリを配る
export CLAUDE_CONFIG_DIR=$cfg                       # ユーザーの設定に触れない
claude plugin marketplace add "http://127.0.0.1:$PORT/$name.git"
claude plugin install "p$name@m$name"
# SKILL.md を書き換えて commit し、bare リポジトリへ push する
claude plugin marketplace update "m$name"
claude plugin update "p$name@m$name"
# installed_plugins.json の version・gitCommitSha・installPath と、導入先の SKILL.md を確認する
```

diff の見どころは、`plugin.json` の `version` の有無だけを変えた 2 つのケースを同じ手順で実行している `run_case` と、実行結果の [poc/result.log](https://github.com/shuhei1101/mdmark/blob/e9bf5ea5/poc/result.log)。

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/62eb7a86/tests/unit/scripts/build-plugin.test.ts) | `writePluginManifest` のテスト | 削除 | - | 関数の廃止に合わせて削除 |
| 単体テストの全件 | 全実行 | 実行のみ | ✅ | 2067 テスト中 2064 pass。時間切れの 3 件（`test_take_backup_when_outside`・`test_run_check`・`test_prepare_embeds`）は load average 40 の負荷によるもので、時間切れの上限を延ばした個別実行で 62 テスト pass<br>`テスト結果/20261113040426_66ac56cd_単体テスト.log` |
| [tests/unit/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/a687178e/tests/unit/scripts/build.test.ts) | `test_main_when_guide_index_invalid` | 変更 | ✅ | 準備の `plugin.json` から `version` を削除。`build-plugin.test.ts` と合わせて 38 テスト pass<br>`テスト結果/20261113050419_a687178e_単体テスト.log` |

lint は違反なし（`テスト結果/20261113040426_66ac56cd_lint.log`・`テスト結果/20261113050419_a687178e_lint.log`。警告は base にもある `plugin/bin/setup.js` のサイズの 1 件）。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/integration/lib/build.test.ts](https://github.com/shuhei1101/mdmark/blob/a687178e/tests/integration/lib/build.test.ts) | `test_normal`・`test_normal_when_version_given` | 変更 | ✅ | `plugin.json` が `version` を持たず、ビルドの前と同じ中身であることを確認する。ファイルの 8 テスト pass。負荷による時間切れの 2 回の実行もログに残す<br>`テスト結果/20261113050419_a687178e_結合テスト.log` |
| `tests/integration/ClaudeCodeプラグイン/` | 全実行 | 実行のみ | ✅ | 14 ファイル pass（同じログ） |
