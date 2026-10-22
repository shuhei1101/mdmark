// ビューと検索のモック（実装の mount とビューを描く関数が付ける振る舞い）: 項目の定義から、ボードと表の切り替え・検索欄・件数を描く。
// samples.js の後、syntax.js より先に読み、描いた表に syntax.js の並べ替えを付けさせる。
// [data-mock-view] の属性で場面を変える: data-default="table"（表で開く）・data-search="off"（検索の機能がオフ）・
// data-board="disabled"（ボードにできない。data-warning に書き方の警告の id）・data-query（開いた時点の検索の文字）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 操作のアイコン（24 の格子。lucide の形）
  const ICONS = {
    board: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  };

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  /** 項目の値を HTML として読まれない文字にする。 */
  const escape = (text) =>
    text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

  /** 大文字・小文字と全角・半角を揃えた、検索で比べる文字を返す。 */
  const normalize = (text) => text.normalize("NFKC").toLowerCase();

  /** 件数の文言を返す。絞っている間は全体の件数と合った件数の両方を出す。 */
  const countText = (shown, total) =>
    shown === total ? `${total.toLocaleString("ja-JP")} 件` : `${total.toLocaleString("ja-JP")} 件中 ${shown.toLocaleString("ja-JP")} 件`;

  let serial = 0;

  /** ボードの列（グループの値ごと）の HTML を返す。 */
  const boardHtml = (def, groupIndex) => {
    const values = [...new Set(def.rows.map((row) => row[groupIndex]))];
    const fieldIndexes = def.columns.map((_, i) => i).filter((i) => i !== 0 && i !== groupIndex);
    return values
      .map((value) => {
        const cards = def.rows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row[groupIndex] === value)
          .map(({ row, index }) => {
            // 先頭の列を題にし、グループの列と空の値を除いた残りの列を「列名 値」で並べる
            const fields = fieldIndexes
              .filter((i) => row[i] !== "")
              .map((i) => `<div><dt>${escape(def.columns[i])}</dt><dd>${escape(row[i])}</dd></div>`)
              .join("");
            return `<li class="mdmark-view-card" data-row="${index}"><p class="mdmark-view-card-title">${escape(row[0])}</p>${fields ? `<dl class="mdmark-view-fields">${fields}</dl>` : ""}</li>`;
          })
          .join("");
        return `<div class="mdmark-view-column" data-value="${escape(value)}">
  <p class="mdmark-view-column-head"><span class="mdmark-view-column-name">${escape(value)}</span><span class="mdmark-view-column-count"></span></p>
  <ul class="mdmark-view-cards" aria-label="${escape(value)}">${cards}</ul>
  <p class="mdmark-view-column-empty" hidden>項目はありません</p>
</div>`;
      })
      .join("");
  };

  /** 表のビューの HTML を返す（記法の表と同じ組み。並べ替えは syntax.js が付ける）。 */
  const tableHtml = (def) => {
    const head = def.columns
      .map((name) => `<th><span class="mdmark-th"><button class="mdmark-sort" type="button">${escape(name)}${icon("sort")}</button></span></th>`)
      .join("");
    const body = def.rows
      .map(
        (row, index) =>
          `<tr data-row="${index}" data-order="${index}">${row.map((value, i) => `<td data-label="${escape(def.columns[i])}">${escape(value)}</td>`).join("")}</tr>`,
      )
      .join("");
    return `<div class="mdmark-table" data-kind="data"><table tabindex="0" aria-label="表のビュー"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  /** 項目の定義からビューを描き、切り替えと検索を付ける。 */
  const drawView = (host) => {
    const def = window.mdmarkMockViews[host.dataset.mockView];
    const groupIndex = def.columns.indexOf(def.group);
    const boardEnabled = host.dataset.board !== "disabled";
    const searchEnabled = host.dataset.search !== "off";
    const id = `mdmark-view-${(serial += 1)}`;
    let mode = boardEnabled ? (host.dataset.default ?? "board") : "table";

    // ボードにできないとき: ボードのボタンを押せなくし、理由の書き方の警告を読み上げに結ぶ
    const boardDisabled = boardEnabled ? "" : ` disabled aria-describedby="${host.dataset.warning}"`;
    const search = searchEnabled
      ? `<div class="mdmark-view-search">
    <label class="mdmark-view-search-field" for="${id}-q">${icon("search")}<span class="mdmark-visually-hidden">項目を検索</span><input id="${id}-q" type="search" autocomplete="off" spellcheck="false"></label>
    <p class="mdmark-view-count" aria-live="polite"></p>
  </div>`
      : "";
    host.classList.add("mdmark-view");
    host.innerHTML = `<div class="mdmark-view-bar">
  <div class="mdmark-view-switch" role="group" aria-label="ビューの表示">
    <button class="mdmark-view-switch-item" type="button" data-mode="board"${boardDisabled}>${icon("board")}ボード</button>
    <button class="mdmark-view-switch-item" type="button" data-mode="table">${icon("table")}表</button>
  </div>
  ${search}
</div>
<div class="mdmark-view-board" role="group" aria-label="ボード" tabindex="0">${boardEnabled ? boardHtml(def, groupIndex) : ""}</div>
<div class="mdmark-view-table">${tableHtml(def)}</div>
<p class="mdmark-view-empty" hidden>合う項目はありません</p>`;

    const board = host.querySelector(".mdmark-view-board");
    const table = host.querySelector(".mdmark-view-table");
    const empty = host.querySelector(".mdmark-view-empty");
    const input = host.querySelector("input[type=search]");
    const count = host.querySelector(".mdmark-view-count");
    let shown = def.rows.length;

    /** 今のビューと件数から、ボード・表・合う項目が無いことの表示を出し分ける。 */
    const render = () => {
      board.hidden = mode !== "board" || shown === 0;
      table.hidden = mode !== "table" || shown === 0;
      empty.hidden = shown > 0;
      for (const button of host.querySelectorAll(".mdmark-view-switch-item")) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      }
    };

    /** 検索欄の文字を全ての列に当て、合わない項目を隠して件数を出す。 */
    const applySearch = () => {
      const needle = normalize(input?.value.trim() ?? "");
      const matches = def.rows.map((row) => normalize(row.join("\n")).includes(needle));
      shown = matches.filter(Boolean).length;
      for (const item of host.querySelectorAll("[data-row]")) item.hidden = !matches[Number(item.dataset.row)];
      // ボードの列: 列は残し、見出しの数を合った項目の数にする
      for (const column of board.querySelectorAll(".mdmark-view-column")) {
        const visible = column.querySelectorAll(".mdmark-view-card:not([hidden])").length;
        column.querySelector(".mdmark-view-column-count").textContent = visible.toLocaleString("ja-JP");
        column.querySelector(".mdmark-view-cards").hidden = visible === 0;
        column.querySelector(".mdmark-view-column-empty").hidden = visible > 0;
      }
      if (count) count.textContent = countText(shown, def.rows.length);
      render();
    };

    for (const button of host.querySelectorAll(".mdmark-view-switch-item")) {
      button.addEventListener("click", () => {
        mode = button.dataset.mode;
        render();
      });
    }
    if (input) {
      input.value = host.dataset.query ?? "";
      input.addEventListener("input", applySearch);
    }
    applySearch();
  };

  for (const host of document.querySelectorAll("[data-mock-view]")) drawView(host);
}
