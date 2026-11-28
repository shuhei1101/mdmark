// #830 のタブの追加分: 選んだタブのボタンが並びの見える範囲の外にあれば、並びの横のスクロール位置だけを動かして入れる（実装の tabs.interact.ts のモック）
(() => {
  /** 並びの中の選んだタブを、並びの見える範囲へ入れる。並びに配置が無い（幅 0）ときは動かさない */
  const reveal = (tablist) => {
    const selected = tablist.querySelector('[role="tab"][aria-selected="true"]');
    if (!selected || tablist.clientWidth === 0) return;
    const list = tablist.getBoundingClientRect();
    const tab = selected.getBoundingClientRect();
    if (tab.left < list.left) {
      tablist.scrollLeft -= list.left - tab.left;
    } else if (tab.right > list.right) {
      tablist.scrollLeft += tab.right - list.right;
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    for (const tablist of document.querySelectorAll('[role="tablist"]')) {
      // 選ぶ処理（refs/19/assets/syntax.js）の後に測る
      const after = () => queueMicrotask(() => reveal(tablist));
      tablist.addEventListener("click", after);
      tablist.addEventListener("keydown", after);
      // 並びの見える幅が 0 から変わったとき（閉じた折りたたみを開いた）に入れる
      new ResizeObserver(() => reveal(tablist)).observe(tablist);
    }
  });
})();
