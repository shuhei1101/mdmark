# 色分けの検証

```text
const count: number = 1; // 数える
```

```text
features:
  code: true
```

```text
def greet(name: str) -> str:
    return f"hello {name}"
```

<!-- code: title=app.ts -->
```text
import { mount } from "mdmark";
```

<!-- code: lines highlight=2 -->
```text
let count = 0; // [!code --]
let count = 1; // [!code ++]
console.log(count);
```

<!-- code: lines -->
```text
/* 1 行目
   2 行目
   3 行目 */
const text = `a
b`;
```

<!-- code: lines -->
```text
doc = """1 行目
2 行目
3 行目"""
```

```tree
src/
└── index.ts
```

```rust
fn main() { println!("hi"); }
```
