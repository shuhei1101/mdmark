# Mermaidと補足で図を描く

map のマーカー・Mermaid のブロック・補足の記載方法と、配置と色の上書き・案内・再生の書き方の手順

座標を記載せずに構成図とシーケンス図を描き、読者にグループの中へ入る・開閉・案内・再生で辿らせるときに実行する。

## 前提

- [文書を描く](./導入-文書を描く.md)
- 設定の `features.map` がオン（既定）。オフにする手順は [機能をオン・オフする](./カスタマイズ-機能をオン・オフする.md)

## 手順

### map の範囲に Mermaid を記載する

````markdown
<!-- map: {"title": "全体の構成"} -->

```mermaid
flowchart LR
  user(["利用側のページ"]):::outside
  subgraph lib [mdmark]
    direction LR
    mount["mount"]:::step
    subgraph read [記法の読み取り]
      direction TB
      marker["マーカーの読み取り"]:::step
      data["補足の検査"]:::step
    end
  end
  user -->|設定と Markdown| mount
  mount --> marker
  marker --> data
```

<!-- /map -->
````

`<!-- map -->` 〜 `<!-- /map -->` の範囲の `mermaid` のブロックが、座標を記載しなくても自動で配置した図になる。
`subgraph` はグループになり、入れ子の内側から配置する。
描くのは Mermaid の 1 行目が `flowchart`・`sequenceDiagram`・`erDiagram`・`stateDiagram-v2`（`stateDiagram`）の図。
グループの分け方は [構成図の決まり](./構成図の決まり.md#グループにするかの判定) の判定フローチャートで決める。
マーカーの引数（`title`・`focus`・`play`・`interval`・`collapse`）は [map の引数](./記法.md#map)。

### ノードと線の種類を設定で作る

```yaml
map:
  kinds:
    step: { label: 処理, icon: cog, shape: rounded }
    store: { label: 保存先, icon: database, shape: rect, color: purple }
    outside: { label: 外部, icon: globe, shape: pill, color: green }
  lines:
    "-.->": { dash: dashed, head: open }
    back: { dash: dotted, head: open }
```

mdmark はノードの種類と線の種類を持たない。
`map.kinds` に Mermaid のクラス名（`:::step`）ごとの種類の名前・アイコン・形状・色を、`map.lines` に矢印ごとと名前ごとの模様・太さ・矢じり・色を記載する。
クラスを付けないノードは種類の行を空にし、設定の無い矢印は実線で描く。
キーの一覧は [map の設定](./設定.md#map-の設定)。

### 補足で説明・案内・上書きを付ける

```markdown
<!-- map-data: {
  "version": 1,
  "notes": {"data": {"text": "version と機能ごとのキーをスキーマで検査する"}},
  "walkthroughs": [
    {"title": "mount に渡す", "text": "設定と Markdown を mount に渡す", "nodes": ["user", "mount"]},
    {"title": "補足を検査する", "text": "記法の読み取りの中で補足を検査する", "nodes": ["marker", "data"], "enter": "read"}
  ],
  "layout": {
    "read": {"color": "blue"},
    "mount->marker": {"packet": {"color": "source", "shape": "diamond"}},
    "data": {"justify": "start"}
  }
} -->
```

補足は範囲の中に `<!-- map-data: {JSON のオブジェクト} -->` で 1 つ記載する。

| キー | 付くもの |
| --- | --- |
| `notes` | ノード・線・グループのタイトルのマーカーにポインターを当てたときのツールチップと、再生の帯の説明 |
| `walkthroughs` | 図の下の帯で前へ・次へ・自動で進める案内。手順ごとにノードを強調し、強調するノードどうしの線にデータの印を流す |
| `layout` | ノード・グループ・線の ID ごとの色・並び・寄せ方・座標・幅・最初に閉じるか・線の種類・データの印・線の端の辺・経由点 |

上書きの無い部分は自動の配置のまま。
文字の値に `--` を含めない（HTML コメントを閉じてしまう）。
キーの一覧は [補足のキー](./記法.md#補足のキー)。

### ノードにリンク先を持たせる

`flowchart` に `click {ID} "{リンク先}"` の行を記載すると、そのノードの全体がリンクになる。

```mermaid
flowchart LR
  spec[仕様]
  click spec "https://example.com/spec"
```

リンク先は `http`・`https`・`mailto` と相対パスだけ。ほかのリンク先は図の前に記載の警告が出て、そのノードはリンクにならない。

### 座標で記載した図を map へ書き換える

廃止した `flow`・`sequence` の範囲は、`mdmark upgrade` が map の範囲へ書き換える（[バージョンを上げる](./導入-バージョンを上げる.md)）。
システムの枠と層は入れ子の `subgraph`、ノードの種類は Mermaid のクラス、`flow` 以外の線の種類は補足の `layout` の `line`、ノードの `sub`・`io`・`hint` と線の `tip` は補足の `notes` になり、使用していた種類は設定の `map.kinds`・`map.lines` に書き足される。
範囲と更新日と `stickyTitles` は写さず、移行の報告に挙がる。

### シーケンス図を構成図の上で再生する

````markdown
<!-- map: {"title": "描くまでの流れ", "interval": 3} -->

```mermaid
sequenceDiagram
  participant user as 利用側のページ
  participant mount as mount
  user->>+mount: 設定と Markdown
  loop map の範囲ごと
    mount->>mount: 図にする
  end
  mount-->>-user: 描いた文書
```

<!-- map-data: {"version": 1, "plays_over": 1, "notes": {"1": {"text": "map の範囲の Markdown と印の引数"}}} -->

<!-- /map -->
````

図の下の帯でメッセージを 1 通ずつ進め、`plays_over` で指した構成図（文書の中の map の番号）の、同じ ID のノードの上でも強調する。
`rect` の直前に `%% block: 名前` を記載すると、名前の無いブロックに名前を付けられる。

### ER 図を描く

````markdown
<!-- map: {"title": "記録の構造"} -->

```mermaid
erDiagram
  顧客 {
    int id PK
    string メール UK "ログインに使用する"
  }
  注文 {
    int id PK
    int 顧客ID FK "参照: 顧客.id"
  }
  顧客 ||--o{ 注文 : "注文する"
```

<!-- map-data: {"version": 1, "notes": {"注文.顧客ID": {"text": "注文した顧客"}, "r1": {"text": "顧客 1 人が注文を 0 件以上持つ"}}, "groups": {"記録": {"title": "記録", "tables": ["注文"]}}} -->

<!-- /map -->
````

テーブルは列の行（キー・名前・型）を持つノードになり、関連の線は FK の列の行から引き、両端に多重度を出す。
関連の端につなぐ列は、コメントが `参照: {テーブル}.{列}` の FK の列、相手のテーブル名で始まる名前の FK の列、PK の列の順に選ぶ。
補足の `groups` で、テーブルを分類のグループにまとめる。
補足の ID は、テーブル名・`{テーブル}.{列}`・関連の記載順の `r{番号}`。

### 状態遷移図を描く

````markdown
<!-- map: {"title": "作業の状態"} -->

```mermaid
stateDiagram-v2
  [*] --> 下書き
  下書き --> 下書き : 保存する
  下書き --> 実行中 : 提出する
  state 実行中 {
    [*] --> 処理
    処理 --> [*]
  }
  実行中 --> [*]
  note right of 下書き : 担当者が編集する
```

<!-- map-data: {"version": 1, "notes": {"t3": {"text": "提出すると編集できない"}}} -->

<!-- /map -->
````

開始は黒丸、終了は二重丸、`<<choice>>` はひし形、入れ子の状態はグループ、`note` は破線でつないだノートのノードになる。
入れ子の状態そのものへの遷移は中の開始へつなぎ、中に `[*]` が無ければ開始・終了を補う。
補足に `walkthroughs` が無いときは、図の下の帯で遷移を記載順に 1 本ずつ再生する。
補足の ID は、状態の ID・遷移の記載順の `t{番号}`。

### 読者ができること

| 操作 | 結果 |
| --- | --- |
| グループのタイトルを押す | そのグループの中だけを配置し直し、外を薄く残す。右上の戻るボタンか Esc で外へ戻る |
| 開閉のボタンを押す | グループを閉じて 1 つのノードにし、中への線を 1 本にまとめる。Shift を押すと中のグループもまとめて開閉する |
| ノード・線を押す | そのノードと線のほかを薄くし、線にデータの印を流す |
| ノード・グループのタイトルの行・線の区間をドラッグする | 位置を変える。右上の「配置と選択を元に戻す」で自動の配置に戻す |
| 帯の前へ・自動で進める・次へを押す | 案内・再生を進める。状態遷移図は遷移を 1 本ずつ進める |
| ER 図のテーブルの開閉のボタンを押す | 列を閉じて、テーブル名と列の数の 1 行にする |
| ER 図のテーブルを 2 つ押す | 2 つをつなぐ最短の経路を全て残し、1 の側から多の側へたどる関連に「×n」のマーカーを付ける。マーカーにフォーカスすると、行が増える理由を出す |
| 状態遷移図の状態を押す | その状態に入る遷移と出る遷移のほかを薄くする |

中へ入った状態と開閉は同じタブの中で描き直しても保ち、中へ入ったグループは URL のクエリ文字列 `map-{図の番号}` にも保つ。
拡大・縮小・全画面・リサイズハンドルは [図を描く](./図を描く-図を描く.md#読者ができること) と同じ。

## 反映

即時。`mount` と `update` で描くたびに、map の範囲から配置し直す。
`render` が返却する HTML 文字列は図にせず、Mermaid のソースのコードブロックのまま返却する。

## 確認

#### 図が描かれている

```js
[...document.querySelectorAll(".mdmark figure.mdmark-diagram")].map((f) => f.dataset.diagram)
```

記載した順に `map` が出る。

#### 記載方法を誤ったとき

Mermaid の読めない行・補足の誤り・補足が指す無い ID・設定に無いクラスと線の名前は、図の上の `記載の警告` のブロックに修正方法つきで並び、読めた部分を図にする。
`mdmark check` は、同じ誤りとマーカーの知らないキーを `map_*` のずれで返却する（[点検する](./書き出す-点検する.md)）。

外観と操作は [描いた図を確認する](./図を描く-描いた図を確認する.md) の手順で確認する。

## 元に戻す

範囲のマーカーと補足を削除する。`mermaid` のブロックは mermaid のコードブロックとして描かれる。
map の図を描く機能ごと止めるときは、`features.map` をオフにする。
