# block の mermaid の公式の記法の例

mermaid 12.3.0 の公式ドキュメント（`docs/syntax/`）の `mermaid-example` のコードブロックのうち、図の種類が `block` のものを、そのまま並べた見本。

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
columns 1
  db(("DB"))
  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)
  block:ID
    A
    B["A wide one in the middle"]
    C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#969,stroke:#333,stroke-width:4px
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  a b c
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  a b c d
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  a["A label"] b:2 c:2 d
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    block
      D
    end
    A["A: I am a wide one"]
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  a:3
  block:group1:2
    columns 2
    h i j k
  end
  g
  block:group2:3
    %% columns auto (default)
    l m n o p q r
  end
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  block
    columns 1
    a["A label"] b c d
  end
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1("This is the text in the box")
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1(["This is the text in the box"])
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1[["This is the text in the box"]]
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1[("Database")]
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1(("This is the text in the circle"))
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  id1>"This is the text in the box"]
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1{"This is the text in the box"}
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1{{"This is the text in the box"}}
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  id1[/"This is the text in the box"/]
  id2[\"This is the text in the box"\]
  A[/"Christmas"\]
  B[\"Go shopping"/]
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
    id1((("This is the text in the circle")))
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  blockArrowId<["Label"]>(right)
  blockArrowId2<["Label"]>(left)
  blockArrowId3<["Label"]>(up)
  blockArrowId4<["Label"]>(down)
  blockArrowId5<["Label"]>(x)
  blockArrowId6<["Label"]>(y)
  blockArrowId7<["Label"]>(x, down)
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  a space b
  c   d   e
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  ida space:3 idb idc
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  A space B
  A-->B
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  A space:2 B
  A-- "X" -->B
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
columns 1
  db(("DB"))
  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)
  block:ID
    A
    B["A wide one in the middle"]
    C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#939,stroke:#333,stroke-width:4px
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  id1 space id2
  id1("Start")-->id2("Stop")
  style id1 fill:#636,stroke:#333,stroke-width:4px
  style id2 fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  A space B
  A-->B
  classDef blue fill:#6e6ce6,stroke:#333,stroke-width:4px;
  class A blue
  style B fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  Frontend blockArrowId6<[" "]>(right) Backend
  space:2 down<[" "]>(down)
  Disk left<[" "]>(left) Database[("Database")]

  classDef front fill:#696,stroke:#333;
  classDef back fill:#969,stroke:#333;
  class Frontend front
  class Backend,Database back
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  columns 3
  Start(("Start")) space:2
  down<[" "]>(down) space:2
  Decision{{"Make Decision"}} right<["Yes"]>(right) Process1["Process A"]
  downAgain<["No"]>(down) space r3<["Done"]>(down)
  Process2["Process B"] r2<["Done"]>(right) End(("End"))

  style Start fill:#969;
  style End fill:#696;
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  A space B
  A --> B
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
  block
    A
    style A fill#969;
```

<!-- 出典: docs/syntax/block.md -->

```mermaid
block
  A
  style A fill:#969,stroke:#333;
```
