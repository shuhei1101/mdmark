# PoC の見本

## 表

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

## 注意書き

> [!NOTE]
> 注意書きの本文。

## フロー図

<!-- flow -->

```json
{
  "title": "受け取りから返信まで",
  "scope": "PoC の見本",
  "updated": "2026-10-23",
  "width": 640,
  "height": 260,
  "frame": { "title": "窓口", "x": 140, "y": 20, "w": 360, "h": 220 },
  "lanes": [
    { "label": "処理", "kind": "mcp", "y": 56, "h": 160 }
  ],
  "nodes": [
    { "id": "mail", "kind": "external", "x": 12, "y": 100, "w": 116, "h": 64, "tag": "外部", "name": "メールサーバー" },
    { "id": "recv", "kind": "script", "x": 170, "y": 100, "w": 140, "h": 64, "name": "受け取り", "hint": "1 通ずつ読む" },
    { "id": "send", "kind": "script", "x": 340, "y": 100, "w": 140, "h": 64, "name": "送信" }
  ],
  "wires": [
    { "id": "w1", "from": "mail", "to": "recv", "line": "flow", "points": [[128, 132], [170, 132]], "label": "メール", "labelAt": [149, 132] },
    { "id": "w2", "from": "recv", "to": "send", "line": "flow", "points": [[310, 132], [340, 132]], "label": "本文", "labelAt": [325, 132] }
  ]
}
```

<!-- /flow -->

## シーケンス図

<!-- sequence -->

```json
{
  "title": "1 通の流れ",
  "scope": "PoC の見本",
  "updated": "2026-10-23",
  "participants": [
    { "id": "mail", "kind": "external", "tag": "外部", "name": "メールサーバー" },
    { "id": "recv", "kind": "script", "name": "受け取り" }
  ],
  "steps": [
    { "from": "mail", "to": "recv", "label": "問い合わせのメール" },
    { "from": "recv", "to": "mail", "label": "受け取った", "reply": true }
  ]
}
```

<!-- /sequence -->

## 埋め込んだ HTML

<!-- html -->

```html
<div data-hint="返信の種類を 1 つ選ぶ">分類の結果</div>
<p>問い合わせは <span data-hint="本文を読んで返信の種類を決める処理">分類</span> してから返す。</p>
<div style="display: flex; gap: 12px"><div style="padding: 12px; border: 1px solid currentColor">受け取り</div></div>
```

<!-- /html -->

## 自作の図

<!-- poc-lib: a b -->
