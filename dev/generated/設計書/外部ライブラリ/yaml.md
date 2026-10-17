<!-- source-hash: sha256:e38f3eb83eb9a83ad9923ae4edc56484d402849d8ee457d17c0c7145a8c6a36a -->
# yaml

YAML 1.2 を読み書きするライブラリ。既定で core スキーマで読み、読めないときは行と列を持つ誤りを投げる。

ライブラリ

pkg:npm/yaml@2.9.1

必須

採用

eemeli/yaml

> 状態: 済<br>
> 確認日: 2026-10-17<br>
> 確認内容: Node v24.14.0 の ESM から 2.9.1 を `import { parse, YAMLParseError } from "yaml"` で読、`build` の入った設定をオブジェクトにできること、空の文字列が `null` を返すこと、閉じていない `[` が `YAMLParseError`（`BAD_INDENT`、`linePos` の開始が 3 行 1 列）、重なったキーが `DUPLICATE_KEY`（2 行 1 列）になることを確かめた。`017` は 17、`yes` は文字列、`0o17` は 15 で YAML 1.2 の core スキーマの読み方だった（reviewer の確認）。`parseDocument` で読んだ Document のキーの名前を同じ位置で変え、コメントと並びを保って `String(doc)` で戻せること、`set` で既存のキーの値をコメントを残して書き換えられること、キーを先頭に足せること、フロー形式の配列を書き戻すと `[ "a" ]` と中括弧の内側に空白が入ることを確かめた<br>

## 現在のバージョン情報

> 版: 2.9.1<br>
> 最新版: 2.9.1<br>
> 確認日: 2026-10-16<br>
> 版の出所: package.json<br>
> 版の固定の仕方: 完全一致。`dependencies` に置き、CLI の配布物に束ねない。依存は lockfile で固定する<br>

ISC（商用利用可）。実行時の依存は無い

https://eemeli.org/yaml/

## 選定の記録

yaml 2.9.1・js-yaml 5.5.0・confbox 0.3.1・@std/yaml 1.3.0 を比べた。

実行時の依存が 0 件で YAML 1.2 を読め、読めないときの行と列がそのまま取れる。js-yaml は CLI 用の argparse を引き、空の入力で例外を投げる。confbox は束ねた js-yaml の修正が再リリースまで届かない。@std/yaml は npmjs に無く、`.npmrc` を持たない使う側の npx で入らない。

戻り値は `any` のため、設定と索引の形は Schema の検査で確かめる。空の設定ファイルは `null` になり、Schema に合わない設定として扱う。

## インストール手順

```bash
npm i -E yaml@2.9.1
```

### API

API

2.9.1

##### parse

parse

関数

YAML 1.2 の文字列を 1 文書読んで JavaScript の値にする

###### パラメータ

| パラメータ | 型 | 必須 | 既定 | 説明 |
| --- | --- | --- | --- | --- |
| src | string | ✅ | - | 読む YAML の文字列 |
| options.uniqueKeys | boolean | - | true | 同じマップの中の重なったキーを誤りにするか |
| options.maxAliasCount | number | - | 100 | 展開するエイリアスの上限 |

###### 戻り値

| フィールド | 型 | 説明 | 補足 |
| --- | --- | --- | --- |
| - | any | 読んだ値。空の文字列は `null` | 形は検査しない。設定と索引の Schema の検査で確かめる |

planned

32

##### YAMLParseError

YAMLParseError

クラス

`parse` が YAML を読めないときに投げる誤り

###### 戻り値

| フィールド | 型 | 説明 |
| --- | --- | --- |
| code | string | 誤りの種類（`BAD_INDENT`・`DUPLICATE_KEY` など） |
| linePos | [{ line: number; col: number }, { line: number; col: number }] | 誤りの場所の開始と終わりの行と列（1 始まり） |
| message | string | 誤りの内容、行と列、該当行の抜き出し |

planned

32

##### parseDocument

parseDocument

関数

YAML をコメントとキーの並びを保った Document として読む。読んだ Document を書き換えて `doc.toString({ flowCollectionPadding: false })` で文字に戻す

###### パラメータ

| パラメータ | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| src | string | ✅ | YAML の文字列 |

###### 戻り値

| フィールド | 型 | 説明 | 補足 |
| --- | --- | --- | --- |
| - | Document | 読んだ Document。読めないところは投げずに `doc.errors` に入る。`hasIn`・`getIn`・`setIn`・`deleteIn`・`has`・`set`・`createPair` で読み書きし、`isMap`・`isSeq`・`isScalar` で節を判定する | 値を同じ型のスカラーで書き換えると、コメントと書き方が残る。`String(doc)` はフロー形式の並びの内側に空白を入れる（`["**/*.md"]` が `[ "**/*.md" ]` になる）ため、書き戻しは `toString({ flowCollectionPadding: false })` で行う（2.9.1 で確かめた） |

planned

39
