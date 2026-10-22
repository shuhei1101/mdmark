// ビューのモック（実装の mount とビューを描く関数が付ける振る舞い）: 項目の定義から、ボードと表の切り替え・列の見出しのアイコン・表の列の絞り込みを描く。
// samples.js の後、syntax.js より先に読み、描いた表に syntax.js の並べ替えと列の絞り込みを付けさせる。
// [data-mock-view] の属性で場面を変える: data-default="table"（表で開く）・data-filter（印の filter=。無ければ定義の filter）・
// data-filter-value（開いた時点で絞り込みに選んだ値・入れた文字）・data-icons（印の icons=）・
// data-board="disabled"（ボードにできない。data-warning に書き方の警告の id）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 操作と列の見出しのアイコン（24 の格子。lucide の形）
  const ICONS = {
    board: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    funnel:
      '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
    circle: '<circle cx="12" cy="12" r="10"/>',
    "circle-dashed":
      '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
    "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
    "circle-pause": '<circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/>',
    "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "circle-x": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    inbox:
      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  };

  // 列の見出しの値の既定のアイコン。対応に無い値は circle にする（印の icons= で値ごとに上書きできる）
  const DEFAULT_VALUE_ICONS = {
    未着手: "circle-dashed",
    進行中: "circle-dot",
    保留: "circle-pause",
    完了: "circle-check",
    中止: "circle-x",
  };

  // 絞り込みの種類（記法の表と同じ）。種類を省いた列は select
  const FILTER_KINDS = ["select", "text", "date"];

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  /** 項目の値を HTML として読まれない文字にする。 */
  const escape = (text) =>
    text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

  /** 「名前:値,名前:値」の印の引数を [名前, 値] の並びにする（値を省いた組は値を fallback にする）。 */
  const parsePairs = (spec, fallback) =>
    spec
      ? spec.split(",").map((pair) => {
          const [name, value] = pair.split(":");
          return [name.trim(), (value ?? fallback).trim()];
        })
      : [];

  let serial = 0;

  /** ボードの列（グループの値ごと）の HTML を返す。絞り込みは当てず、全ての項目を並べる。 */
  const boardHtml = (def, groupIndex, valueIcons) => {
    const values = [...new Set(def.rows.map((row) => row[groupIndex]))];
    const fieldIndexes = def.columns.map((_, i) => i).filter((i) => i !== 0 && i !== groupIndex);
    return values
      .map((value) => {
        const rows = def.rows.filter((row) => row[groupIndex] === value);
        const cards = rows
          .map((row) => {
            // 先頭の列を題にし、グループの列と空の値を除いた残りの列を「列名 値」で並べる
            const fields = fieldIndexes
              .filter((i) => row[i] !== "")
              .map((i) => `<div><dt>${escape(def.columns[i])}</dt><dd>${escape(row[i])}</dd></div>`)
              .join("");
            return `<li class="mdmark-view-card"><p class="mdmark-view-card-title">${escape(row[0])}</p>${fields ? `<dl class="mdmark-view-fields">${fields}</dl>` : ""}</li>`;
          })
          .join("");
        const iconName = valueIcons[value] ?? DEFAULT_VALUE_ICONS[value] ?? "circle";
        return `<div class="mdmark-view-column">
  <p class="mdmark-view-column-head">${icon(iconName)}<span class="mdmark-view-column-name">${escape(value)}</span><span class="mdmark-view-column-count">${rows.length.toLocaleString("ja-JP")}</span></p>
  <ul class="mdmark-view-cards" aria-label="${escape(value)}">${cards}</ul>
</div>`;
      })
      .join("");
  };

  /** 絞り込みのドロワーの HTML を返す（記法の表と同じ組み）。value は開いた時点の選んだ値・入れた文字。 */
  const drawerHtml = (def, id, index, kind, value) => {
    const name = escape(def.columns[index]);
    let body;
    if (kind === "select") {
      const options = [...new Set(def.rows.map((row) => row[index]))]
        .map((option) => `<li><label><input type="checkbox" value="${escape(option)}"${option === value ? " checked" : ""}>${escape(option)}</label></li>`)
        .join("");
      body = `<label class="mdmark-filter-field">候補を検索<input class="mdmark-filter-search" type="search" autocomplete="off"></label>
    <ul class="mdmark-filter-options">${options}</ul>
    <p class="mdmark-filter-none" hidden>一致する候補がありません</p>`;
    } else if (kind === "text") {
      body = `<label class="mdmark-filter-field">含む文字<input type="search" autocomplete="off" value="${escape(value ?? "")}"></label>`;
    } else {
      body = `<div class="mdmark-filter-range"><label class="mdmark-filter-field">開始日<input type="date"></label><label class="mdmark-filter-field">終了日<input type="date"></label></div>`;
    }
    return `<div class="mdmark-filter-drawer" id="${id}-filter-${index}" role="dialog" hidden aria-label="「${name}」で絞り込む" data-filter-kind="${kind}" data-column="${index}">
    <p class="mdmark-filter-title">「${name}」で絞り込む</p>
    ${body}
    <button class="mdmark-filter-clear" type="button">絞り込みを外す</button>
  </div>`;
  };

  /** 表のビューの HTML を返す（記法の表と同じ組み。並べ替えと列の絞り込みは syntax.js が付ける）。 */
  const tableHtml = (def, id, filters, filterValue) => {
    const head = def.columns
      .map((name, i) => {
        const filter = filters.has(i)
          ? `<span class="mdmark-th-tools"><button class="mdmark-filter" type="button" aria-expanded="false" aria-controls="${id}-filter-${i}" aria-label="「${escape(name)}」で絞り込む" title="「${escape(name)}」で絞り込む">${icon("funnel")}<span class="mdmark-visually-hidden"></span></button></span>`
          : "";
        return `<th><span class="mdmark-th"><button class="mdmark-sort" type="button">${escape(name)}${icon("sort")}</button>${filter}</span></th>`;
      })
      .join("");
    const body = def.rows
      .map((row) => `<tr>${row.map((value, i) => `<td data-label="${escape(def.columns[i])}">${escape(value)}</td>`).join("")}</tr>`)
      .join("");
    const empty = `<tr class="mdmark-table-empty" hidden><td colspan="${def.columns.length}">一致する行がありません</td></tr>`;
    const drawers = [...filters].map(([i, kind]) => drawerHtml(def, id, i, kind, filterValue)).join("\n  ");
    return `<div class="mdmark-table" data-kind="data"><table tabindex="0" aria-label="表のビュー"><thead><tr>${head}</tr></thead><tbody>${body}${empty}</tbody></table>
  ${drawers}
</div>`;
  };

  /** 項目の定義からビューを描き、切り替えを付ける。 */
  const drawView = (host) => {
    const def = window.mdmarkMockViews[host.dataset.mockView];
    const groupIndex = def.columns.indexOf(def.group);
    const boardEnabled = host.dataset.board !== "disabled";
    const id = `mdmark-view-${(serial += 1)}`;
    let mode = boardEnabled ? (host.dataset.default ?? "board") : "table";

    // 絞り込む列（列の位置 → 種類）。表に無い列と知らない種類は付けない（知らない種類は書き方の警告が書く）
    const filters = new Map(
      parsePairs(host.dataset.filter ?? def.filter, "select")
        .map(([name, kind]) => [def.columns.indexOf(name), kind])
        .filter(([index, kind]) => index >= 0 && FILTER_KINDS.includes(kind)),
    );
    // 印の icons= で上書きした値のアイコン（知らないアイコンの名前は当てない）
    const valueIcons = Object.fromEntries(parsePairs(host.dataset.icons, "circle").filter(([, name]) => name in ICONS));

    // ボードにできないとき: ボードのボタンを押せなくし、理由の書き方の警告を読み上げに結ぶ
    const boardDisabled = boardEnabled ? "" : ` disabled aria-describedby="${host.dataset.warning}"`;
    host.classList.add("mdmark-view");
    host.innerHTML = `<div class="mdmark-view-switch" role="group" aria-label="ビューの表示">
  <button class="mdmark-view-switch-item" type="button" data-mode="board"${boardDisabled}>${icon("board")}ボード</button>
  <button class="mdmark-view-switch-item" type="button" data-mode="table">${icon("table")}表</button>
</div>
<div class="mdmark-view-board" role="group" aria-label="ボード" tabindex="0">${boardEnabled ? boardHtml(def, groupIndex, valueIcons) : ""}</div>
<div class="mdmark-view-table">${tableHtml(def, id, filters, host.dataset.filterValue)}</div>`;

    const board = host.querySelector(".mdmark-view-board");
    const table = host.querySelector(".mdmark-view-table");

    /** 今のビューでボードと表を出し分ける。表の絞り込みは隠している間も残す。 */
    const render = () => {
      board.hidden = mode !== "board";
      table.hidden = mode !== "table";
      for (const button of host.querySelectorAll(".mdmark-view-switch-item")) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      }
    };

    for (const button of host.querySelectorAll(".mdmark-view-switch-item")) {
      button.addEventListener("click", () => {
        mode = button.dataset.mode;
        render();
      });
    }
    render();
  };

  for (const host of document.querySelectorAll("[data-mock-view]")) drawView(host);
}
