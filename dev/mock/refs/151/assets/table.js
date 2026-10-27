// 表の操作（実装の mount が付ける振る舞いのモック）: 件数の表示・列の表示の切り替え・計算ごとの集計の行と集計のメニュー・
// 形式を選ぶ表のコピーとコピーできないときのパネル・行の URL のコピー・狭い幅で畳む最終列・見出し行と集計の行をページのスクロールで留める処理。
// 並べ替え・絞り込み・ピン止め・行の詳細の開閉は refs/19/assets/syntax.js が受け持ち、この前に読む。
// モックだけの指定（html の data-*）: data-mock-fold（最終列を畳む案 "a" / "b"）・data-mock-fold-open（開き方の案 "a" / "b"）・
// data-mock-sticky（"c" で animation-timeline を持つブラウザでも案 C で留める）・data-mock-clipboard（"fail" でクリップボードに書けなくする）。
// 表の入れ物の data-*: data-hidden-columns（hide= の列の位置）・data-mock-open（開いたまま見せるメニュー "columns" / "totals" / "copy"）・
// data-mock-copy（"copied" / "failed" の知らせを出したまま見せる）・data-mock-row-notice（先頭の行の URL の知らせ "copied" / "failed" を出したまま見せる）・
// data-mock-unreadable（集計できない列の知らせ方 "box"（表の上の書き方の警告）/ "cell"（集計の行のセル））

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const root = document.documentElement;
  const mock = {
    fold: root.dataset.mockFold ?? "a",
    foldOpen: root.dataset.mockFoldOpen ?? "a",
    sticky: root.dataset.mockSticky,
    clipboardFails: root.dataset.mockClipboard === "fail",
  };

  // 操作の部品のアイコンの線（24 の格子。lucide の形）
  const ICON_PATHS = {
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    copied: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    total: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  // コピーのボタンの文言（状態ごと）
  const COPY_LABELS = { idle: "表をコピー", copied: "コピーしました", failed: "コピーできませんでした" };

  // コピーの形式の名前（読み上げの知らせに使う）
  const FORMAT_NAMES = { markdown: "Markdown の表", tsv: "TSV" };

  // コピーしたことの知らせを出しておく時間（ミリ秒）
  const COPIED_NOTICE_MS = 2000;

  // 計算の名前と、集計の行に並べる順
  const TOTAL_LABELS = { sum: "合計", avg: "平均", count: "件数" };
  const TOTAL_ORDER = ["sum", "avg", "count"];

  // 集計の値の書式: 桁区切りを付け、小数は 2 桁までにする
  const totalFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

  // 集計する値が 1 つも無いときの平均の表示
  const NO_VALUE = "—";

  // 最終列を畳む幅（描いた文書の幅か画面の幅がこれ未満のとき）
  const FOLD_WIDTH = 720;

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

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

  /** クリップボードへ書く（モックの指定で書けなくする）。 */
  const writeClipboard = async (text) => {
    if (mock.clipboardFails || !navigator.clipboard) throw new Error("クリップボードに書けない");
    await navigator.clipboard.writeText(text);
  };

  /** 表の読み上げの知らせを入れる。 */
  const announce = (wrapper, text) => {
    const status = wrapper.querySelector(".mdmark-table-status, .mdmark-copy-status");
    if (status) status.textContent = text;
  };

  // ---------- 前の形の HTML を今の形にする（部品のカタログの既存の見本） ----------

  /** 道具の帯が無ければ作る。 */
  const ensureBar = (wrapper) => {
    let bar = wrapper.querySelector(".mdmark-table-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "mdmark-table-bar";
      bar.innerHTML = '<div class="mdmark-table-tools"></div><span class="mdmark-visually-hidden mdmark-table-status" role="status"></span>';
      wrapper.querySelector("table").before(bar);
    }
    // 件数だけの帯: ボタンを並べる場所を件数の後ろに作る
    if (!bar.querySelector(".mdmark-table-tools")) {
      const tools = document.createElement("div");
      tools.className = "mdmark-table-tools";
      bar.querySelector(".mdmark-table-count").after(tools);
    }
    return bar;
  };

  /** 1 行の集計の行（列ごとの data-total）を、計算ごとの行に分ける。 */
  const splitTotalRows = (table) => {
    const foot = table.tFoot;
    const source = foot?.rows[0];
    if (!source || source.dataset.totalKind) return [];
    const kindsByColumn = [...source.cells].map((cell) => (cell.dataset.total ?? "").split(" ").filter(Boolean));
    const kinds = TOTAL_ORDER.filter((kind) => kindsByColumn.some((list) => list.includes(kind)));
    foot.replaceChildren(
      ...kinds.map((kind) => {
        const row = source.cloneNode(true);
        row.dataset.totalKind = kind;
        [...row.cells].forEach((cell, i) => {
          if (kindsByColumn[i].includes(kind)) cell.dataset.total = kind;
          else delete cell.dataset.total;
        });
        return row;
      }),
    );
    return kinds;
  };

  /** 集計のボタンとメニューが無ければ作る。 */
  const ensureTotalsMenu = (wrapper, kinds) => {
    if (!kinds.length || wrapper.querySelector(".mdmark-totals-toggle")) return;
    const id = `${wrapper.querySelector("table").getAttribute("aria-label")}-totals`.replace(/\s/g, "");
    const button = document.createElement("button");
    button.className = "mdmark-table-tool mdmark-totals-toggle";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", id);
    button.innerHTML = `${icon("total")}集計<span class="mdmark-visually-hidden"></span>`;
    const tools = ensureBar(wrapper).querySelector(".mdmark-table-tools");
    tools.insertBefore(button, tools.querySelector(".mdmark-copy"));
    const menu = document.createElement("div");
    menu.className = "mdmark-totals-menu mdmark-table-menu";
    menu.id = id;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "出す集計");
    menu.hidden = true;
    menu.innerHTML = `<p class="mdmark-columns-title">出す集計</p><ul class="mdmark-columns-options">${kinds
      .map((kind) => `<li><label><input type="checkbox" value="${kind}" checked>${TOTAL_LABELS[kind]}</label></li>`)
      .join("")}</ul>`;
    wrapper.append(menu);
  };

  /** 形式を選ばないコピーのボタンを、形式のメニューを開くボタンにする。 */
  const ensureCopyMenu = (wrapper) => {
    const button = wrapper.querySelector(".mdmark-copy");
    if (!button || button.hasAttribute("aria-controls")) return;
    const id = `${wrapper.querySelector("table").getAttribute("aria-label")}-copy`.replace(/\s/g, "");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", id);
    button.innerHTML = `${icon("copy")}<span class="mdmark-copy-label">${COPY_LABELS.idle}</span>${icon("chevron")}`;
    const menu = document.createElement("div");
    menu.className = "mdmark-copy-menu mdmark-table-menu";
    menu.id = id;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "コピーの形式");
    menu.hidden = true;
    menu.innerHTML = `<p class="mdmark-columns-title">コピーの形式</p><ul class="mdmark-copy-options">
      <li><button class="mdmark-copy-format" type="button" data-format="markdown"><span class="mdmark-copy-format-name">Markdown の表</span><span class="mdmark-copy-format-note">文書に貼るとそのまま表になる</span></button></li>
      <li><button class="mdmark-copy-format" type="button" data-format="tsv"><span class="mdmark-copy-format-name">TSV</span><span class="mdmark-copy-format-note">表計算ソフトに貼るとセルに分かれる</span></button></li></ul>`;
    wrapper.append(menu);
  };

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

  /** sum・avg の列のうち、数として読めないセル（空のセルは除く）を持つ列の位置と、その値を返す。 */
  const unreadableColumns = (table) => {
    const result = new Map();
    for (const cell of table.tFoot?.querySelectorAll("td[data-total]") ?? []) {
      if (cell.dataset.total === "count") continue;
      const values = bodyRows(table)
        .map((row) => row.cells[cell.cellIndex].textContent.trim())
        .filter((text) => text !== "" && toNumber(text) === null);
      if (values.length) result.set(cell.cellIndex, [...new Set(values)]);
    }
    return result;
  };

  /** 集計の行の各セルを、表示している行の値で計算し直す。数として読めないセルを持つ列の sum・avg は空にする。 */
  const updateTotals = (wrapper, table, unreadable) => {
    const shownRows = bodyRows(table).filter((row) => !row.hidden);
    for (const row of table.tFoot?.rows ?? []) {
      const kind = row.dataset.totalKind;
      if (!kind) continue;
      // 先頭のセル: 計算の名前。先頭の列も集計するときは、名前と分けて値をセルの末尾に置く
      const first = row.cells[0];
      for (const cell of row.cells) {
        const parts = [];
        if (cell === first) parts.push(`<span class="mdmark-total-name">${TOTAL_LABELS[kind]}</span>`);
        if (cell.dataset.total) {
          const texts = shownRows.map((r) => r.cells[cell.cellIndex].textContent.trim());
          const numbers = texts.map(toNumber).filter((value) => value !== null);
          if (kind !== "count" && unreadable.has(cell.cellIndex)) {
            // 数として読めないセルがある列: 集計を出さない。セルで知らせる案のときだけ理由をセルに書く
            if (wrapper.dataset.mockUnreadable === "cell") {
              const values = unreadable.get(cell.cellIndex).map((value) => `<code>${value}</code>`).join("・");
              parts.push(`<span class="mdmark-total-unreadable">${icon("failed")}集計できません（数でない値 ${values}）</span>`);
            }
          } else {
            let value;
            if (kind === "count") value = totalFormat.format(texts.filter((text) => text !== "").length);
            else if (kind === "sum") value = totalFormat.format(numbers.reduce((total, number) => total + number, 0));
            else value = numbers.length ? totalFormat.format(numbers.reduce((total, number) => total + number, 0) / numbers.length) : NO_VALUE;
            parts.push(`<span class="mdmark-total-value">${value}</span>`);
          }
        }
        cell.innerHTML = parts.join("");
      }
    }
  };

  // ---------- 道具の帯のメニュー（列の表示・集計・コピーの形式） ----------

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

  // 開いているメニューと、それを開いたボタン（同時に開くのは 1 つだけ）
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

  /** メニューを開いてボタンの下に置き、最初の押せる部品へフォーカスを移す。 */
  const openToolMenu = (menu, button) => {
    closeMenu(false);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    placeMenu(menu, button);
    menu.querySelector("input:not(:disabled), button")?.focus({ preventScroll: true });
    openMenu = { menu, button };
  };

  // メニューの外を押したとき: 閉じる（開いたボタンを押したときは、ボタンのクリックが閉じる）
  document.addEventListener("pointerdown", (event) => {
    if (openMenu && !openMenu.menu.contains(event.target) && !openMenu.button.contains(event.target)) closeMenu(false);
  });

  // Esc: 開いているメニューかコピーのパネルを閉じて、開いたボタンへフォーカスを戻す
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (openMenu) {
      closeMenu(true);
      return;
    }
    const panel = event.target.closest?.(".mdmark-copy-panel");
    if (panel) closeCopyPanel(panel.closest(".mdmark-table"));
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

  // ---------- 出す集計の選択 ----------

  /** チェックを外した計算の集計の行を隠し、ボタンの状態を合わせる。 */
  const applyTotalKinds = (wrapper) => {
    const menu = wrapper.querySelector(".mdmark-totals-menu");
    if (!menu) return;
    const unchecked = [...menu.querySelectorAll("input")].filter((input) => !input.checked).map((input) => input.value);
    for (const row of wrapper.querySelector("table").tFoot.rows) row.hidden = unchecked.includes(row.dataset.totalKind);
    const button = wrapper.querySelector(".mdmark-totals-toggle");
    button.classList.toggle("is-active", unchecked.length > 0);
    button.querySelector(".mdmark-visually-hidden").textContent = unchecked.length ? `（${unchecked.length} 件を隠しています）` : "";
  };

  // ---------- 表のコピー ----------

  /** 見えている見出しの行と本文の行の、見えている列のセルの文字を返す（集計の行は含めない）。 */
  const visibleGrid = (table) => {
    const visibleCells = (row) => [...row.cells].filter((cell) => !cell.hidden);
    const head = visibleCells(table.tHead.rows[0]);
    const body = bodyRows(table)
      .filter((row) => !row.hidden)
      .map((row) => visibleCells(row).map((cell) => cell.textContent.trim()));
    return { head, body };
  };

  /** 表を TSV（セルをタブ、行を改行で区切る）にする。 */
  const tableToTsv = (table) => {
    const { head, body } = visibleGrid(table);
    return [head.map(columnName), ...body].map((cells) => cells.join("\t")).join("\n");
  };

  /** 表を Markdown の表にする。セルの中の | は \| にし、右揃えの列は区切りの行を ---: にする。 */
  const tableToMarkdown = (table) => {
    const { head, body } = visibleGrid(table);
    const line = (cells) => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
    const rule = head.map((th) => (th.classList.contains("mdmark-align-right") ? "---:" : th.classList.contains("mdmark-align-center") ? ":---:" : "---"));
    return [line(head.map(columnName)), `| ${rule.join(" | ")} |`, ...body.map(line)].join("\n");
  };

  /** コピーのボタンに状態（idle・copied・failed）の文言とアイコンを当てる。 */
  const setCopyState = (wrapper, state) => {
    const button = wrapper.querySelector(".mdmark-copy");
    button.dataset.state = state;
    button.innerHTML = `${icon(state === "idle" ? "copy" : state)}<span class="mdmark-copy-label">${COPY_LABELS[state]}</span>${icon("chevron")}`;
  };

  /** コピーできないときのパネルを閉じ、コピーのボタンへフォーカスを戻す。 */
  const closeCopyPanel = (wrapper) => {
    wrapper.querySelector(".mdmark-copy-panel")?.remove();
    wrapper.querySelector(".mdmark-copy").focus();
  };

  /** コピーできないときのパネル: コピーする中身を選択した状態で、道具の帯の下に出す。 */
  const openCopyPanel = (wrapper, text, format) => {
    wrapper.querySelector(".mdmark-copy-panel")?.remove();
    const id = `${wrapper.querySelector(".mdmark-copy").getAttribute("aria-controls")}-panel`;
    const panel = document.createElement("div");
    panel.className = "mdmark-copy-panel";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-labelledby", `${id}-title`);
    panel.innerHTML = `<div class="mdmark-copy-panel-head">
      <p class="mdmark-copy-panel-title" id="${id}-title">${icon("failed")}クリップボードにコピーできませんでした</p>
      <button class="mdmark-copy-panel-close" type="button" aria-label="閉じる" title="閉じる">${icon("close")}</button>
    </div>
    <p class="mdmark-copy-panel-note">「${FORMAT_NAMES[format]}」の中身を選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p>
    <textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="${id}-title" spellcheck="false"></textarea>`;
    panel.querySelector("textarea").value = text;
    panel.querySelector(".mdmark-copy-panel-close").addEventListener("click", () => closeCopyPanel(wrapper));
    wrapper.querySelector(".mdmark-table-bar").after(panel);
    const area = panel.querySelector("textarea");
    area.focus({ preventScroll: true });
    area.select();
  };

  /** 選んだ形式で表をクリップボードへ書き、書けたらボタンで知らせ、書けなければパネルを出す。 */
  const copyTable = async (wrapper, format) => {
    const table = wrapper.querySelector("table");
    const text = format === "markdown" ? tableToMarkdown(table) : tableToTsv(table);
    wrapper.querySelector(".mdmark-copy-panel")?.remove();
    try {
      await writeClipboard(text);
    } catch {
      setCopyState(wrapper, "idle");
      announce(wrapper, `クリップボードにコピーできませんでした。選択した${FORMAT_NAMES[format]}を手でコピーできます`);
      openCopyPanel(wrapper, text, format);
      return;
    }
    setCopyState(wrapper, "copied");
    announce(wrapper, `${FORMAT_NAMES[format]}をコピーしました`);
    setTimeout(() => {
      if (wrapper.querySelector(".mdmark-copy").dataset.state === "copied") setCopyState(wrapper, "idle");
    }, COPIED_NOTICE_MS);
  };

  // ---------- 行の URL のコピーと、行へのリンク ----------

  /** 行のリンクの印の横に、URL をコピーした・できなかったの知らせを出す。stay が真なら消さない。 */
  const showRowNotice = (anchor, state, stay) => {
    const cell = anchor.closest(".mdmark-row-link-cell");
    cell.querySelector(".mdmark-row-link-notice")?.remove();
    const notice = document.createElement("span");
    notice.className = "mdmark-row-link-notice";
    notice.dataset.state = state;
    notice.setAttribute("role", "status");
    notice.innerHTML = state === "copied" ? `${icon("copied")}リンクをコピーしました` : `${icon("failed")}リンクをコピーできませんでした`;
    cell.append(notice);
    if (!stay) setTimeout(() => notice.remove(), COPIED_NOTICE_MS);
  };

  // 行のリンクの印を押したとき: 移る動き（アドレスバーの URL を行を指す URL にする）はそのままに、解決済みの href をコピーして知らせる
  document.addEventListener("click", async (event) => {
    const anchor = event.target.closest?.(".mdmark-row-anchor");
    if (!anchor) return;
    try {
      await writeClipboard(anchor.href);
      showRowNotice(anchor, "copied", false);
    } catch {
      showRowNotice(anchor, "failed", false);
    }
  });

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

  // ---------- 狭い幅で畳む最終列 ----------

  // 本文の行ごとの、畳んだ最終列を出す行（開き方の案 b と、行の詳細を持たない行）
  const foldRows = new WeakMap();

  /** 先頭のセルの中身を、開閉のボタンと横に並べる入れ物に入れて返す。 */
  const rowHead = (row) => {
    const first = row.cells[0];
    let head = first.querySelector(".mdmark-row-head");
    if (!head) {
      head = document.createElement("span");
      head.className = "mdmark-row-head";
      head.append(...first.childNodes);
      first.append(head);
    }
    return head;
  };

  /** 畳んだ最終列の見出しと中身（行の下に出す）。 */
  const foldPart = (name, cell) => {
    const part = document.createElement("div");
    part.className = "mdmark-fold-part";
    part.innerHTML = `<p class="mdmark-fold-name">${name}</p><div class="mdmark-fold-value">${cell.innerHTML}</div>`;
    return part;
  };

  /** 開閉のボタンと、開いたときに出す行を開閉する。 */
  const bindToggle = (toggle, detailRow) => {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      detailRow.hidden = !open;
    });
  };

  /** 表の各行に、畳んだ最終列を開くボタンと開いたときの中身を置く（畳んでいない間は CSS で出さない）。 */
  const setupFold = (wrapper, table) => {
    const headCells = table.tHead.rows[0].cells;
    const last = headCells.length - 1;
    if (last < 1) return;
    const name = columnName(headCells[last]);
    for (const cell of table.querySelectorAll(`tr > :nth-child(${last + 1})`)) {
      if (!cell.closest(".mdmark-row-detail, .mdmark-table-empty")) cell.classList.add("mdmark-fold-col");
    }
    for (const row of bodyRows(table)) {
      const label = row.cells[0].textContent.trim();
      const detail = row.nextElementSibling?.matches(".mdmark-row-detail") ? row.nextElementSibling : null;
      // 案 a: 行の詳細を持つ行は、詳細の中身の上に最終列を並べ、開閉を 1 つにまとめる
      if (mock.foldOpen === "a" && detail) {
        detail.cells[0].prepend(foldPart(name, row.cells[last]));
        continue;
      }
      const foldRow = document.createElement("tr");
      foldRow.className = "mdmark-row-detail mdmark-fold-detail";
      foldRow.id = `${row.id || label}-fold`;
      foldRow.hidden = true;
      const td = document.createElement("td");
      td.colSpan = headCells.length;
      td.append(foldPart(name, row.cells[last]));
      foldRow.append(td);
      (detail ?? row).after(foldRow);
      foldRows.set(row, foldRow);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", foldRow.id);
      if (mock.foldOpen === "a") {
        // 案 a の行の詳細を持たない行: 行の詳細と同じ開閉のボタンを先頭に置く
        toggle.className = "mdmark-row-toggle mdmark-fold-toggle";
        toggle.setAttribute("aria-label", `「${label}」の${name}`);
        toggle.innerHTML = icon("chevron");
        rowHead(row).prepend(toggle);
      } else {
        // 案 b: 行の詳細の開閉と別に、最終列の名前を書いた開閉のボタンを先頭のセルの後ろに置く
        toggle.className = "mdmark-fold-toggle mdmark-fold-toggle-named";
        toggle.setAttribute("aria-label", `「${label}」の${name}`);
        toggle.innerHTML = `${name}${icon("chevron")}`;
        rowHead(row).append(toggle);
      }
      bindToggle(toggle, foldRow);
    }
  };

  /** 並べ替え・絞り込みの後: 案 b の最終列の行を親の行の後ろへ戻し、親の行が隠れたら一緒に隠す。 */
  const syncFoldRows = (table) => {
    for (const row of bodyRows(table)) {
      const foldRow = foldRows.get(row);
      if (!foldRow) continue;
      const detail = row.nextElementSibling?.matches(".mdmark-row-detail:not(.mdmark-fold-detail)") ? row.nextElementSibling : null;
      (detail ?? row).after(foldRow);
      const toggle = row.querySelector(".mdmark-fold-toggle");
      foldRow.hidden = row.hidden || toggle.getAttribute("aria-expanded") !== "true";
    }
  };

  /** 最終列のどれかのセルが 1 行に収まらないか: 最終列を折り返さないときにだけ表が横にはみ出すかで測る。 */
  const lastColumnOverflows = (wrapper, table) => {
    wrapper.classList.remove("is-folded");
    wrapper.classList.add("is-measuring");
    const wrapped = table.scrollWidth;
    wrapper.classList.add("is-measuring-nowrap");
    const nowrap = table.scrollWidth;
    const overflows = nowrap > table.clientWidth && nowrap > wrapped + 1;
    wrapper.classList.remove("is-measuring", "is-measuring-nowrap");
    return overflows;
  };

  /** 畳むかを決めて当てる。案 a は描いた文書の幅と最終列の長さ、案 b は画面の幅だけで決める。 */
  const updateFold = (wrapper, table) => {
    const lastHidden = table.tHead.rows[0].lastElementChild.hidden;
    let folded;
    if (lastHidden) folded = false;
    else if (mock.fold === "b") folded = window.innerWidth < FOLD_WIDTH;
    else folded = wrapper.closest(".mdmark").clientWidth < FOLD_WIDTH && lastColumnOverflows(wrapper, table);
    wrapper.classList.toggle("is-folded", folded);
  };

  // ---------- 見出し行と集計の行をページのスクロールで留める ----------

  // animation-timeline を持つブラウザ（案 D で留める）か。範囲の指定まで持たない途中の対応は案 C にする
  const supportsTimeline = CSS.supports("(animation-timeline: view()) and (animation-range: 0% 100%)");

  /** 留める方式: animation-timeline を持つブラウザは案 D、持たないブラウザは案 C（モックの指定 "c" で持つブラウザでも案 C にする）。 */
  const stickyMode = supportsTimeline && mock.sticky !== "c" ? "d" : "c";

  /** 画面の上端から見出し行を留める位置のずれ（使う側が CSS カスタムプロパティで渡す。既定 0）。 */
  const stickyTop = (table) => Number.parseFloat(getComputedStyle(table).getPropertyValue("--mdmark-sticky-top")) || 0;

  /** 案 D: 見出し行と集計の行の動く範囲だけを変数で渡し、ずらすのは CSS のスクロール連動のアニメーションに任せる。 */
  const updateTimelineRange = (table) => {
    // 位置と高さは端数を丸めずに測る（丸めると留めた行が画面の端から端数の分だけずれ、後ろの本文の行が透ける）
    const tableRect = table.getBoundingClientRect();
    const head = table.tHead.getBoundingClientRect();
    const body = table.tBodies[0].getBoundingClientRect();
    // 表の上端から見出し行の上端まで（枠の太さ）と、見出し行を下げられる量（本文の最後の行の下端まで）
    table.style.setProperty("--mdmark-mock-head-start", `${head.top - tableRect.top}px`);
    table.style.setProperty("--mdmark-mock-head-max", `${Math.max(0, body.bottom - head.bottom)}px`);
    if (table.tFoot) {
      const foot = table.tFoot.getBoundingClientRect();
      // 集計の行を上げられる量（本文の最初の行の上端まで）と、表の下端から集計の行の下端まで
      table.style.setProperty("--mdmark-mock-foot-max", `${foot.top - body.top}px`);
      table.style.setProperty("--mdmark-mock-foot-end", `${tableRect.bottom - foot.bottom}px`);
    }
  };

  /** 案 C: 見出し行と集計の行の、ずらす前の画面上の位置からずれを求めて変数で渡す。 */
  const updateShift = (table) => {
    // 位置と高さは端数を丸めずに測る（ずらすのはセルなので、行のまとまりの位置はずらす前のまま）
    const head = table.tHead.getBoundingClientRect();
    const body = table.tBodies[0].getBoundingClientRect();
    // 見出し行: 画面の上端（ずれの分だけ下）より上に出た分だけ下げ、本文の最後の行より下へは下げない
    const headMax = Math.max(0, body.bottom - head.bottom);
    const headShift = Math.min(Math.max(0, stickyTop(table) - head.top), headMax);
    table.style.setProperty("--mdmark-mock-head-shift", `${headShift}px`);
    if (table.tFoot) {
      const foot = table.tFoot.getBoundingClientRect();
      // 集計の行: 画面の下端より下に出た分だけ上げ、本文の最初の行より上へは上げない
      const footMin = Math.min(0, body.top - foot.top);
      const footShift = Math.max(Math.min(0, window.innerHeight - foot.bottom), footMin);
      table.style.setProperty("--mdmark-mock-foot-shift", `${footShift}px`);
      // 下端に留めている間だけ、最後の行の面を下へはみ出させる
      table.style.setProperty("--mdmark-mock-foot-reach", footShift < 0 ? "2px" : "0px");
    }
  };

  // 案 C で留める表（スクロールのたびにずれを入れ直す）
  const shiftTables = new Set();
  const updateShifts = () => {
    for (const table of shiftTables) updateShift(table);
  };
  if (stickyMode === "c") {
    window.addEventListener("scroll", updateShifts, { passive: true });
    document.addEventListener("scroll", updateShifts, { capture: true, passive: true });
    window.addEventListener("resize", updateShifts);
  }

  /** 表を留める方式を当て、表の大きさが変わったら範囲・ずれを入れ直す。 */
  const setupSticky = (wrapper, table) => {
    wrapper.classList.add(stickyMode === "d" ? "is-sticky-timeline" : "is-sticky-shift");
    const update = () => (stickyMode === "d" ? updateTimelineRange(table) : updateShift(table));
    if (stickyMode === "c") shiftTables.add(table);
    new ResizeObserver(update).observe(table);
    update();
  };

  // ---------- 表ごとの組み立て ----------

  for (const wrapper of document.querySelectorAll(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    ensureTotalsMenu(wrapper, splitTotalRows(table));
    ensureCopyMenu(wrapper);
    const unreadable = unreadableColumns(table);

    const update = () => {
      syncFoldRows(table);
      updateCount(wrapper, table);
      updateTotals(wrapper, table, unreadable);
    };
    // 絞り込みの入力・並べ替え・絞り込みを外すボタン（syntax.js が行を出し分けた後）: 件数と集計を計算し直す
    wrapper.addEventListener("input", () => setTimeout(update));
    wrapper.addEventListener("click", () => setTimeout(update));

    // 列の表示の切り替え
    hiddenColumns.set(wrapper, defaultHidden(wrapper));
    applyColumns(wrapper);
    const columnsMenu = wrapper.querySelector(".mdmark-columns-menu");
    if (columnsMenu) {
      for (const input of columnsMenu.querySelectorAll(".mdmark-columns-options input")) {
        input.addEventListener("change", () => {
          const hidden = hiddenColumns.get(wrapper);
          if (input.checked) hidden.delete(Number(input.value));
          else hidden.add(Number(input.value));
          applyColumns(wrapper);
          updateFold(wrapper, table);
        });
      }
      columnsMenu.querySelector(".mdmark-columns-reset").addEventListener("click", () => {
        hiddenColumns.set(wrapper, defaultHidden(wrapper));
        applyColumns(wrapper);
        updateFold(wrapper, table);
      });
    }

    // 出す集計の選択
    const totalsMenu = wrapper.querySelector(".mdmark-totals-menu");
    if (totalsMenu) {
      for (const input of totalsMenu.querySelectorAll("input")) {
        input.addEventListener("change", () => {
          applyTotalKinds(wrapper);
          announce(wrapper, `${TOTAL_LABELS[input.value]}の行を${input.checked ? "出しました" : "隠しました"}`);
        });
      }
    }

    // 表のコピー: 形式を押すとメニューを閉じてコピーする
    for (const format of wrapper.querySelectorAll(".mdmark-copy-format")) {
      format.addEventListener("click", () => {
        closeMenu(false);
        wrapper.querySelector(".mdmark-copy").focus();
        copyTable(wrapper, format.dataset.format);
      });
    }

    // 道具の帯のボタン: 押したボタンのメニューを開閉する
    for (const button of wrapper.querySelectorAll(".mdmark-table-tool[aria-controls]")) {
      const menu = document.getElementById(button.getAttribute("aria-controls"));
      button.addEventListener("click", () => {
        if (menu.hidden) openToolMenu(menu, button);
        else if (openMenu?.menu === menu) closeMenu(false);
        else {
          // モックで開いたまま見せているメニュー: 閉じるだけにする
          menu.hidden = true;
          button.setAttribute("aria-expanded", "false");
        }
      });
    }

    // 畳む最終列: 描いた文書の幅か画面の幅が変わるたびに決め直す
    setupFold(wrapper, table);
    const article = wrapper.closest(".mdmark");
    new ResizeObserver(() => updateFold(wrapper, table)).observe(article);

    setupSticky(wrapper, table);
    update();

    // モックで開いたまま見せるメニュー・知らせ: 表の入れ物の中に置き（catalog.css）、スクロールに付いて動かさない
    if (wrapper.dataset.mockOpen) {
      const button = wrapper.querySelector(`.mdmark-${wrapper.dataset.mockOpen === "totals" ? "totals-toggle" : wrapper.dataset.mockOpen === "copy" ? "copy" : "columns-toggle"}`);
      document.getElementById(button.getAttribute("aria-controls")).hidden = false;
      button.setAttribute("aria-expanded", "true");
    }
    if (wrapper.dataset.mockCopy) setCopyState(wrapper, wrapper.dataset.mockCopy);
    if (wrapper.dataset.mockCopyPanel) openCopyPanel(wrapper, tableToMarkdown(table), "markdown");
    if (wrapper.dataset.mockRowNotice) showRowNotice(wrapper.querySelector(".mdmark-row-anchor"), wrapper.dataset.mockRowNotice, true);
    if (wrapper.dataset.mockUncheck) {
      for (const kind of wrapper.dataset.mockUncheck.split(",")) totalsMenu.querySelector(`input[value="${kind}"]`).checked = false;
      applyTotalKinds(wrapper);
    }
  }

  window.addEventListener("hashchange", revealRow);
  revealRow();
}
