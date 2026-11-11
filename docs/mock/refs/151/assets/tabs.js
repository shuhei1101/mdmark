// URL の #ID が選ばれていないタブの中の見出しを指すとき、そのタブを選んでから見出しへ移る処理（実装の tabs.ts のモック）。
// 同じ group のタブは選んだタブの名前を localStorage に覚えて次に開いたときに選び直し、URL の ID が指すタブはそれより優先する。
// refs/19/assets/syntax.js の後に読む（syntax.js がタブの切り替えと、移る先を囲む節を開く処理を持つ）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 選んだタブの名前を覚えるキーの頭（後ろに group の名前を付ける）
  const STORAGE_PREFIX = "mdmark-tab:";

  // URL の ID でタブを選んでいる間は真（その選択を覚えない）
  let revealing = false;

  /** タブの並びの中から名前が一致するタブを返す。 */
  const tabByName = (tabs, name) => [...tabs.querySelectorAll("[role=tab]")].find((tab) => tab.textContent.trim() === name);

  // 覚えたタブを選び直し、タブを選んだら覚える（group を持つタブだけ）
  for (const tabs of document.querySelectorAll(".mdmark-tabs[data-group]")) {
    const key = STORAGE_PREFIX + tabs.dataset.group;
    const remembered = localStorage.getItem(key);
    const tab = remembered && tabByName(tabs, remembered);
    if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
    tabs.querySelector("[role=tablist]").addEventListener("click", (event) => {
      const clicked = event.target.closest("[role=tab]");
      if (clicked && !revealing) localStorage.setItem(key, clicked.textContent.trim());
    });
  }

  /** URL の #ID が選ばれていないタブの中を指すとき、外側のタブから順に選んでから ID の要素へ移る。 */
  const revealInTabs = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target || !target.closest("[role=tabpanel][hidden]")) return;
    const panels = [];
    for (let panel = target.closest("[role=tabpanel]"); panel; panel = panel.parentElement.closest("[role=tabpanel]")) panels.unshift(panel);
    // URL が指すタブは選ぶが、覚えたタブの選択は書き換えない（読む人が選んだものではないため）
    revealing = true;
    for (const panel of panels) {
      if (panel.hidden) document.querySelector(`[role=tab][aria-controls="${panel.id}"]`).click();
    }
    revealing = false;
    target.scrollIntoView();
  };

  // syntax.js が先に節を開いてから、こちらがタブを選ぶ
  window.addEventListener("hashchange", revealInTabs);
  revealInTabs();
}
