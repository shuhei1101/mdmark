# VS Code 拡張機能

コマンド・既定のショートカット・設定の一覧

VS Code の拡張機能 mdmark のコマンドと設定。
コマンドはコマンドパレットで `mdmark:` から探す。
設定は VS Code の設定（`settings.json`）の `mdmark.*` で、ワークスペースの設定（`.vscode/settings.json`）が利用者の設定に勝つ。
手順は [VS Code で見る](../使い方/VSCodeで見る/README.md)。

## 一覧

| 名前 | コマンド | 説明 |
| --- | --- | --- |
| [プレビューを横に開く](#プレビューを横に開く) | `mdmark.openPreviewToSide` | Markdown の横の列に、mdmark で描いたプレビューを開く |
| [プレビューを開く](#プレビューを開く) | `mdmark.openPreview` | Markdown のエディタと同じ列に、プレビューを開く |
| [プレビューをリロードする](#プレビューをリロードする) | `mdmark.refreshPreview` | 設定ファイルと読むバージョンを決め直し、配布物を読み直して描く |
| [設定ファイルを開く](#設定ファイルを開く) | `mdmark.openConfig` | 拡張機能が読む設定ファイルを開く。無ければ雛形を作るかを尋ねる |
| [HTML に書き出す](#html-に書き出す) | `mdmark.exportHtml` | 開いている Markdown を、mdmark で描く HTML に書き出す |
| [ブラウザで開く](#ブラウザで開く) | `mdmark.openInBrowser` | 書き出し直した HTML を既定のブラウザで開く |
| [PDF に印刷](#pdf-に印刷) | `mdmark.printToPdf` | 書き出し直した HTML をブラウザで開き、印刷のダイアログを出す |
| [設定](#設定) | `mdmark.*` | 拡張機能の動きを決める VS Code の設定 |
| [設定ファイルのキー](#設定ファイルのキー) | `mdmark.config.yaml` | 拡張機能が設定ファイルから読むキー |

## プレビューを横に開く

Markdown の横の列に、プレビューを開く。
同じ Markdown のプレビューが開いていれば、新しく作らず表に出す。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: プレビューを横に開く` |
| 既定のショートカット | `Shift+Alt+D`（Mac は `Shift+Option+D`） |
| エディタのタイトル | アイコンのボタン（ポインターを当てると `mdmark: プレビューを横に開く`） |

ショートカットとボタンは、Markdown を開いているとき（`editorLangId == markdown`）だけ効く。
コマンドパレットには、Markdown を開いているか、mdmark のプレビューにフォーカスがあるときに出る。

### 引数

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `uri` | 任意 | プレビューを開く Markdown。省くと、mdmark のプレビューにフォーカスがあるときはそのプレビューの Markdown、それ以外はアクティブなエディタの Markdown |

## プレビューを開く

Markdown のエディタと同じ列のタブに、プレビューを開く。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: プレビューを開く` |

出す条件は [プレビューを横に開く](#プレビューを横に開く) のコマンドパレットと同じ。

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。

## プレビューをリロードする

プレビューの設定ファイルと読むバージョンを決め直し、配布物を読み直して描く。
描けないときのボタン「リロード」も同じ処理を呼ぶ。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: プレビューをリロード` |
| プレビューのボタン | 描けないときに出る「リロード」 |

コマンドパレットには、mdmark のプレビューが 1 つ以上開いているときだけ出る。
`mdmark.version` が `latest` のときは、タグ一覧を 1 回取り直す。

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。省いたときの対象は、フォーカスのあるプレビューか、アクティブなエディタの Markdown のプレビュー。

## 設定ファイルを開く

`mdmark.configPath` の設定ファイルをエディタで開く。
無いときは、雛形を作るかをダイアログで尋ね、`作る` を選んだときだけ作って開く。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: 設定ファイルを開く` |
| プレビューのボタン | 設定ファイルを読めない帯の「設定ファイルを開く」 |

コマンドパレットには常に出る。

雛形は、`features` と `libraries` の記載例をコメントにした YAML で、キーは持たない。
作った直後のプレビューの見た目は変わらない。

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。設定ファイルの場所を決める Markdown になる。

## HTML に書き出す

開いている Markdown を、jsDelivr の配布物を読んで `mount` で描く HTML に書き出す。
書き出せたら、書き出したパスと `ブラウザで開く` のボタンを通知で出す。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: HTML に書き出す` |

書き出す先は `mdmark.export.outputDir`。
ファイル名は Markdown の拡張子を `.html` に替えたもの。
保存していない書き換えも書き出す内容に含む。
書き出した HTML は、開くときに jsDelivr へ届く必要がある。

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。書き出す Markdown になる。

## ブラウザで開く

呼ぶたびに [HTML に書き出す](#html-に書き出す) と同じ HTML を書き出し直し、既定のブラウザで開く。
書き出しの通知は出さない。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: ブラウザで開く` |
| 書き出しの通知 | `mdmark: HTML に書き出す` が出す「ブラウザで開く」のボタン |

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。開く Markdown になる。

## PDF に印刷

書き出し直した HTML を既定のブラウザで開き、描き終えた後に印刷のダイアログを出す。
PDF は、そのダイアログの送信先で「PDF に保存」を選んで作る。

### 使い方

| 呼び方 | 内容 |
| --- | --- |
| コマンドパレット | `mdmark: PDF に印刷` |

外部ライブラリの描画を待つのは 10 秒まで。
書き出した HTML は、後から手で開くと、また印刷のダイアログが出る。

### 引数

[プレビューを横に開く](#プレビューを横に開く) と同じ。印刷する Markdown になる。

## 設定

拡張機能の動きを決める VS Code の設定。

### リクエスト

```json
{
  "mdmark.version": "latest",
  "mdmark.configPath": "mdmark.config.yaml",
  "mdmark.preview.liveUpdate": true,
  "mdmark.preview.updateDelayMs": 300,
  "mdmark.preview.scrollPreviewWithEditor": true,
  "mdmark.preview.scrollEditorWithPreview": true,
  "mdmark.preview.theme": "auto",
  "mdmark.export.outputDir": ""
}
```

<!-- table: data -->

| 設定 | 型 | 既定 | 許す値 | 説明 | 反映 |
| --- | --- | --- | --- | --- | --- |
| `mdmark.version` | 文字列 | `latest` | `latest` か `v{X}.{Y}.{Z}` | `latest` のときは、プレビューを開くときとリロードしたときに GitHub のタグ一覧から `v{X}.{Y}.{Z}` の最新を選ぶ。バージョンを記載するとそのバージョンに固定し、タグ一覧を取らない | プレビューを開き直すかリロードしたとき |
| `mdmark.configPath` | 文字列 | `mdmark.config.yaml` | 相対パスか絶対パス | `features` と `libraries` を読む YAML のパス。相対パスは Markdown を含むワークスペースのフォルダから（ワークスペースの外の Markdown は Markdown のフォルダから）解決する | 即時 |
| `mdmark.preview.liveUpdate` | 真偽値 | `true` | `true`・`false` | `true` のときは Markdown を打つたびに描き直す。`false` のときは保存したときだけ描き直す | 即時 |
| `mdmark.preview.updateDelayMs` | 整数 | `300` | 0〜5000 | 最後に打ってから描き直すまでのミリ秒。範囲の外の値は既定の値として扱う | 即時 |
| `mdmark.preview.scrollPreviewWithEditor` | 真偽値 | `true` | `true`・`false` | エディタをスクロールしたときに、プレビューを同じ箇所まで動かす | 即時 |
| `mdmark.preview.scrollEditorWithPreview` | 真偽値 | `true` | `true`・`false` | プレビューをスクロールしたときに、エディタを同じ箇所まで動かす | 即時 |
| `mdmark.preview.theme` | 文字列 | `auto` | `auto`・`light`・`dark` | `auto` は VS Code のテーマの明暗に合わせ、`light`・`dark` はその配色に固定する | 即時 |
| `mdmark.export.outputDir` | 文字列 | 空 | 空・相対パス・絶対パス | `mdmark.exportHtml`・`mdmark.openInBrowser`・`mdmark.printToPdf` が HTML を書くフォルダ。空のときは Markdown と同じフォルダ。相対パスは Markdown を含むワークスペースのフォルダから解決する | 即時 |

<!-- /table -->

### レスポンス

なし。

### エラー

`mdmark.version` が `v{X}.{Y}.{Z}` の形でないと、VS Code が設定の入力欄で警告する。
`mdmark.preview.updateDelayMs` が範囲の外のときは、既定の 300 として扱う。

## 設定ファイルのキー

拡張機能が `mdmark.configPath` の設定ファイルから読むキー。
キーの意味は [設定](./設定.md)。

### リクエスト

```yaml
features:
  callout: false
libraries:
  my-chart: ./libs/my-chart.js
```

| キー | 説明 |
| --- | --- |
| `features` | 機能のオン・オフの既定。書いた値をそのまま `mount` の `opts.config.features` に渡す |
| `libraries` | 外部ライブラリの対応表。`http:`・`https:` の URL はそのまま、相対 URL は設定ファイルのあるフォルダを基準に解決して、`mount` の `opts.config.libraries` に渡す |

`theme`・`extensions`・`index`・`build` など、ほかのキーは読まない。
最上位がマップでないファイルと空のファイルは、設定なしとして扱う。

### レスポンス

なし。保存すると、開いているプレビューを描き直す。

### エラー

YAML として読めないときは、前に読めた設定（無ければ設定なし）で描いたまま、プレビューの文書の先頭に読めない行を知らせる帯を出す。
読めるようになると、帯は消える。
キーの中の知らない名前と型の違う値は、mdmark が無視する。
