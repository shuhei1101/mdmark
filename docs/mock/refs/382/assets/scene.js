// mermaid のコードブロックを持つ文書を見る場面: 配布物の mount で文書を描き、mermaid のコードブロックを #382 の案の図の枠に替える。
// URL の ?scheme= で明暗（light・dark）を選ぶ

import { mount } from "../../../../../dist/index.js";

/** 明暗の既定（URL に無いときの値） */
const DEFAULT_SCHEME = "light";

const params = new URLSearchParams(location.search);
const scheme = params.get("scheme") ?? DEFAULT_SCHEME;

// 操作列のリンク: 今の明暗を押された見た目にする
for (const link of document.querySelectorAll("[data-scene-scheme]")) {
  const value = link.dataset.sceneScheme;
  link.href = value === DEFAULT_SCHEME ? "index.html" : `?scheme=${value}`;
  if (value === scheme) link.setAttribute("aria-current", "page");
}

const markdown = `# 問い合わせの受付

問い合わせを受けてから、担当へ回すか一次回答を返すまでの流れ。
ほかのツールで記載した mermaid のコードブロックを、そのまま図にしている。

\`\`\`mermaid
---
title: 問い合わせの受付
---
flowchart LR
  A[問い合わせを受ける] --> B{担当がいるか}
  B -->|いる| C[担当へ回す]
  B -->|いない| D[一次回答を返す]
  C --> E[(記録)]
  D --> E
\`\`\`

## やり取り

読む人が文書を開いてから、図が表示されるまで。

\`\`\`mermaid
sequenceDiagram
  actor U as 読む人
  participant P as 使う側のページ
  participant M as mdmark
  U->>P: ページを開く
  P->>M: 設定と Markdown を渡す
  Note right of M: mermaid のコードブロックを図にする
  M-->>U: 文書を表示
\`\`\`

## 設定

テーマを変えるときの設定。

\`\`\`ts
const config = { mermaid: { theme: "mdmark" } };
\`\`\`
`;

const doc = document.getElementById("doc");
// 明暗: 描く先の祖先（body）の class で決める
document.body.classList.add(scheme === "dark" ? "mdmark-theme-dark" : "mdmark-theme-light");
mount(doc, { markdown });

// mount が描いた mermaid のコードブロックを、mermaid.js が描く pre に替える
for (const code of doc.querySelectorAll("code.language-mermaid")) {
  const block = code.closest(".mdmark-code") ?? code.closest("pre");
  const pre = document.createElement("pre");
  pre.dataset.mockMermaid = "";
  pre.textContent = code.textContent;
  block.replaceWith(pre);
}

await import("./mermaid.js");
