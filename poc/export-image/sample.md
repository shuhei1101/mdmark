# 書き出しの PoC

<!-- map: {"title": "全体の構成"} -->

```mermaid
flowchart LR
  user(["利用側のページ"]):::outside
  subgraph lib [mdmark]
    direction LR
    mount["mount"]:::step
    subgraph read [記法の読み取り]
      direction TB
      marker["マーカーの読み取りと範囲の切り出しを行う長い名前のノード"]:::step
      data["補足の検査"]:::step
    end
    subgraph store [保存先]
      direction TB
      cache[("キャッシュ")]:::store
      state["状態"]:::store
    end
  end
  user -->|設定と Markdown| mount
  mount --> marker
  marker --> data
  data --> cache
  mount --> state
```

<!-- map-data: {"version": 1, "notes": {"data": {"text": "補足を検査する"}}, "layout": {"store": {"collapsed": true}, "read": {"color": "blue"}}} -->

<!-- /map -->
