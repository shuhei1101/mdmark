/** `{url}/{id}?{引数}` を取り、200 でなければ状態コードと本文で例外を投げる（既定の取り方は 404 の本文もストーリーに出す） */
async function fetchStoryHtml(url, path, params) {
  const response = await fetch(`${url}/${path}?${new URLSearchParams(params)}`);
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  return response.text();
}

// 全ストーリーに共通の引数: 部品の HTML を描画の口（Storybook の開発サーバーの `/render`）から取る
export const parameters = {
  server: {
    url: `${window.location.origin}/render`,
    fetchStoryHtml,
  },
};

// 図のストーリー（`data-story-fit` の印を持つもの）は、描いた直後に全体が収まる倍率にする操作を付ける
const fitted = new WeakSet();
new MutationObserver(async () => {
  for (const marker of document.querySelectorAll("[data-story-fit]")) {
    const root = marker.closest(".mdmark");
    if (!root || fitted.has(root)) {
      continue;
    }
    fitted.add(root);
    const { attachDiagrams } = await import(
      /* webpackIgnore: true */ `${window.location.origin}/render/diagram.js`
    );
    attachDiagrams({ root, placement: "top" });
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// 表のストーリー（`.mdmark-table` を持つもの）は、描いた直後に見出し行と集計の行を画面に留める操作を付ける（`mount` が全ての表に付けるのと同じ）
const stuck = new WeakSet();
new MutationObserver(async () => {
  for (const table of document.querySelectorAll(".mdmark-table")) {
    const root = table.closest(".mdmark");
    if (!root || stuck.has(root)) {
      continue;
    }
    stuck.add(root);
    const { attachStickyRows } = await import(
      /* webpackIgnore: true */ `${window.location.origin}/render/sticky.js`
    );
    attachStickyRows(root);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// ファイルツリーのストーリー（`.mdmark-tree` を持つもの）は、描いた直後に注釈の列の位置を測って入れる（`mount` が測るのと同じ）
const aligned = new WeakSet();
new MutationObserver(async () => {
  for (const tree of document.querySelectorAll(".mdmark-tree")) {
    if (aligned.has(tree)) {
      continue;
    }
    aligned.add(tree);
    const { alignFileTreeNotes } = await import(
      /* webpackIgnore: true */ `${window.location.origin}/render/trees.js`
    );
    await document.fonts.ready;
    alignFileTreeNotes(tree);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// GIF の止めたストーリー（隠していない `canvas` を持つもの）は、画像を読み込んだ後に最初のフレームを `canvas` に描く（`mount` が描くのと同じ）
const drawn = new WeakSet();
new MutationObserver(() => {
  for (const canvas of document.querySelectorAll(
    ".mdmark-gif canvas:not([hidden])",
  )) {
    const img = canvas.parentElement?.querySelector("img");
    if (!img || drawn.has(canvas)) {
      continue;
    }
    drawn.add(canvas);
    img.decode().then(
      () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
      },
      () => {},
    );
  }
}).observe(document.documentElement, { childList: true, subtree: true });
