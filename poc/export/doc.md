# 色分けの検証

```ts
const count: number = 1; // 数える
```

```yaml
features:
  code: true
```

```python
def greet(name: str) -> str:
    return f"hello {name}"
```

<!-- code: title=app.ts -->
```ts
import { mount } from "mdmark";
```

<!-- code: lines highlight=2 -->
```ts
let count = 0; // [!code --]
let count = 1; // [!code ++]
console.log(count);
```

<!-- code: lines -->
```ts
/* 1 行目
   2 行目
   3 行目 */
const text = `a
b`;
```

<!-- code: lines -->
```python
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
