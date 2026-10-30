// 表・タブ・ステップ・ファイルツリーのマーカーのモック: 未確定の案と場面の切り替え。
// URL の ?note=（注釈の列の見た目 a・b）・?toggle=（フォルダの開閉の示し方 a・b）・?clipboard=（ok・fail）で選ぶ。
// 表を組み立てる前に読み、html の data-* を当てる

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  // 案の既定（URL に無いときの値）
  const DEFAULTS = { note: "a", toggle: "b", clipboard: "ok" };
  const scene = Object.fromEntries(Object.keys(DEFAULTS).map((axis) => [axis, params.get(axis) ?? DEFAULTS[axis]]));

  // tree.css・table.js・tree.js が読む html の data-*
  const root = document.documentElement;
  root.dataset.mockNote = scene.note;
  root.dataset.mockToggle = scene.toggle;
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
