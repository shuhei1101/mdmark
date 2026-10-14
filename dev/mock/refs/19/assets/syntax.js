// 拡張記法の操作（実装の mount が付ける振る舞いのモック）: 表の並べ替え・絞り込み・ピン止め、タブ、節と行の詳細の開閉、
// 移る先の節を開く処理と、印刷の前後の展開。モックの「印刷の見え方」からも呼べるよう window.mdmarkMockPrint に出す

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // ---------- 表 ----------

  /** セルの文字を数として読めれば数を、読めなければ null を返す。 */
  const toNumber = (text) => {
    const normalized = text.replace(/[,\s]/g, "");
    return normalized !== "" && Number.isFinite(Number(normalized)) ? Number(normalized) : null;
  };

  /** 表の本文の行（行の詳細の行と一致なしの行を除く）を返す。 */
  const bodyRows = (table) =>
    [...table.tBodies[0].rows].filter((row) => !row.matches(".mdmark-row-detail, .mdmark-table-empty"));

  /** 行の直後に続く行の詳細の行を返す（無ければ null）。 */
  const detailRowOf = (row) => {
    const next = row.nextElementSibling;
    return next?.matches(".mdmark-row-detail") ? next : null;
  };

  /** 列の値で行を並べ替え、見出しの aria-sort とアイコンを向きに合わせる。 */
  const sortTable = (table, th) => {
    const index = th.cellIndex;
    const ascending = th.getAttribute("aria-sort") !== "ascending";
    const rows = bodyRows(table);
    const texts = rows.map((row) => row.cells[index].textContent.trim());
    const numeric = texts.every((text) => toNumber(text) !== null);
    const order = rows
      .map((row, i) => ({ row, detail: detailRowOf(row), key: texts[i] }))
      .sort((a, b) => {
        const diff = numeric ? toNumber(a.key) - toNumber(b.key) : a.key.localeCompare(b.key, "ja");
        return ascending ? diff : -diff;
      });
    // 行の詳細は親の行と一緒に動かす
    const body = table.tBodies[0];
    for (const { row, detail } of order) {
      body.append(row);
      if (detail) body.append(detail);
    }
    for (const other of th.parentElement.cells) {
      if (other !== th) {
        other.removeAttribute("aria-sort");
        setSortIcon(other, "none");
      }
    }
    th.setAttribute("aria-sort", ascending ? "ascending" : "descending");
    setSortIcon(th, ascending ? "ascending" : "descending");
  };

  // 並べ替えのアイコンの線（並べていない・昇順・降順）
  const SORT_ICON_PATHS = {
    none: "M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3",
    ascending: "M8 13V3.5M4.5 7 8 3.5 11.5 7",
    descending: "M8 3v9.5M4.5 9 8 12.5 11.5 9",
  };

  /** 見出しの並べ替えのアイコンを向きに合わせて描き直す。 */
  const setSortIcon = (th, direction) => {
    const path = th.querySelector(".mdmark-sort path");
    if (path) path.setAttribute("d", SORT_ICON_PATHS[direction]);
  };

  /** 絞り込みの文字を含む行だけを出し、1 行も無ければ一致なしの行を出す。 */
  const filterTable = (table, query) => {
    const needle = query.trim().toLowerCase();
    let shown = 0;
    for (const row of bodyRows(table)) {
      const match = needle === "" || row.textContent.toLowerCase().includes(needle);
      row.hidden = !match;
      // 行の詳細の行は、親の行が隠れたら一緒に隠す。出すときは開閉の状態に戻す
      const detail = detailRowOf(row);
      if (detail) {
        const toggle = row.querySelector(".mdmark-row-toggle");
        detail.hidden = !match || toggle.getAttribute("aria-expanded") !== "true";
      }
      if (match) shown += 1;
    }
    table.querySelector(".mdmark-table-empty").hidden = shown > 0;
  };

  /** 表がはみ出すときだけピン止めのボタンを出す。 */
  const updatePinVisibility = (wrapper) => {
    const pin = wrapper.querySelector(".mdmark-pin");
    if (!pin) return;
    const table = wrapper.querySelector("table");
    const pinned = wrapper.classList.contains("is-pinned");
    // ピン止めした表の高さの上限（rem で書いた変数）を px にして、表がそれより高いかを比べる
    const maxHeightRem = parseFloat(getComputedStyle(table).getPropertyValue("--mdmark-table-max-height"));
    const tooTall = table.scrollHeight > maxHeightRem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    // ピン止めした後は押し直して戻せるよう、出したままにする
    pin.hidden = !pinned && table.scrollWidth <= table.clientWidth && !tooTall;
  };

  /** 行の詳細を持つ表に、表の見えている幅を変数で渡す（詳細の中身をその幅に収める）。 */
  const updateVisibleWidth = (table) => {
    if (table.querySelector(".mdmark-row-detail")) {
      table.style.setProperty("--mdmark-table-visible-width", `${table.clientWidth}px`);
    }
  };

  for (const wrapper of document.querySelectorAll(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    updateVisibleWidth(table);
    for (const button of wrapper.querySelectorAll(".mdmark-sort")) {
      button.addEventListener("click", () => sortTable(table, button.closest("th")));
    }
    const input = wrapper.querySelector(".mdmark-table-filter input");
    input?.addEventListener("input", () => filterTable(table, input.value));
    const pin = wrapper.querySelector(".mdmark-pin");
    pin?.addEventListener("click", () => {
      const pinned = !wrapper.classList.contains("is-pinned");
      wrapper.classList.toggle("is-pinned", pinned);
      pin.setAttribute("aria-pressed", String(pinned));
    });
    updatePinVisibility(wrapper);
  }
  window.addEventListener("resize", () => {
    for (const wrapper of document.querySelectorAll(".mdmark-table")) {
      updatePinVisibility(wrapper);
      updateVisibleWidth(wrapper.querySelector("table"));
    }
  });

  // ---------- 行の詳細 ----------

  for (const toggle of document.querySelectorAll(".mdmark-row-toggle")) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      document.getElementById(toggle.getAttribute("aria-controls")).hidden = !open;
    });
  }

  // ---------- タブ ----------

  /** タブを選び、選んだタブの中身だけを出す。focus が真ならフォーカスも移す。 */
  const selectTab = (tab, focus) => {
    const tabs = [...tab.closest("[role=tablist]").querySelectorAll("[role=tab]")];
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
    }
    if (focus) tab.focus();
  };

  // 矢印キーで移る向き
  const TAB_KEY_STEPS = { ArrowRight: 1, ArrowLeft: -1 };

  for (const tablist of document.querySelectorAll("[role=tablist]")) {
    const tabs = [...tablist.querySelectorAll("[role=tab]")];
    tablist.addEventListener("click", (event) => {
      const tab = event.target.closest("[role=tab]");
      if (tab) selectTab(tab, false);
    });
    // 左右の矢印・Home・End で選ぶタブを移す（選ぶと同時に中身を切り替える）
    tablist.addEventListener("keydown", (event) => {
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      let next = null;
      if (event.key in TAB_KEY_STEPS) next = (current + TAB_KEY_STEPS[event.key] + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  }

  // ---------- 節の開閉と、移る先の節を開く処理 ----------

  /** 節の中身の開閉を切り替え、見出しのボタンの aria-expanded を合わせる。 */
  const setSectionOpen = (toggle, open) => {
    toggle.setAttribute("aria-expanded", String(open));
    const body = document.getElementById(toggle.getAttribute("aria-controls"));
    if (open) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "until-found");
  };

  for (const toggle of document.querySelectorAll(".mdmark-section-toggle")) {
    toggle.addEventListener("click", () => setSectionOpen(toggle, toggle.getAttribute("aria-expanded") !== "true"));
  }

  // ページ内検索で閉じた節の中の文字が見つかったとき: ブラウザが開く前にボタンの状態を合わせる
  document.addEventListener("beforematch", (event) => {
    const body = event.target.closest(".mdmark-section-body");
    const toggle = body && document.querySelector(`[aria-controls="${body.id}"]`);
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  });

  /** 要素を囲む閉じた節を外側から開く。 */
  const openAncestors = (element) => {
    for (let body = element.closest(".mdmark-section-body"); body; body = body.parentElement.closest(".mdmark-section-body")) {
      const toggle = document.querySelector(`[aria-controls="${body.id}"]`);
      if (toggle) setSectionOpen(toggle, true);
    }
  };

  /** URL の #ID が指す要素を囲む節を開き、その要素へ移る。 */
  const revealHashTarget = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    openAncestors(target);
    target.scrollIntoView();
  };
  window.addEventListener("hashchange", revealHashTarget);
  revealHashTarget();

  // ---------- 印刷の前後 ----------

  // 印刷の前に閉じていたもの（印刷の後に閉じ直す）
  let closedBeforePrint = { details: [], sections: [], rows: [] };

  /** タブの全ての中身・閉じた節・行の詳細・閉じた表と注意書きを開き、開いた分を覚える。 */
  const expand = () => {
    const details = [...document.querySelectorAll(".mdmark details:not([open])")];
    const sections = [...document.querySelectorAll('.mdmark-section-toggle[aria-expanded="false"]')];
    const rows = [...document.querySelectorAll('.mdmark-row-toggle[aria-expanded="false"]')];
    for (const element of details) element.open = true;
    for (const toggle of sections) setSectionOpen(toggle, true);
    for (const toggle of rows) document.getElementById(toggle.getAttribute("aria-controls")).hidden = false;
    closedBeforePrint = { details, sections, rows };
  };

  /** 開いた分を閉じ直す。タブは印刷の規則が全ての中身を出しているだけなので、選んでいたタブのまま戻る。 */
  const restore = () => {
    for (const element of closedBeforePrint.details) element.open = false;
    for (const toggle of closedBeforePrint.sections) setSectionOpen(toggle, false);
    for (const toggle of closedBeforePrint.rows) document.getElementById(toggle.getAttribute("aria-controls")).hidden = true;
    closedBeforePrint = { details: [], sections: [], rows: [] };
  };

  window.mdmarkMockPrint = { expand, restore };
}
