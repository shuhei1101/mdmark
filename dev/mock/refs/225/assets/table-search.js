// 表の語の欄と条件のチップ（実装の mount が +search の表に付ける振る舞いのモック）: 表の上の道具の帯の先頭に語の入力欄を置き、
// 入力した語を含むセルが 1 つでもある行だけを残す（列ごとの絞り込みと両方を満たす行）。当てた条件ごとのチップと「全て解除」を帯の下に出す。
// 描く先は data-mock-search を持つ表の入れ物。モックだけの指定: data-mock-search-value（入れておく語）・
// data-mock-conditions（当てておく列の条件。列の位置 → 文字か値の配列の JSON）。
// 列ごとの絞り込みは refs/19/assets/syntax.js、件数は refs/151/assets/table.js が受け持ち、この前に読む

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 部品のアイコンの線（24 の格子。lucide の形）
  const ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  // 語の条件のチップの名前（モックでは scene.js の ?chip= の案で切り替える）
  const WORD_LABELS = { search: "検索", keyword: "キーワード" };
  const WORD_LABEL = WORD_LABELS[document.documentElement.dataset.mockChip ?? "search"];

  // 値の候補を並べる区切りと、期間の区切り
  const VALUE_SEPARATOR = "・";
  const RANGE_SEPARATOR = "〜";

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  /** 表の本文の行（行の詳細の行と一致なしの行を除く）を返す。 */
  const bodyRows = (table) => [...table.tBodies[0].rows].filter((row) => !row.matches(".mdmark-row-detail, .mdmark-table-empty"));

  /** 列の絞り込みのドロワーに当たっている条件を文字にする（条件が無ければ空）。 */
  const conditionText = (drawer) => {
    const kind = drawer.dataset.filterKind;
    if (kind === "select") return [...drawer.querySelectorAll(".mdmark-filter-options input:checked")].map((input) => input.value).join(VALUE_SEPARATOR);
    if (kind === "date") {
      const [from, to] = [...drawer.querySelectorAll("input")].map((input) => input.value);
      return from || to ? `${from}${RANGE_SEPARATOR}${to}` : "";
    }
    return drawer.querySelector("input").value.trim();
  };

  /** 列の名前: ドロワーの列の位置の見出しの文字。 */
  const columnName = (wrapper, drawer) => wrapper.querySelector("table").tHead.rows[0].cells[Number(drawer.dataset.column)].querySelector(".mdmark-sort, span > span")?.textContent.trim();

  for (const [index, wrapper] of [...document.querySelectorAll(".mdmark-table[data-mock-search]")].entries()) {
    const table = wrapper.querySelector("table");
    const bar = wrapper.querySelector(".mdmark-table-bar");
    const id = `mdmark-table-search-${index}`;

    // 語の入力欄: ラベルを常に出し、帯の先頭に置く
    const field = document.createElement("div");
    field.className = "mdmark-table-search";
    field.innerHTML = `<label class="mdmark-table-search-label" for="${id}">${icon("search")}検索</label><input class="mdmark-table-search-input" id="${id}" type="search" autocomplete="off" spellcheck="false">`;
    bar.prepend(field);
    const input = field.querySelector("input");

    // 条件のチップと「全て解除」: 条件が 1 つも無いときは出さない
    const chips = document.createElement("div");
    chips.className = "mdmark-table-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "当てている条件");
    chips.hidden = true;
    chips.innerHTML = '<ul class="mdmark-chip-list"></ul><button class="mdmark-chips-clear" type="button">全て解除</button>';
    bar.after(chips);

    /** 列の絞り込みが残した行のうち、どのセルにも語を含まない行を隠す。1 行も残らなければ一致なしの行を出す。 */
    const applySearch = () => {
      // 列の絞り込みを当て直す（語で隠した行を戻す）。ドロワーの入力の受け取りは syntax.js が持つ
      const drawerInput = wrapper.querySelector(".mdmark-filter-drawer input:not(.mdmark-filter-search)");
      if (drawerInput) drawerInput.dispatchEvent(new Event("input"));
      else for (const row of bodyRows(table)) row.hidden = false;
      const needle = input.value.trim().toLowerCase();
      let shown = 0;
      for (const row of bodyRows(table)) {
        if (!row.hidden && needle) row.hidden = ![...row.cells].some((cell) => cell.textContent.toLowerCase().includes(needle));
        if (!row.hidden) shown += 1;
      }
      const empty = table.querySelector(".mdmark-table-empty");
      if (empty) empty.hidden = shown > 0;
    };

    /** 当たっている条件ごとにチップを作り直す。外したチップの次のチップへフォーカスを移せるよう、作ったチップを返す。 */
    const renderChips = () => {
      const list = chips.querySelector(".mdmark-chip-list");
      const items = [];
      for (const drawer of wrapper.querySelectorAll(".mdmark-filter-drawer")) {
        const text = conditionText(drawer);
        if (text) items.push({ name: columnName(wrapper, drawer), text, drawer });
      }
      if (input.value.trim()) items.push({ name: WORD_LABEL, text: input.value.trim(), drawer: null });
      list.innerHTML = items
        .map(({ name, text }, i) => `<li class="mdmark-chip"><span class="mdmark-chip-text">${name}: ${text}</span><button class="mdmark-chip-remove" type="button" data-index="${i}" aria-label="${name}の条件を外す" title="${name}の条件を外す">${icon("close")}</button></li>`)
        .join("");
      chips.hidden = items.length === 0;
      return items;
    };

    let items = [];
    const refresh = () => {
      applySearch();
      items = renderChips();
    };

    /** 条件を 1 つ外す（列はドロワーの「絞り込みを外す」、語は入力欄を空にする）。 */
    const removeCondition = (item) => {
      if (item.drawer) item.drawer.querySelector(".mdmark-filter-clear").click();
      else input.value = "";
    };

    // 語の入力・列の絞り込みの入力と「絞り込みを外す」: 語を当て直してチップを作り直す（件数は table.js が後で数え直す）
    wrapper.addEventListener("input", refresh);
    wrapper.addEventListener("click", (event) => {
      if (event.target.closest(".mdmark-filter-clear")) refresh();
    });

    // チップの ×: その条件を外し、次のチップ（無ければ語の入力欄）へフォーカスを移す
    chips.addEventListener("click", (event) => {
      const remove = event.target.closest(".mdmark-chip-remove");
      if (remove) {
        const index = Number(remove.dataset.index);
        removeCondition(items[index]);
        refresh();
        const buttons = chips.querySelectorAll(".mdmark-chip-remove");
        (buttons[Math.min(index, buttons.length - 1)] ?? input).focus();
        return;
      }
      // 全て解除: 列の条件と語の欄を全て空にし、語の入力欄へフォーカスを移す
      if (event.target.closest(".mdmark-chips-clear")) {
        for (const item of items) removeCondition(item);
        refresh();
        input.focus();
      }
    });

    // モックで当てておく条件と語
    const conditions = JSON.parse(wrapper.dataset.mockConditions ?? "{}");
    for (const [column, value] of Object.entries(conditions)) {
      const drawer = wrapper.querySelector(`.mdmark-filter-drawer[data-column="${column}"]`);
      if (Array.isArray(value)) {
        for (const option of drawer.querySelectorAll(".mdmark-filter-options input")) option.checked = value.includes(option.value);
      } else {
        drawer.querySelector("input").value = value;
      }
    }
    input.value = wrapper.dataset.mockSearchValue ?? "";
    refresh();
    // 件数の数え直し（table.js は表の入れ物の click で数え直す）
    wrapper.dispatchEvent(new Event("click"));
  }
}
