# コードブロックのHTMLを描く

コードブロックの HTML を描かせる印・チャートの custom element の置き方・`data-hint` の書き方の手順

部品で描けない見た目を HTML で書き、チャートと図の要素のヒントを置くときに実行する。

## 前提

- [文書を描く](https://github.com/shuhei1101/mdmark/blob/v0.9.0/docs/使い方/導入/文書を描く.md)
- 設定の `features.html` がオン（既定）。ヒントを出すには `features.hints` もオン（既定）。オフにする手順は [機能をオン・オフする](https://github.com/shuhei1101/mdmark/blob/v0.9.0/docs/使い方/カスタマイズ/機能をオン・オフする.md)

## 手順

### HTML を描かせる

#### マーカーで囲んで `html` のコードブロックを 1 つ置く

````markdown
<!-- html -->

```html
<div style="display: flex; gap: 12px">
  <div style="padding: 12px; border: 1px solid currentColor">受け取り</div>
  <div style="padding: 12px; border: 1px solid currentColor">分類</div>
</div>
```

<!-- /html -->
````

範囲に置く `html` のコードブロックは 1 つだけ。
範囲のコードブロックの中身が、コードではなくその場の HTML として描かれる。
範囲のコードブロック以外の Markdown は、描いた文書に残らない。
範囲の外の `html` のコードブロックは、今のとおりコードとして出る。
GitHub のようにマーカーに対応しない表示では、マーカーが見えず、コードのまま読める。

#### 書いたスクリプトは動かない

埋め込んだ HTML の `<script>` 要素・`on` で始まる属性・`javascript:` の URL は落ちる。
`button` は残るが、押しても何も起きない。
`style` は、レイアウト・余白・枠・色・文字の宣言だけが残る。
残るものと落ちるものの一覧は HTML の書き方（read_guide の html-rules）。
動きは mdmark の部品だけが持つ。

幅が本文の列より広い HTML は、描いた枠の中で横にスクロールする。

### チャートを置く

#### custom element の中に定義を書く

````markdown
<!-- html -->

```html
<h3>窓口ごとの問い合わせの件数</h3>
<mdmark-chart>
{
  "type": "bar",
  "title": "窓口ごとの問い合わせの件数",
  "scope": "10 月の第 2 週",
  "updated": "2026-10-17",
  "x": { "label": "窓口", "ticks": ["メール", "フォーム", "チャット", "電話"] },
  "y": { "label": "件" },
  "series": [
    { "name": "自動返信", "points": [124, 86, 57, 12] },
    { "name": "担当者", "points": [38, 41, 63, 95] }
  ]
}
</mdmark-chart>
```

<!-- /html -->
````

`<mdmark-chart>` の中に、図を描く（read_guide の diagrams） の `chart` のマーカーの範囲と同じ定義（JSON）だけを書く。
`<mdmark-flow>`・`<mdmark-sequence>`・`<mdmark-param>` も同じで、それぞれ `flow`・`sequence`・`param` の定義を書く。
custom element の属性は読まない。
外部ライブラリは使わず、mdmark の部品が描く。

グラフは `type` で折れ線・棒・円・散布図を選ぶ。
書き方は 図を描く（read_guide の diagrams）、定義の項目は 図の部品（read_guide の notation）。

定義を読めないときは、その要素の場所だけが書き方の警告になり、同じ範囲のほかの HTML は描かれる。

### ヒントを書く

#### 要素に `data-hint` を書く

````markdown
<!-- html -->

```html
<div data-hint="返信の種類を 1 つ選ぶ。選べないときは担当者へ回す">分類の結果</div>
<p>問い合わせは <span data-hint="本文を読んで返信の種類を決める処理">分類</span> してから返す。</p>
```

<!-- /html -->
````

埋め込んだ HTML の任意の要素に `data-hint` を書くと、その文がツールチップで出る。
`data-hint` の値は Markdown として読まず、文字として出す。

| 要素 | マーカー | ツールチップが開く場所 |
| --- | --- | --- |
| ブロックの要素（`div`・`p` など） | 右上の情報のアイコン | アイコンの上だけ。要素の上では開かない |
| 行内の要素（`span`・`a`・`code` など） | 破線の下線 | 要素そのもの |

ポインターの形状は変わらない。
ホバーとフォーカスの両方で開き、Esc で閉じ、ツールチップの上に乗っても閉じない。
理解に必須のことは `data-hint` に入れず、要素の文字だけで読めるようにする。

部品の定義のノードの `hint` と `io`、線の `tip` も同じ見た目のツールチップで出る。
ツールチップを出したくないときは、設定の `features.hints` か文書の `<!-- features: -hints -->` でまとめて外す。
手順は [機能をオン・オフする](https://github.com/shuhei1101/mdmark/blob/v0.9.0/docs/使い方/カスタマイズ/機能をオン・オフする.md)。

### 用語を出す

埋め込んだ HTML の中の文章にも、本文と同じ用語の下線とツールチップが付く。
索引か用語集の表に用語を書く手順は 索引と用語集を書く（read_guide の glossary）。

### 読む人ができること

チャートは、図の部品と同じ右上のボタンとキーの `+`・`-`・`0` で拡大・縮小でき、ドラッグで動かせる。
ホイールは文書のスクロールに使う。
操作は 図を描く（read_guide の diagrams）。
チャートでない普通の HTML には、拡大・縮小のボタンを付けない。

## 反映

即時。`mount` と `update` で描くたびに、文書のマーカーから描き直す。
`render` が返す HTML 文字列にも、埋め込んだ HTML・チャート・ヒントのツールチップの中身が入る。

## 確認

#### HTML が描かれている

```js
document.querySelector(".mdmark .mdmark-html") !== null && document.querySelector(".mdmark pre code.language-html") === null
```

`true` が出る。
範囲のコードブロックの場所に、書いた HTML が要素として出ている。

#### スクリプトが動いていない

```js
document.querySelector(".mdmark .mdmark-html script") === null
```

`true` が出る。
書いた `<script>` の処理は実行されず、`button` を押しても何も起きない。

#### チャートが描かれている

```js
[...document.querySelectorAll(".mdmark .mdmark-html figure.mdmark-diagram")].map((f) => f.dataset.diagram)
```

書いた順に `chart` が出る。
チャートでない HTML の部分には、拡大・縮小のボタンが無い。

#### ヒントが出る

ブロックの要素の右上のアイコンにポインターを乗せるか、フォーカスする。
`data-hint` の文が出て、Esc で閉じる。
行内の要素は、下線の語にフォーカスすると出る。

#### 範囲の書き方を誤ったとき

`html` のコードブロックを 2 つ置いた範囲を描く。
範囲の上にタイトル `書き方の警告` の枠が出て、`<!-- html --> の範囲に html のコードブロックを 1 つだけ置いてください。` と書かれる。
範囲の 2 つのコードブロックはコードのまま出る。

見た目と操作は 描いた図を確かめる（read_guide の diagram-check） の手順で通す。

## 元に戻す

マーカーと HTML を削除する。
埋め込んだ HTML を描く機能ごと止めるときは、`features.html` をオフにする。
オフにするとマーカーを取り除き、コードブロックをコードのまま描く。
