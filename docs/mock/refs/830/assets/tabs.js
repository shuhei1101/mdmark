// #830 のタブの追加分（実装の tabs.interact.ts のモック）:
// - 選んだタブのボタンが並びの見える範囲の外にあれば、並びの横のスクロール位置だけを動かして入れる
// - 残りのタブがある側の端にだけ、押すと並びを動かすボタン（‹・›）を出す
// - 折り返す指定のタブ群（data-wrap）には付けない
(() => {
  /** lucide の chevron-left・chevron-right の形のアイコン */
  const icon = (dir) =>
    `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === "start" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}"/></svg>`;

  /** 並びの中の選んだタブを、並びの見える範囲（端のボタンに重ならない範囲）へ入れる。並びに配置が無い（幅 0）ときは動かさない */
  const reveal = (tablist) => {
    const selected = tablist.querySelector('[role="tab"][aria-selected="true"]');
    if (!selected || tablist.clientWidth === 0) return;
    // 端のボタンの幅だけ内側を見える範囲にする。並びの端まで動かしたときは、その側のボタンが消えるので端のタブも隠れない
    const inset = tablist.parentElement?.querySelector(".mdmark-tablist-scroll")?.offsetWidth || 32;
    const list = tablist.getBoundingClientRect();
    const tab = selected.getBoundingClientRect();
    if (tab.left < list.left + inset) {
      tablist.scrollLeft -= list.left + inset - tab.left;
    } else if (tab.right > list.right - inset) {
      tablist.scrollLeft += tab.right - (list.right - inset);
    }
  };

  /** 残りのタブがある側のボタンだけを出す */
  const updateButtons = (tablist, start, end) => {
    const rest = tablist.scrollWidth - tablist.clientWidth - tablist.scrollLeft;
    start.hidden = tablist.scrollLeft <= 1;
    end.hidden = rest <= 1;
  };

  window.addEventListener("DOMContentLoaded", () => {
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    for (const tablist of document.querySelectorAll('[role="tablist"]')) {
      // 折り返す指定のタブ群は並びが横にスクロールしないため、端のボタンも見える範囲へ入れる処理も付けない
      if (tablist.parentElement?.hasAttribute("data-wrap")) continue;
      const wrap = document.createElement("div");
      wrap.className = "mdmark-tablist-wrap";
      tablist.before(wrap);
      const buttons = ["start", "end"].map((dir) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mdmark-tablist-scroll";
        button.dataset.dir = dir;
        button.tabIndex = -1;
        button.setAttribute("aria-hidden", "true");
        button.innerHTML = icon(dir);
        // 押すと、並びの見える幅の 8 割だけ残りのタブの側へ動かす
        button.addEventListener("click", () => {
          const step = tablist.clientWidth * 0.8;
          tablist.scrollBy({ left: dir === "start" ? -step : step, behavior });
        });
        return button;
      });
      wrap.append(buttons[0], tablist, buttons[1]);
      const update = () => updateButtons(tablist, buttons[0], buttons[1]);
      // 選ぶ処理（refs/19/assets/syntax.js）の後に測る
      const after = () => queueMicrotask(() => reveal(tablist));
      tablist.addEventListener("click", after);
      tablist.addEventListener("keydown", after);
      tablist.addEventListener("scroll", update, { passive: true });
      // 並びの見える幅が 0 から変わったとき（閉じた折りたたみを開いた）と幅が変わったときに、選んだタブを入れてボタンを出し直す
      new ResizeObserver(() => {
        reveal(tablist);
        update();
      }).observe(tablist);
    }
  });
})();
