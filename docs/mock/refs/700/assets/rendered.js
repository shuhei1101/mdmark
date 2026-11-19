// 配布物の mount で描いた文書の見本: 画面いっぱいに 1 つの文書を描き、右側の目次の頭に案 A のボタンを差し込む。
// URL の ?state=（rail・open・copied・failed）で目次の開閉とコピーの状態を、?scheme= で配色を選ぶ

import { mount } from "../../../../../dist/index.js";
import { renderMarkdownButtons, FAILED_PANEL } from "./markdown-export-parts.js";

const SAMPLE = `# 問い合わせ窓口の見直し

窓口を 3 つから 2 つにまとめるための資料です。

## 導入

今の窓口ごとの件数と、返信までの時間を整理します。

### 前提

対象は 10 月の第 2 週の問い合わせです。

## 窓口ごとの件数

電話・メール・チャットの件数を比べます。窓口ごとの件数は、電話が最も多く、チャットが最も少ない。

## 返信までの時間

自動返信と担当者の返信の時間を比べます。担当者の返信は、自動返信より 30 分ほど遅い。
`;

const params = new URLSearchParams(location.search);
const state = params.get("state") ?? "rail";
document.documentElement.dataset.scheme = params.get("scheme") ?? "light";

const host = document.querySelector("#doc");
mount(host, { markdown: SAMPLE });

// 描いた後に右側の目次を組み立てるため、次のフレームでボタンを差し込み、開く場面は目次を出すボタンを押す
requestAnimationFrame(() => {
  const head = host.querySelector(".mdmark-side-toc-head");
  const pin = head.querySelector(".mdmark-side-toc-pin");
  pin.insertAdjacentHTML("beforebegin", renderMarkdownButtons(state));
  if (state === "failed") head.insertAdjacentHTML("afterend", FAILED_PANEL);
  if (state === "rail") return;
  const toggle = host.querySelector(".mdmark-side-toc-toggle");
  if (getComputedStyle(toggle).display !== "none") toggle.click();
  else host.querySelector(".mdmark-side-toc").setAttribute("data-open", "");
});
