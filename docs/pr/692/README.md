# mdmark upgrade で設定の build がスキーマに合わなくても、手順が書き換える文書をコピーに入れて戻せるようにする

## 概要

文書の作成者が、設定の `build` がスキーマに合わないフォルダで `mdmark upgrade` を実行して点検のずれで止まっても、移行の手順が書き換えた文書がコピーから元に戻るようになる。

## 背景

[Issue #651](https://github.com/shuhei1101/mdmark/issues/651) の不具合。
[Issue #606](https://github.com/shuhei1101/mdmark/issues/606) の受付で `mdmark upgrade` を調べる中で見つかった。

`build.out` の無い `build` の設定のフォルダに `mdmark upgrade --yes` を実行すると、v0.11.0 の `call` の手順（`marker-json.mjs`）が文書を書き換えた後、点検が `build.out` のずれを出してコピーから戻す。
ところが `.mdmark/backup/{日時}/` には設定ファイルしか入っておらず、文書は書き換わったまま残る。

`upgrade.ts` の `createTarget` は `validateConfig` で検めた後の設定から文書を集めるため、スキーマに合わない `build` が捨てられて文書が 0 件になる。
`call` のスクリプトは `--config` の設定を自分で読み込み、`build` の `include` から文書を集めて書き換える。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
