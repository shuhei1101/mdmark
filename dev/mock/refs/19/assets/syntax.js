// 拡張記法の操作（実装の mount が付ける振る舞いのモック）: 表の並べ替え・列ごとの絞り込み・ピン止め、タブ、節と行の詳細の開閉、
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

  // 並べ替えの向きの順番（押すたびに次へ進み、最後の次は先頭へ戻る）
  const SORT_CYCLE = ["none", "ascending", "descending"];

  // 並べ替えのアイコンの線（並べていない・昇順・降順）
  const SORT_ICON_PATHS = {
    none: "M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3",
    ascending: "M8 13V3.5M4.5 7 8 3.5 11.5 7",
    descending: "M8 3v9.5M4.5 9 8 12.5 11.5 9",
  };

  /** 見出しの並べ替えの向きを aria-sort とアイコンに当てる。 */
  const setSortState = (th, direction) => {
    if (direction === "none") th.removeAttribute("aria-sort");
    else th.setAttribute("aria-sort", direction);
    const path = th.querySelector(".mdmark-sort path");
    if (path) path.setAttribute("d", SORT_ICON_PATHS[direction]);
  };

  /** 列の値で行を並べ替える。向きを昇順 → 降順 → 元の並びの順に進める。 */
  const sortTable = (table, th) => {
    const index = th.cellIndex;
    const current = th.getAttribute("aria-sort") ?? "none";
    const direction = SORT_CYCLE[(SORT_CYCLE.indexOf(current) + 1) % SORT_CYCLE.length];
    const rows = bodyRows(table);
    const texts = rows.map((row) => row.cells[index].textContent.trim());
    const numeric = texts.every((text) => toNumber(text) !== null);
    const order = rows
      .map((row, i) => ({ row, detail: detailRowOf(row), key: texts[i], original: Number(row.dataset.order) }))
      .sort((a, b) => {
        // 元の並び: 描いたときの順番に戻す
        if (direction === "none") return a.original - b.original;
        const diff = numeric ? toNumber(a.key) - toNumber(b.key) : a.key.localeCompare(b.key, "ja");
        return direction === "ascending" ? diff : -diff;
      });
    // 行の詳細と一致なしの行は、親の行と表の末尾に付けたまま動かす
    const body = table.tBodies[0];
    const empty = body.querySelector(".mdmark-table-empty");
    for (const { row, detail } of order) {
      body.append(row);
      if (detail) body.append(detail);
    }
    if (empty) body.append(empty);
    for (const other of th.parentElement.cells) {
      if (other !== th) setSortState(other, "none");
    }
    setSortState(th, direction);
  };

  /** 列の絞り込みの条件から、行を出すかを決める関数を返す（条件が無ければ null）。 */
  const filterPredicate = (drawer) => {
    const kind = drawer.dataset.filterKind;
    if (kind === "select") {
      const checked = [...drawer.querySelectorAll(".mdmark-filter-options input:checked")].map((input) => input.value);
      return checked.length ? (text) => checked.includes(text) : null;
    }
    if (kind === "text") {
      const needle = drawer.querySelector("input").value.trim().toLowerCase();
      return needle ? (text) => text.toLowerCase().includes(needle) : null;
    }
    // date: 開始日以降・終了日以前（片方だけでもよい）。日付は YYYY-MM-DD の文字のまま比べる
    const [from, to] = [...drawer.querySelectorAll("input")].map((input) => input.value);
    return from || to ? (text) => (!from || text >= from) && (!to || text <= to) : null;
  };

  /** 全ての列の絞り込みを当て、絞り込み中の列のボタンを示し、1 行も無ければ一致なしの行を出す。 */
  const applyFilters = (wrapper) => {
    const table = wrapper.querySelector("table");
    const predicates = [];
    for (const drawer of wrapper.querySelectorAll(".mdmark-filter-drawer")) {
      const predicate = filterPredicate(drawer);
      const button = wrapper.querySelector(`[popovertarget="${drawer.id}"]`);
      button.classList.toggle("is-active", predicate !== null);
      button.querySelector(".mdmark-visually-hidden").textContent = predicate ? "（絞り込み中）" : "";
      if (predicate) predicates.push({ index: Number(drawer.dataset.column), predicate });
    }
    let shown = 0;
    for (const row of bodyRows(table)) {
      const match = predicates.every(({ index, predicate }) => predicate(row.cells[index].textContent.trim()));
      row.hidden = !match;
      // 行の詳細の行は、親の行が隠れたら一緒に隠す。出すときは開閉の状態に戻す
      const detail = detailRowOf(row);
      if (detail) {
        const toggle = row.querySelector(".mdmark-row-toggle");
        detail.hidden = !match || toggle.getAttribute("aria-expanded") !== "true";
      }
      if (match) shown += 1;
    }
    const empty = table.querySelector(".mdmark-table-empty");
    if (empty) empty.hidden = shown > 0;
  };

  /** 値の候補を、検索欄の文字を含むものだけにする。 */
  const narrowOptions = (drawer, query) => {
    const needle = query.trim().toLowerCase();
    let shown = 0;
    for (const item of drawer.querySelectorAll(".mdmark-filter-options li")) {
      const match = item.textContent.toLowerCase().includes(needle);
      item.hidden = !match;
      if (match) shown += 1;
    }
    drawer.querySelector(".mdmark-filter-none").hidden = shown > 0;
  };

  /** ドロワーを押した見出しのボタンの下に置き、画面の端からはみ出さないようにする。 */
  const placeDrawer = (drawer, button) => {
    const rect = button.getBoundingClientRect();
    const gutter = 16;
    const left = Math.min(Math.max(rect.right - drawer.offsetWidth, gutter), window.innerWidth - drawer.offsetWidth - gutter);
    const below = rect.bottom + 4;
    const top = below + drawer.offsetHeight > window.innerHeight - gutter ? Math.max(gutter, rect.top - drawer.offsetHeight - 4) : below;
    drawer.style.left = `${left}px`;
    drawer.style.top = `${top}px`;
  };

  /** 先頭から count 列までを表の左端に留める（0 で外す）。押したピンのボタンを押された状態にする。 */
  const pinColumns = (wrapper, count) => {
    const table = wrapper.querySelector("table");
    const headCells = [...table.tHead.rows[0].cells];
    // 留める列の左の位置: 前の列までの幅の合計
    const lefts = [];
    let left = 0;
    for (const cell of headCells) {
      lefts.push(left);
      left += cell.offsetWidth;
    }
    for (const row of table.rows) {
      // 行の詳細の行（1 つのセルが全ての列にまたがる）は留めない
      if (row.matches(".mdmark-row-detail, .mdmark-table-empty")) continue;
      [...row.cells].forEach((cell, i) => {
        const pinned = i < count;
        cell.classList.toggle("is-pinned-col", pinned);
        cell.classList.toggle("is-pinned-edge", pinned && i === count - 1);
        cell.style.left = pinned ? `${lefts[i]}px` : "";
      });
    }
    headCells.forEach((cell, i) => {
      cell.querySelector(".mdmark-pin")?.setAttribute("aria-pressed", String(i === count - 1));
    });
    wrapper.dataset.pinned = String(count);
  };

  /** 表が横にはみ出すときだけピン止めのボタンを出す（留めている間は戻せるよう出したまま）。 */
  const updatePinVisibility = (wrapper) => {
    const table = wrapper.querySelector("table");
    const overflow = table.scrollWidth > table.clientWidth || Number(wrapper.dataset.pinned ?? 0) > 0;
    for (const pin of wrapper.querySelectorAll(".mdmark-pin")) pin.hidden = !overflow;
  };

  /** 行の詳細を持つ表に、表の見えている幅を変数で渡す（詳細の中身をその幅に収める）。 */
  const updateVisibleWidth = (table) => {
    if (table.querySelector(".mdmark-row-detail")) {
      table.style.setProperty("--mdmark-table-visible-width", `${table.clientWidth}px`);
    }
  };

  for (const wrapper of document.querySelectorAll(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    // 元の並びに戻すための描いたときの順番
    bodyRows(table).forEach((row, i) => {
      row.dataset.order = String(i);
    });
    // 絞り込み・並べ替えで列の幅が変わらないよう、描いたときの幅を最小の幅にする
    for (const cell of table.tHead.rows[0].cells) cell.style.minWidth = `${cell.offsetWidth}px`;
    updateVisibleWidth(table);
    for (const button of wrapper.querySelectorAll(".mdmark-sort")) {
      button.addEventListener("click", () => sortTable(table, button.closest("th")));
    }
    for (const drawer of wrapper.querySelectorAll(".mdmark-filter-drawer")) {
      const button = wrapper.querySelector(`[popovertarget="${drawer.id}"]`);
      // 開いたとき: ボタンの下に置き、最初の入力欄へフォーカスを移す
      drawer.addEventListener("toggle", (event) => {
        if (event.newState !== "open") return;
        placeDrawer(drawer, button);
        drawer.querySelector("input")?.focus();
      });
      drawer.querySelector(".mdmark-filter-search")?.addEventListener("input", (event) => narrowOptions(drawer, event.target.value));
      for (const input of drawer.querySelectorAll("input:not(.mdmark-filter-search)")) {
        input.addEventListener("input", () => applyFilters(wrapper));
      }
      drawer.querySelector(".mdmark-filter-clear").addEventListener("click", () => {
        for (const input of drawer.querySelectorAll("input")) {
          if (input.type === "checkbox") input.checked = false;
          else input.value = "";
        }
        narrowOptions(drawer, "");
        applyFilters(wrapper);
      });
    }
    // 押した列までを留める。押された状態のボタンを押し直すと外す
    for (const pin of wrapper.querySelectorAll(".mdmark-pin")) {
      pin.addEventListener("click", () => {
        const count = pin.closest("th").cellIndex + 1;
        pinColumns(wrapper, pin.getAttribute("aria-pressed") === "true" ? 0 : count);
      });
    }
    if (wrapper.dataset.pinned) pinColumns(wrapper, Number(wrapper.dataset.pinned));
    applyFilters(wrapper);
    updatePinVisibility(wrapper);
  }
  window.addEventListener("resize", () => {
    for (const wrapper of document.querySelectorAll(".mdmark-table")) {
      updatePinVisibility(wrapper);
      updateVisibleWidth(wrapper.querySelector("table"));
      if (Number(wrapper.dataset.pinned ?? 0) > 0) pinColumns(wrapper, Number(wrapper.dataset.pinned));
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
