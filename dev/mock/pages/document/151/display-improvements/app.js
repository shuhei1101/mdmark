// 表示を改善した文書のモック: 未確定の案と場面の切り替え。
// URL の ?width=（本文の幅の既定 a・b）・?fold=（最終列を畳む条件 a・b）・?open=（畳んだ最終列の開き方 a・b）・
// ?sticky=（見出し行の留め方 d・c）・?clipboard=（ok・fail）で選ぶ。表を組み立てる前に読み、html の data-* と本文の幅を当てる

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  // 案の既定（URL に無いときの値）
  const DEFAULTS = { width: "a", fold: "a", open: "a", sticky: "d", clipboard: "ok" };
  // 本文の幅の既定の案ごとの --mdmark-content-width
  const CONTENT_WIDTHS = { a: "none", b: "72rem" };
  const scene = Object.fromEntries(Object.keys(DEFAULTS).map((axis) => [axis, params.get(axis) ?? DEFAULTS[axis]]));

  // table.js・code-block.js が読む html の data-*（refs/151/assets/table.js の冒頭のコメント）
  const root = document.documentElement;
  root.style.setProperty("--mdmark-content-width", CONTENT_WIDTHS[scene.width]);
  root.dataset.mockFold = scene.fold;
  root.dataset.mockFoldOpen = scene.open;
  root.dataset.mockSticky = scene.sticky;
  if (scene.clipboard === "fail") root.dataset.mockClipboard = "fail";

  /** 今の案を保ったまま、1 つの軸だけを変えた URL を返す。 */
  const urlWith = (axis, value) => {
    const next = new URLSearchParams(params);
    if (value === DEFAULTS[axis]) next.delete(axis);
    else next.set(axis, value);
    const query = next.toString();
    return query ? `?${query}` : location.pathname.split("/").pop() || "index.html";
  };

  // 操作列のリンク: 今の案を押された見た目にし、行き先に他の軸の案を残す
  for (const link of document.querySelectorAll("[data-scene-axis]")) {
    link.href = urlWith(link.dataset.sceneAxis, link.dataset.sceneValue);
    if (scene[link.dataset.sceneAxis] === link.dataset.sceneValue) link.setAttribute("aria-current", "page");
  }
}
