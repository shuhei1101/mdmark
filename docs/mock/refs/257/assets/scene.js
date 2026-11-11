// 図の枠の入れ子を見比べる場面: 配布物の mount で、文書の本文と詳細パネルの 2 か所に文書を描く

import { mount } from "../../../../../dist/index.js";

const fence = "```";

/** 窓口ごとの件数のグラフの定義（文書の中の図と、詳細パネルの中の図で使う） */
const chartDefinition = `{
  "type": "bar",
  "title": "窓口ごとの問い合わせの件数",
  "scope": "10 月の第 2 週",
  "updated": "2026-10-17",
  "x": { "label": "窓口", "ticks": ["メール", "フォーム", "チャット", "電話"] },
  "y": { "label": "件" },
  "series": [
    { "name": "自動返信", "points": [124, 86, 57, 12] },
    { "name": "担当者", "points": [38, 41, 63, 95] }
  ]
}`;

/** 反応の強さごとの返信の進みの操作できる部品の定義 */
const paramDefinition = `{
  "title": "返信の速さの見積もり",
  "knob": { "key": "strength", "label": "反応の強さ", "min": 0, "max": 10, "step": 1, "value": 5 },
  "chart": {
    "title": "反応の強さごとの返信の進み",
    "scope": "経過 0〜10 秒",
    "updated": "2026-10-18",
    "x": { "label": "経過（秒）", "ticks": ["0", "2", "4", "6", "8", "10"] },
    "y": { "label": "返信の進み（%）", "min": 0, "max": 100, "step": 25 }
  },
  "table": {
    "0": [0, 0, 0, 0, 0, 0],
    "1": [0, 10, 18, 26, 33, 39],
    "2": [0, 18, 33, 45, 55, 63],
    "3": [0, 26, 45, 59, 70, 78],
    "4": [0, 33, 55, 70, 80, 86],
    "5": [0, 39, 63, 78, 86, 92],
    "6": [0, 45, 70, 83, 91, 95],
    "7": [0, 50, 75, 88, 94, 97],
    "8": [0, 55, 80, 91, 96, 98],
    "9": [0, 59, 83, 93, 97, 99],
    "10": [0, 63, 86, 95, 98, 99]
  }
}`;

/** 本文の文書: 文書の中の図だけの場面と、操作できる部品の中のグラフの場面 */
const documentMarkdown = `# 問い合わせ窓口の見直し

10 月の第 2 週の問い合わせを、窓口ごとに数えた。

## 文書の中の図

<!-- chart -->

${fence}json
${chartDefinition}
${fence}

<!-- /chart -->

電話は担当者が返す割合が高い。

## 操作できる部品の中のグラフ

<!-- param -->

${fence}json
${paramDefinition}
${fence}

<!-- /param -->

反応の強さを 5 より上げても、10 秒後の返信の進みはほとんど変わらない。
`;

/** 詳細パネルの文書: 枠を持つ面の中に、埋め込んだ HTML の mdmark-param と mdmark-chart を描く場面 */
const panelMarkdown = `## 資料 A-20

窓口ごとの件数と、返信の速さの見積もり。

<!-- html -->

${fence}html
<mdmark-param>
${paramDefinition}
</mdmark-param>
<mdmark-chart>
${chartDefinition}
</mdmark-chart>
${fence}

<!-- /html -->
`;

mount(document.querySelector("#doc"), { markdown: documentMarkdown });
mount(document.querySelector("#panel-doc"), { markdown: panelMarkdown });
