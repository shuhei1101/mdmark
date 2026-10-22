// 表の機能の追加分の操作（実装の mount が付ける振る舞いのモック）: 件数の表示・列の表示の切り替え・集計の行・表のコピー・行へのリンクと、
// モックだけの「印刷の見え方」の切り替え。並べ替え・絞り込み・ピン止めは refs/19/assets/syntax.js が受け持ち、この後に読む。
// 表の入れ物の data-* : data-hidden-columns（hide= の列の位置。カンマ区切り）・data-mock-open（"columns" でメニューを開いたまま見せる）・
// data-mock-copy（"copied" / "failed" の知らせを出したまま見せる）。data-mock-* はモックだけの指定

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 操作の部品のアイコンの線（24 の格子。lucide の形）
  const ICON_PATHS = {
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    copied: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  };

  // コピーのボタンの文言（状態ごと）
  const COPY_LABELS = {
    idle: "表をコピー",
    copied: "コピーしました",
    failed: "コピーできませんでした",
  };

  // コピーしたことの知らせをボタンに出しておく時間（ミリ秒）。できなかったことの知らせは次に押すまで残す
  const COPIED_NOTICE_MS = 2000;

  // 集計の種類ごとの見出し
  const TOTAL_LABELS = { sum: "合計", avg: "平均", count: "個数" };

  // 集計の値の書式: 桁区切りを付け、小数は 2 桁までにする
  const totalFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

  // 集計する値が 1 つも無いときの平均の表示
  const NO_VALUE = "—";

  /** セルの文字を数として読めれば数を、読めなければ null を返す。 */
  const toNumber = (text) => {
    const normalized = text.replace(/[,\s]/g, "");
    return normalized !== "" && Number.isFinite(Number(normalized)) ? Number(normalized) : null;
  };

  /** 表の本文の行（行の詳細の行と一致なしの行を除く）を返す。 */
  const bodyRows = (table) =>
    [...table.tBodies[0].rows].filter((row) => !row.matches(".mdmark-row-detail, .mdmark-table-empty"));

  /** 見出しのセルから列名を返す（絞り込み・ピン止めのボタンの読み上げの文字を含めない）。 */
  const columnName = (th) => (th.querySelector(".mdmark-sort, .mdmark-th > span:first-child") ?? th).textContent.trim();

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  // ---------- 件数と集計の行 ----------

  /** 表の上の件数を、表示している行の数と全ての行の数に書き換える。 */
  const updateCount = (wrapper, table) => {
    const count = wrapper.querySelector(".mdmark-table-count");
    if (!count) return;
    const rows = bodyRows(table);
    const shown = rows.filter((row) => !row.hidden).length;
    count.querySelector("[aria-hidden]").textContent = `${shown} / ${rows.length} 件`;
    count.querySelector(".mdmark-visually-hidden").textContent = `${rows.length} 件中 ${shown} 件を表示`;
  };

  /** 集計の行の各セルを、表示している行の値で計算し直す。 */
  const updateTotals = (table) => {
    const shownRows = bodyRows(table).filter((row) => !row.hidden);
    for (const cell of table.querySelectorAll("tfoot td[data-total]")) {
      const kind = cell.dataset.total;
      const texts = shownRows.map((row) => row.cells[cell.cellIndex].textContent.trim());
      const numbers = texts.map(toNumber).filter((value) => value !== null);
      let value;
      // count: 空でないセルの数。sum・avg: 数として読めないセルを除いて計算する
      if (kind === "count") value = totalFormat.format(texts.filter((text) => text !== "").length);
      else if (kind === "sum") value = totalFormat.format(numbers.reduce((total, number) => total + number, 0));
      else value = numbers.length ? totalFormat.format(numbers.reduce((total, number) => total + number, 0) / numbers.length) : NO_VALUE;
      cell.innerHTML = `<span class="mdmark-total-label">${TOTAL_LABELS[kind]}</span><span class="mdmark-total-value">${value}</span>`;
    }
  };

  // ---------- 列の表示の切り替え ----------

  // 表の入れ物ごとの、隠している列の位置
  const hiddenColumns = new WeakMap();

  /** 表の入れ物の hide= の列の位置（既定で隠す列）を返す。 */
  const defaultHidden = (wrapper) =>
    new Set((wrapper.dataset.hiddenColumns ?? "").split(",").filter(Boolean).map(Number));

  /** 隠している列を見出しとセルに当て、メニューのチェックボックス・ボタンの状態を合わせる。 */
  const applyColumns = (wrapper) => {
    const table = wrapper.querySelector("table");
    const hidden = hiddenColumns.get(wrapper);
    const columnCount = table.tHead.rows[0].cells.length;
    const shownCount = columnCount - hidden.size;
    for (const row of table.rows) {
      // 行の詳細の行と一致なしの行（1 つのセルが全ての列にまたがる）: 表示している列の数にまたがらせる
      if (row.matches(".mdmark-row-detail, .mdmark-table-empty")) {
        row.cells[0].colSpan = shownCount;
        continue;
      }
      [...row.cells].forEach((cell, i) => {
        cell.hidden = hidden.has(i);
      });
    }
    const menu = wrapper.querySelector(".mdmark-columns-menu");
    if (!menu) return;
    // 先頭の列（行の識別子）は外せない: そのチェックボックスは押せないまま、理由をメニューの中に出しておく
    for (const input of menu.querySelectorAll(".mdmark-columns-options input")) {
      const index = Number(input.value);
      input.checked = !hidden.has(index);
      input.disabled = index === 0;
    }
    const button = wrapper.querySelector(`[aria-controls="${menu.id}"]`);
    button.classList.toggle("is-active", hidden.size > 0);
    button.querySelector(".mdmark-visually-hidden").textContent = hidden.size ? `（${hidden.size} 列を隠しています）` : "";
  };

  /** メニューを押したボタンの下に置き、画面の端からはみ出さないようにする。 */
  const placeMenu = (menu, button) => {
    const rect = button.getBoundingClientRect();
    const gutter = 16;
    const left = Math.min(Math.max(rect.left, gutter), window.innerWidth - menu.offsetWidth - gutter);
    const below = rect.bottom + 4;
    const top = below + menu.offsetHeight > window.innerHeight - gutter ? Math.max(gutter, rect.top - menu.offsetHeight - 4) : below;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  // 開いている列の表示のメニューと、それを開いたボタン（同時に開くのは 1 つだけ）
  let openMenu = null;

  /** メニューを閉じる。returnFocus が真なら、開いたボタンへフォーカスを戻す。 */
  const closeMenu = (returnFocus) => {
    if (!openMenu) return;
    const { menu, button } = openMenu;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
    openMenu = null;
  };

  /** メニューを開いてボタンの下に置き、最初の押せるチェックボックスへフォーカスを移す。 */
  const openColumnsMenu = (menu, button, focus) => {
    closeMenu(false);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    placeMenu(menu, button);
    if (focus) menu.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
    openMenu = { menu, button };
  };

  // メニューの外を押したとき: 閉じる（開いたボタンを押したときは、ボタンのクリックが閉じる）
  document.addEventListener("pointerdown", (event) => {
    if (openMenu && !openMenu.menu.contains(event.target) && !openMenu.button.contains(event.target)) closeMenu(false);
  });

  // Esc: 閉じて、開いたボタンへフォーカスを戻す
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openMenu) closeMenu(true);
  });

  /** メニューの外がスクロールしたとき・画面の幅が変わったとき: ボタンに付いて動かし、ボタンが画面から出たら閉じる。 */
  const followMenuButton = (event) => {
    if (!openMenu || (event.target instanceof Node && openMenu.menu.contains(event.target))) return;
    const rect = openMenu.button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) closeMenu(false);
    else placeMenu(openMenu.menu, openMenu.button);
  };
  document.addEventListener("scroll", followMenuButton, true);
  window.addEventListener("resize", followMenuButton);

  // ---------- 表のコピー ----------

  /** 見出しの行と表示している行の、表示している列を、セルをタブで、行を改行で区切ったテキストにする（集計の行は含めない）。 */
  const tableToTsv = (table) => {
    const visibleCells = (row) => [...row.cells].filter((cell) => !cell.hidden);
    const head = visibleCells(table.tHead.rows[0]).map(columnName);
    const body = bodyRows(table)
      .filter((row) => !row.hidden)
      .map((row) => visibleCells(row).map((cell) => cell.textContent.trim()));
    return [head, ...body].map((cells) => cells.join("\t")).join("\n");
  };

  /** コピーのボタンに状態（idle・copied・failed）の文言とアイコンを当て、読み上げにも知らせる。 */
  const setCopyState = (wrapper, state) => {
    const button = wrapper.querySelector(".mdmark-copy");
    button.dataset.state = state;
    button.innerHTML = `${icon(state === "idle" ? "copy" : state)}${COPY_LABELS[state]}`;
    wrapper.querySelector(".mdmark-copy-status").textContent = state === "idle" ? "" : COPY_LABELS[state];
  };

  /** 表をクリップボードへ書き、書けたか・書けなかったかをボタンで知らせる。 */
  const copyTable = async (wrapper) => {
    const table = wrapper.querySelector("table");
    setCopyState(wrapper, "idle");
    try {
      if (!navigator.clipboard) throw new Error("クリップボードを使えない");
      await navigator.clipboard.writeText(tableToTsv(table));
      setCopyState(wrapper, "copied");
      setTimeout(() => {
        if (wrapper.querySelector(".mdmark-copy").dataset.state === "copied") setCopyState(wrapper, "idle");
      }, COPIED_NOTICE_MS);
    } catch {
      setCopyState(wrapper, "failed");
    }
  };

  // ---------- 行へのリンク ----------

  /** URL の #ID が表の行を指すとき、閉じた表・閉じた節を開き、絞り込みで隠れていれば外してから行へ移り、行を強調する。 */
  const revealRow = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const row = id ? document.getElementById(id) : null;
    if (!row?.matches(".mdmark-table tbody tr")) return;
    const wrapper = row.closest(".mdmark-table");
    // 閉じた表: 折り畳みを開く
    const details = row.closest("details");
    if (details) details.open = true;
    // 閉じた節: 外側から開く
    for (let body = row.closest(".mdmark-section-body"); body; body = body.parentElement.closest(".mdmark-section-body")) {
      const toggle = document.querySelector(`[aria-controls="${body.id}"]`);
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    }
    // 絞り込みで隠れた行: その表の絞り込みの入力を全て空にし、絞り込みを当て直させる
    if (row.hidden) {
      for (const input of wrapper.querySelectorAll(".mdmark-filter-drawer input:not(.mdmark-filter-search)")) {
        if (input.type === "checkbox") input.checked = false;
        else input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    for (const other of document.querySelectorAll(".mdmark-table tr.is-target")) other.classList.remove("is-target");
    row.classList.add("is-target");
    row.scrollIntoView({ block: "center" });
  };

  // ---------- 表ごとの組み立て ----------

  for (const wrapper of document.querySelectorAll(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    const update = () => {
      updateCount(wrapper, table);
      updateTotals(table);
    };
    // 絞り込みの入力・絞り込みを外すボタン（syntax.js が行を出し分けた後）: 件数と集計を計算し直す
    wrapper.addEventListener("input", () => setTimeout(update));
    wrapper.addEventListener("click", () => setTimeout(update));
    update();

    // 列の表示の切り替え
    hiddenColumns.set(wrapper, defaultHidden(wrapper));
    applyColumns(wrapper);
    const menu = wrapper.querySelector(".mdmark-columns-menu");
    if (menu) {
      const button = wrapper.querySelector(`[aria-controls="${menu.id}"]`);
      button.addEventListener("click", () => {
        if (menu.hidden) openColumnsMenu(menu, button, true);
        else if (openMenu?.menu === menu) closeMenu(false);
        else {
          // モックで開いたまま見せているメニュー: 閉じるだけにする
          menu.hidden = true;
          button.setAttribute("aria-expanded", "false");
        }
      });
      for (const input of menu.querySelectorAll(".mdmark-columns-options input")) {
        input.addEventListener("change", () => {
          const hidden = hiddenColumns.get(wrapper);
          if (input.checked) hidden.delete(Number(input.value));
          else hidden.add(Number(input.value));
          applyColumns(wrapper);
        });
      }
      menu.querySelector(".mdmark-columns-reset").addEventListener("click", () => {
        hiddenColumns.set(wrapper, defaultHidden(wrapper));
        applyColumns(wrapper);
      });
      // モックで開いたまま見せるメニュー: 表の入れ物の中に置き（catalog.css）、スクロールに付いて動かさない
      if (wrapper.dataset.mockOpen === "columns") {
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
      }
    }

    // 表のコピー
    const copy = wrapper.querySelector(".mdmark-copy");
    if (copy) {
      copy.addEventListener("click", () => copyTable(wrapper));
      if (wrapper.dataset.mockCopy) setCopyState(wrapper, wrapper.dataset.mockCopy);
    }
  }

  window.addEventListener("hashchange", revealRow);
  revealRow();

  // ---------- モックだけの「印刷の見え方」 ----------

  const previewButton = document.querySelector("[data-preview-toggle]");
  if (previewButton) {
    const root = document.documentElement;
    const printStyles = [...document.querySelectorAll("[data-print-styles]")];
    const { expand, restore } = window.mdmarkMockPrint;
    let schemeBeforePreview = "";

    /** 印刷の見え方を画面に当てているかを返す。 */
    const previewing = () => printStyles[0].media === "all";

    /** 印刷の規則の link の media を切り替える。 */
    const setPrintMedia = (media) => {
      for (const link of printStyles) link.media = media;
    };

    // 印刷の前後（実装でも持つ処理）: 閉じた記法の展開だけを受け持つ
    window.addEventListener("beforeprint", () => {
      if (!previewing()) expand();
    });
    window.addEventListener("afterprint", () => {
      if (!previewing()) restore();
    });

    /** 印刷の見え方を抜ける。配色は restoreScheme が真のときだけ戻す。 */
    const leavePreview = (restoreScheme) => {
      restore();
      if (restoreScheme) root.dataset.scheme = schemeBeforePreview;
      setPrintMedia("print");
      previewButton.setAttribute("aria-pressed", "false");
    };

    // 印刷の規則を画面にも当て、紙と同じく明るい配色にする。押し直すと戻す
    previewButton.addEventListener("click", () => {
      if (previewing()) {
        leavePreview(true);
        return;
      }
      closeMenu(false);
      expand();
      schemeBeforePreview = root.dataset.scheme;
      root.dataset.scheme = "light";
      setPrintMedia("all");
      previewButton.setAttribute("aria-pressed", "true");
    });

    // 印刷の見え方の間に配色を変えたら、選んだ配色のまま印刷の見え方を抜ける
    for (const button of document.querySelectorAll("[data-scheme-set]")) {
      button.addEventListener("click", () => {
        if (previewing()) leavePreview(false);
      });
    }
  }
}
