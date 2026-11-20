# mindmap の mermaid の公式の記法の例

mermaid 12.3.0 の公式ドキュメント（`docs/syntax/`）の `mermaid-example` のコードブロックのうち、図の種類が `mindmap` のものを、そのまま並べた見本。

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping
    Tools
      Pen and paper
      Mermaid
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
Root
    A
      B
      C
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id[I am a square]
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id(I am a rounded square)
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id((I am a circle))
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id))I am a bang((
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id)I am a cloud(
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id{{I am a hexagon}}
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    I am the default shape
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
---
config:
  mindmap:
    colorBy: depth
---
mindmap
  root((mindmap))
    origins{{Origins}}
      history[Long history]
        Popularisation
        British popular psychology author Tony Buzan
    research{{Research}}
      uses[Uses]
        Creative techniques
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
---
config:
  theme: base
  mindmap:
    colorBy: depth
  themeVariables:
    git0: '#374151'
    gitBranchLabel0: '#ffffff'
    cScaleLabel0: '#ffffff'
    cScale1: '#bfdbfe'
    cScaleLabel1: '#172554'
    cScale2: '#bbf7d0'
    cScaleLabel2: '#14532d'
    cScale3: '#fde68a'
    cScaleLabel3: '#451a03'
---
mindmap
  root((mindmap))
    origins{{Origins}}
      history[Long history]
        Popularisation
        British popular psychology author Tony Buzan
    research{{Research}}
      uses[Uses]
        Creative techniques
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    Root
        A
        ::icon(fa fa-book)
        B(B)
        ::icon(mdi mdi-skull-outline)
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    Root
        A[A]
        :::urgent large
        B(B)
        C
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
Root
    A
        B
      C
```

<!-- 出典: docs/syntax/mindmap.md -->

```mermaid
mindmap
    id1["`**Root** with
a second line
Unicode works too: 🤓`"]
      id2["`The dog in **the** hog... a *very long text* that wraps to a new line`"]
      id3[Regular labels still works]
```
