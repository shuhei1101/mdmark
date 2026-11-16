# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/layout/LAY-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/layout/LAY-472-1.yaml) | `tests/unit/vscode`・`tests/integration/vscode`・`vscode/tests/integration` の 3 つのエントリが同じ `content_types`（`test`・`vscode`）を持つ | まとめた後のエントリにし、残す置き場所があればその理由を記載する |
| ドキュメント | [docs/test-procedure/TP-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/test-procedure/TP-472-1.yaml) | 層ごとのテストの場所と実行のコマンド | 移した後のパスに合わせる |
| ドキュメント | [docs/module/MOD-472-17.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/module/MOD-472-17.yaml) | `vscode/` のディレクトリ | `vscode/tests/` を移す場合はディレクトリから外す |
| ドキュメント | [docs/module/MOD-472-84.json.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/module/MOD-472-84.json.yaml) | `vscode/package.json` の `scripts` | `test:integration` のパスを合わせる |
| ドキュメント | [docs/module/MOD-472-81.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/module/MOD-472-81.ts.yaml)・[MOD-472-85](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/module/MOD-472-85.ts.yaml)〜[MOD-472-87](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/module/MOD-472-87.ts.yaml) | 結合テストのまとめ方・起動の補助のコード | 移した後のパスに合わせる |
| ドキュメント | `docs/module/` の MOD-472-16・22・53〜60・63〜67・70・71・74〜76・82・88・91〜95・100〜104・106 | `test_files` などに VS Code 拡張機能のテストのパスを持つ | 移した後のパスに合わせる |
| ドキュメント | [docs/component/CMP-472-29.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/component/CMP-472-29.ts.yaml)・[CMP-472-35](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/component/CMP-472-35.ts.yaml)・[CMP-472-63](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/component/CMP-472-63.ts.yaml) | Webview の部品のテストのパス | 移した後のパスに合わせる |
| ドキュメント | `docs/library/` の LIB-472-18・19・21・22・27・28 | 外部ライブラリを使用するテストのパス | 移した後のパスに合わせる |
| 実装 | [vitest.config.ts](https://github.com/shuhei1101/mdmark/blob/6edae01e/vitest.config.ts) | `tests/unit/**`・`tests/integration/**` を include する | VS Code の上で動かすテストを `tests/integration/` へ移す場合は Vitest の対象から外す |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/package.json) | `test:integration` が `node tests/integration/run.ts` を実行する | 移した後のパスに合わせる |
| 実装 | [vscode/scripts/build.ts](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/scripts/build.ts) | `--tests` で `vscode/tests/integration/` の `index.ts` と `*.test.ts` を `out/test/` にまとめる | 移した後のフォルダからまとめる |
| 実装 | [tests/files.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/tests/files.yaml)・[vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/files.yaml) | テストのファイルの管理用の YAML | 移したファイルの行を移す |
| テスト | [tests/unit/vscode/](https://github.com/shuhei1101/mdmark/blob/6edae01e/tests/unit/vscode)・[tests/integration/vscode/](https://github.com/shuhei1101/mdmark/blob/6edae01e/tests/integration/vscode)・[vscode/tests/integration/](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/tests/integration) | VS Code 拡張機能の単体テスト・Webview の部品のストーリーの結合テスト・VS Code の上で動かす結合テスト | 置き場所をまとめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 置き場所の決定 | 要件の `未確定` の案から決め、LAY-472-1 のエントリに反映する | `未確定`（決める段: モジュール構成設計。案と推奨は [要件](./要件.md)） |
| テストの移動 | `git mv` で移し、中身は import のパスだけを変える | 移す前と同じテストが同じ件数で pass する |
| テストの設定 | `vitest.config.ts`・`vscode/package.json`・`vscode/scripts/build.ts` を移した後のパスに合わせる | VS Code の上で動かすテストが Vitest の対象に入らない |
| 設計書と管理用の YAML | テストのパスを記載した設計書と `tests/files.yaml`・`vscode/files.yaml` を移した後のパスに合わせる | `git grep` で移す前のパスが残らないことを確かめる |
