# flowchart の mermaid の公式の記法の例

mermaid 12.3.0 の公式ドキュメント（`docs/syntax/`）の `mermaid-example` のコードブロックのうち、図の種類が `flowchart` のものを、そのまま並べた見本。

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
title: Node
---
flowchart LR
    id
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
title: Node with text
---
flowchart LR
    id1[This is the text in the box]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id["This ❤ Unicode"]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
config:
  htmlLabels: false
---
flowchart LR
    markdown["`This **is** _Markdown_`"]
    newLines["`Line1
    Line 2
    Line 3`"]
    markdown --> newLines
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    Start --> Stop
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    Start --> Stop
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  subgraph Client
    UI[Web app]
    Cache[(Local cache)]
  end
  subgraph Services
    API[API gateway]
    Auth[Auth service]
    Orders[Order service]
  end
  subgraph Storage
    DB[(Orders DB)]
  end
  UI --> API
  UI --> Cache
  API --> Auth
  API --> Orders
  Orders --> DB
  Auth -. token .-> UI
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
config:
  theme: default
  look: classic
  layout: dagre
---
flowchart LR
  subgraph Client
    UI[Web app]
    Cache[(Local cache)]
  end
  subgraph Services
    API[API gateway]
    Auth[Auth service]
    Orders[Order service]
  end
  subgraph Storage
    DB[(Orders DB)]
  end
  UI --> API
  UI --> Cache
  API --> Auth
  API --> Orders
  Orders --> DB
  Auth -. token .-> UI
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1(This is the text in the box)
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1([This is the text in the box])
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1[[This is the text in the box]]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1[(Database)]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1((This is the text in the circle))
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1>This is the text in the box]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1{This is the text in the box}
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1{{This is the text in the box}}
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    id1[/This is the text in the box/]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    id1[\This is the text in the box\]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A[/Christmas\]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    B[\Go shopping/]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    id1(((This is the text in the circle)))
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart RL
    A@{ shape: manual-file, label: "File Handling"}
    B@{ shape: manual-input, label: "User Input"}
    C@{ shape: docs, label: "Multiple Documents"}
    D@{ shape: procs, label: "Process Automation"}
    E@{ shape: paper-tape, label: "Paper Records"}
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: rect, label: "This is a process" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: rounded, label: "This is an event" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: stadium, label: "Terminal point" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: subproc, label: "This is a subprocess" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: cyl, label: "Database" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: circle, label: "Start" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: odd, label: "Odd shape" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: diamond, label: "Decision" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: hex, label: "Prepare conditional" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: lean-r, label: "Input/Output" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: lean-l, label: "Output/Input" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: datastore, label: "Datastore" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: trap-b, label: "Priority action" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: trap-t, label: "Manual operation" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: dbl-circ, label: "Stop" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: text, label: "This is a text block" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: notch-rect, label: "Card" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: lin-rect, label: "Lined process" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: sm-circ, label: "Small start" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: framed-circle, label: "Stop" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: fork, label: "Fork or Join" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: hourglass, label: "Collate" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: comment, label: "Comment" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: brace-r, label: "Comment" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: braces, label: "Comment" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: bolt, label: "Communication link" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: doc, label: "Document" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: delay, label: "Delay" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: das, label: "Direct access storage" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: lin-cyl, label: "Disk storage" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: curv-trap, label: "Display" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: div-rect, label: "Divided process" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: tri, label: "Extract" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: win-pane, label: "Internal storage" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: f-circ, label: "Junction" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: lin-doc, label: "Lined document" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: notch-pent, label: "Loop limit" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: flip-tri, label: "Manual file" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: sl-rect, label: "Manual input" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: docs, label: "Multiple documents" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: processes, label: "Multiple processes" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: flag, label: "Paper tape" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: bow-rect, label: "Stored data" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: cross-circ, label: "Summary" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: tag-doc, label: "Tagged document" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ shape: tag-rect, label: "Tagged process" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A@{ icon: "fa:user", form: "square", label: "User Icon", pos: "t", h: 60 }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
  %% My image with a constrained aspect ratio
  A@{ img: "https://mermaid.js.org/favicon.svg", label: "My example image label", pos: "t", h: 60, constraint: "on" }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-->B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A --- B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-- This is the text! ---B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A---|This is the text|B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-->|text|B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-- text -->B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   A-.->B;
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   A-. text .-> B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   A ==> B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   A == text ==> B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A ~~~ B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   A -- text --> B -- text2 --> C
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
   a --> b & c--> d
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TB
    A & B--> C & D
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TB
    A --> C
    A --> D
    B --> C
    B --> D
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  A e1@--> B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  A e1@==> B
  e1@{ animate: true }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  A e1@--> B
  e1@{ animation: fast }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  A e1@--> B
  classDef animate stroke-dasharray: 9,5,stroke-dashoffset: 900,animation: dash 25s linear infinite;
  class e1 animate
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  Client e1@--> API
  API e2@--> Cache
  Cache e3@-->|miss| DB
  DB e4@--> API
  API e5@--> Client
  e1@{ step: 1 }
  e2@{ step: 2 }
  e3@{ step: 3 }
  e4@{ step: 4 }
  e5@{ step: 5 }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
config:
  flowchart:
    stepDuration: 0.5
---
flowchart LR
  Client e1@--> API
  API e2@--> Client
  e1@{ step: 1 }
  e2@{ step: 2 }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A --o B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A --x B
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A o--o B
    B <--> C
    C x--x D
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B ---->|No| E[End]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    C --> D[Rethink]
    D --> B
    B -- No ----> E[End]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1["This is the (text) in the box"]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
    flowchart LR
        A["A double quote:#quot;"] --> B["A dec char:#9829;"]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TB
    c1-->a2
    subgraph one
    a1-->a2
    end
    subgraph two
    b1-->b2
    end
    subgraph three
    c1-->c2
    end
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TB
    c1-->a2
    subgraph ide1 [one]
    a1-->a2
    end
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TB
    c1-->a2
    subgraph one
    a1-->a2
    end
    subgraph two
    b1-->b2
    end
    subgraph three
    c1-->c2
    end
    one --> two
    three --> two
    two --> c2
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
  subgraph TOP
    direction TB
    subgraph B1
        direction RL
        i1 -->f1
    end
    subgraph B2
        direction BT
        i2 -->f2
    end
  end
  A --> TOP --> B
  B1 --> B2
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    subgraph subgraph1
        direction TB
        top1[top] --> bottom1[bottom]
    end
    subgraph subgraph2
        direction TB
        top2[top] --> bottom2[bottom]
    end
    %% ^ These subgraphs are identical, except for the links to them:

    %% Link *to* subgraph1: subgraph1 direction is maintained
    outside --> subgraph1
    %% Link *within* subgraph2:
    %% subgraph2 inherits the direction of the top-level graph (LR)
    outside ---> top2
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    Start --> one
    subgraph one [My Group]
        A --> B
        B --> C
    end
    one --> End
    one@{ view: collapsed }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
---
config:
  htmlLabels: false
---
flowchart LR
subgraph "One"
  a("`The **cat**
  in the hat`") -- "edge label" --> b{{"`The **dog** in the hog`"}}
end
subgraph "`**Two**`"
  c("`The **cat**
  in the hat`") -- "`Bold **edge label**`" --> d("The dog in the hog")
end
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-->B
    B-->C
    C-->D
    click A callback "Tooltip for a callback"
    click B "https://www.github.com" "This is a tooltip for a link"
    click C call callback() "Tooltip for a callback"
    click D href "https://www.github.com" "This is a tooltip for a link"
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A-->B
    B-->C
    C-->D
    D-->E
    click A "https://www.github.com" _blank
    click B "https://www.github.com" "Open this in a new tab" _blank
    click C href "https://www.github.com" _blank
    click D href "https://www.github.com" "Open this in a new tab" _blank
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
%% this is a comment A -- text --> B{node}
   A -- text --> B -- text2 --> C
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A e1@==> B
    A e2@--> C
    e1@{ curve: linear }
    e2@{ curve: natural }
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    id1(Start)-->id2(Stop)
    style id1 fill:#f9f,stroke:#333,stroke-width:4px
    style id2 fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A:::someclass --> B
    classDef someclass fill:#f96
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A:::foo & B:::bar --> C:::foobar
    classDef foo stroke:#f00
    classDef bar stroke:#0f0
    classDef foobar stroke:#00f
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A:::myStyle --> B
    classDef myStyle fill:#ff0000,stroke:#ffff00,stroke-width:4px
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    B["fa:fa-twitter for peace"]
    B-->C[fa:fa-ban forbidden]
    B-->D(fa:fa-spinner)
    B-->E(A fa:fa-camera-retro perhaps?)
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart TD
    B["fa:fa-twitter for peace"]
    B-->C["fab:fa-truck-bold a custom icon"]
```

<!-- 出典: docs/syntax/flowchart.md -->

```mermaid
flowchart LR
    A[Hard edge] -->|Link text| B(Round edge)
    B --> C{Decision}
    C -->|One| D[Result one]
    C -->|Two| E[Result two]
```
