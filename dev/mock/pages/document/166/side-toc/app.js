// 右側の目次と節のまとめての開閉のモック: 未確定の案と場面の切り替え。
// URL の ?mode=（目次の出し方 hover・fixed・left）・?fold=（まとめて開閉するボタンの置き場所 a・b）で選ぶ。
// 右側の目次を組み立てる前（side-toc.js より先）に読み、出し方とボタンの置き場所を当てる

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  // 案の既定（URL に無いときの値）
  const DEFAULTS = { mode: "hover", fold: "a" };
  // 実装が知っている出し方。知らない値（left）は既定の hover にする
  const KNOWN_MODES = ["hover", "fixed"];
  const scene = Object.fromEntries(Object.keys(DEFAULTS).map((axis) => [axis, params.get(axis) ?? DEFAULTS[axis]]));

  // 右側の目次の出し方と、まとめて開閉するボタンの置き場所
  const aside = document.querySelector(".mdmark-side-toc");
  aside.dataset.mode = KNOWN_MODES.includes(scene.mode) ? scene.mode : DEFAULTS.mode;
  if (scene.fold === "b") aside.dataset.actions = "none";
  else document.querySelector(".mdmark-fold-bar").remove();

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
