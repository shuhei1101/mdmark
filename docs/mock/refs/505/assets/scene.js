// #505 の文書の場面: 配布物の mount で、表とコードブロックを持つ文書を描く先の要素の幅いっぱいに描く。
// 表の列の幅は table-width.js（後に読む）が、コードブロックの帯と開閉のボタンの位置は code-block.css が当てる。
// URL の ?scheme= で明暗（light・dark）を選ぶ

import { mount } from "../../../../../dist/index.js";

/** 明暗の既定（URL に無いときの値） */
const DEFAULT_SCHEME = "light";

const scheme = new URLSearchParams(location.search).get("scheme") ?? DEFAULT_SCHEME;
for (const link of document.querySelectorAll("[data-scene-scheme]")) {
  link.href = link.dataset.sceneScheme === DEFAULT_SCHEME ? "index.html" : `?scheme=${link.dataset.sceneScheme}`;
  if (link.dataset.sceneScheme === scheme) link.setAttribute("aria-current", "page");
}

const long =
  "表の列の幅は、指定が無くても列ごとにセルの文字の量と改行の有無から決める。長文の列だけを折り返し、表を本文の幅いっぱいまで広げて、なるべく横幅を使う。短い値の列は折り返さず、最も長い行の幅にする。";
const short = "備考の列は 20 文字ほどの短めの長文にあたる文です";

const markdown = `# 表とコードブロックの見え方

## 列の幅を決める値（モックで使用した値）

| 値 | 長文の列 | 長文でない列 |
| --- | --- | --- |
| 判定 | 改行で分けた 1 行が 20 文字以上のセルを 1 つでも持つ列 | それ以外の列（数値・日付・バッジ・行内のコードだけの列を含む） |
| 折り返すか | 折り返す | 折り返さない |
| 最小の幅 | 30em（列の中の最も長い半角の単語の方が広ければその幅） | 最も長い行の幅 |
| 最大の幅 | 持たない（本文の幅いっぱいまで。折り返さずに収まるなら、最も長い行の幅で止める） | 最も長い行の幅 |
| 表の幅 | 全ての列の最小の幅の合計が本文の幅を超えたら、最小の幅で描いて表の中で横にスクロールする | 同じ |

\`columns.{列名}.width\` の \`min\`・\`max\`（em）を記載した列は、その値を最小の幅・最大の幅にする。各表の下の小さい文字は、モックだけの列ごとの内訳。

## 列の幅を中身から決める

長文の説明の列だけを折り返し、表を本文の幅いっぱいまで広げる。

| No | 状態 | 更新日 | 名前 | 手順 | 説明 |
| --- | --- | --- | --- | --- | --- |
| 1 | \`badge:完了\` | 2026-11-01 | 列の幅 | 列を測る<br>幅を配る<br>折り返す | ${long} |
| 2 | \`badge:作業中\` | 2026-11-05 | 見える幅 | 幅を見張る<br>判定し直す<br>描き直す | ${long} |
| 10 | \`badge:未着手\` | 2026-11-12 | 表の幅 | 合計を取る<br>枠を描く | ${long} |

## 余白の多い表

| 名前 | 数量 |
| --- | --- |
| りんご | 10 |
| みかん | 2 |
| ぶどう | 33 |

## 長文の列が折り返さずに収まる表

| 名前 | 説明 |
| --- | --- |
| 列の幅 | 列ごとにセルの文字の量と改行の有無から決める |
| 表の幅 | 収まる表は本文の幅まで広げずに列の幅で描く |

## 長文の列が 2 つある表

| 名前 | 説明 | 備考 |
| --- | --- | --- |
| 列の幅 | ${long} | ${short} |
| 表の幅 | ${long} | ${short} |

## 最小の幅の合計が収まらない表（横にスクロールする）

長文の列が 4 つあり、1280px の画面でも最小の幅の合計が収まらないので、表は描く先の幅の端まで広がり、表の中で横にスクロールする。

| 名前 | 説明 | 備考 | 手順の詳細 | 確認の方法 | 列 6 | 列 7 | 列 8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 列の幅 | ${long} | ${long} | ${long} | ${long} | 1-6 | 1-7 | 1-8 |
| 表の幅 | ${long} | ${long} | ${long} | ${long} | 2-6 | 2-7 | 2-8 |

## コードブロック

\`\`\`bash
npx mdmark check
npx mdmark build --out dist/stock.html
\`\`\`

<!-- code: title=app.ts lines -->
\`\`\`ts
export function mount(element, markdown, options = {}) {
    const config = withDefaults(options);
    for (const block of parse(markdown)) {
        if (block.kind === "table") {
            attachTable(block, config.features);
        }
        element.append(render(block));
    }
}
\`\`\`
`;

const doc = document.getElementById("doc");
document.body.classList.add(scheme === "dark" ? "mdmark-theme-dark" : "mdmark-theme-light");
mount(doc, { markdown });


// 開閉のボタン: その行の文字の始まり（行頭の空白の数）の 1 つ左に配置するため、空白の数を行に持たせる
for (const button of doc.querySelectorAll(".mdmark-code-line > .mdmark-code-fold")) {
  const line = button.parentElement;
  const text = [...line.childNodes].filter((node) => node !== button).map((node) => node.textContent).join("");
  line.style.setProperty("--mock-505-lead", `${text.length - text.trimStart().length}ch`);
}

// 撮影で場面を指すための印（モックだけ）: 表を出てくる順に 1 から数える
for (const [index, table] of [...doc.querySelectorAll(".mdmark-table")].entries()) {
  table.dataset.mockScene = `table-${index + 1}`;
}
// 撮影で指す、開閉のボタンを持つ 2 つ目の行（2 段目の入れ子の行）
const foldLines = [...doc.querySelectorAll(".mdmark-code-line")].filter((line) => line.querySelector(":scope > .mdmark-code-fold"));
if (foldLines[1]) foldLines[1].dataset.mockScene = "fold-line";
