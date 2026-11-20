// 言語が tree でない罫線のフォルダ構成のコードブロックを、今の描き方（記載の警告とコードブロック）と案（ファイルツリー）で並べる。
// 案の図は、同じ罫線を言語 tree のコードブロックに書き換えて配布物の mount で描き、ファイルツリーの帯をコードブロックの帯と同じ部品（クラス）に組み替える

import { mount } from "../../../../../dist/index.js";

const UNICODE_TREE = `mdmark/
├── src/
│   ├── index.ts
│   └── parts/
└── README.md`;

const ASCII_TREE = `src/
|-- index.ts
\`-- parts/`;

const ONE_LINE = `dist/
└── index.js`;

const BROKEN_TREE = `mdmark/
├── src/
│       └── deep.ts
└── README.md`;

const fence = (language, source) => ["```" + language, source, "```"].join("\n");

const markdown = [
  "# 言語が tree でない罫線のフォルダ構成のコードブロック",
  "",
  "同じ罫線を、今の描き方（記載の警告とコードブロック）と案（ファイルツリー）で並べた。案のファイルツリーの帯は、コードブロックの帯と同じ部品にしている。",
  "",
  "## 今（記載の警告とコードブロック）",
  "",
  fence("text", UNICODE_TREE),
  "",
  fence("", ASCII_TREE),
  "",
  "## 案（ファイルツリー。帯をコードブロックと共通にする）",
  "",
  "### 言語 text の罫線",
  "",
  `<div class="mock-to-tree">`,
  "",
  fence("text", UNICODE_TREE),
  "",
  "</div>",
  "",
  "### 言語なしの ASCII の罫線",
  "",
  `<div class="mock-to-tree">`,
  "",
  fence("", ASCII_TREE),
  "",
  "</div>",
  "",
  "### 見比べる言語 text のコードブロック（罫線の行が 1 行だけ。今のまま）",
  "",
  fence("text", ONE_LINE),
  "",
  "### 罫線を読み取れない行を持つ言語 text（今の言語 tree と同じ記載の警告）",
  "",
  fence("tree", BROKEN_TREE),
  "",
  "### ファイルツリーにしない指定を持つ言語 text（コードブロックのまま）",
  "",
  '<!-- code: {"tree_warning": false} -->',
  "",
  fence("text", UNICODE_TREE),
].join("\n");

/** 案の見出しの下のコードブロックを、言語 tree のコードブロックに書き換える（モックだけの読み替え） */
const toTreeFences = (source) =>
  source.replace(
    /<div class="mock-to-tree">\n\n```[^\n]*\n([\s\S]*?)\n```\n\n<\/div>/g,
    (_, body) => fence("tree", body),
  );

/** 罫線を読み取れない言語 tree のブロック: 案では読み取れない行の記載の警告だけを出すため、今の配布物が重ねて出す言語の警告を除く（モックだけの再現） */
const relabelBroken = (root) => {
  const pre = [...root.querySelectorAll("pre")].find((el) =>
    el.textContent.includes("deep.ts"),
  );
  if (!pre) return;
  pre.setAttribute("aria-label", "コード: text");
  const label = pre.parentElement?.querySelector(".mdmark-code-lang-name");
  if (label && label.textContent !== "text") label.textContent = "text";
  for (const warning of root.querySelectorAll(".mdmark-syntax-warning")) {
    if (
      warning.textContent.includes("言語 tree のコードブロックに、罫線のフォルダ構成があります")
    ) {
      warning.remove();
    }
  }
};

/** ファイルツリーの帯を、コードブロックの帯と同じクラスの組み立てにする（案: 帯を共通の部品にする） */
const unifyBars = (root) => {
  for (const bar of root.querySelectorAll(".mdmark-tree-bar")) {
    bar.classList.add("mdmark-code-bar");
    const kind = bar.querySelector(".mdmark-tree-kind");
    if (kind) {
      kind.className = "mdmark-code-lang";
      kind.innerHTML = `<span class="mdmark-code-lang-name" aria-hidden="true">tree</span>`;
    }
    bar.querySelector(".mdmark-tree-meta")?.classList.add("mdmark-code-meta");
    bar.querySelector(".mdmark-tree-copy")?.classList.add("mdmark-code-copy");
  }
};

const root = document.getElementById("doc");
mount(root, { markdown: toTreeFences(markdown) });
const observer = new MutationObserver(() => {
  unifyBars(root);
  relabelBroken(root);
});
observer.observe(root, { childList: true, subtree: true });
unifyBars(root);
relabelBroken(root);
