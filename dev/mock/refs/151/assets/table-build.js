// 表の見本の組み立て（モックだけの仕組み）: window.mdmarkMockTables の定義から、実装の表の部品と同じ HTML を描く。
// 描く先は [data-mock-table="{定義の名前}"] の要素で、その要素の data-* を表の入れ物へ写す。
// syntax.js・table.js より先に読み、それらが組み立てた表に操作を付ける

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 部品のアイコンの線（24 の格子。lucide の形）
  const ICON_PATHS = {
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    filter: '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    total: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    warning: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  };

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  /** セルの HTML から文字だけを返す（行の ID と読み上げの名前に使う）。 */
  const textOf = (html) => {
    const holder = document.createElement("span");
    holder.innerHTML = html;
    return holder.textContent.trim();
  };

  /** 揃えの class を返す。 */
  const alignClass = (column) => (column.align ? ` class="mdmark-align-${column.align}"` : "");

  /** 見出しのセル: 並べ替えのボタン（data の種類）と、絞り込み・ピン止めのボタン。 */
  const headCell = (def, column, index, key) => {
    const tools = [];
    if (column.filter) {
      tools.push(`<button class="mdmark-filter" type="button" aria-expanded="false" aria-controls="${key}-filter-${index}" aria-label="「${column.name}」で絞り込む" title="「${column.name}」で絞り込む">${icon("filter")}<span class="mdmark-visually-hidden"></span></button>`);
    }
    tools.push(`<button class="mdmark-pin" type="button" aria-pressed="false" aria-label="「${column.name}」の列までピン止め" title="「${column.name}」の列までピン止め" hidden>${icon("pin")}</button>`);
    const name = def.kind === "data" ? `<button class="mdmark-sort" type="button">${column.name}${icon("sort")}</button>` : `<span>${column.name}</span>`;
    return `<th${alignClass(column)}><span class="mdmark-th">${name}<span class="mdmark-th-tools">${tools.join("")}</span></span></th>`;
  };

  /** 本文の行（と行の詳細の行）。 */
  const bodyRow = (def, cells, rowIndex, key) => {
    const detail = def.details?.[rowIndex];
    const detailId = `${key}-detail-${rowIndex}`;
    const name = textOf(cells[0]);
    const tds = cells.map((cell, i) => {
      let content = cell;
      // 先頭のセル: 行へのリンクの印と、行の詳細の開閉のボタン
      if (i === 0 && def.features?.rowlink) {
        content = `<span class="mdmark-row-link-cell">${content}<a class="mdmark-row-anchor" href="#${name}" aria-label="「${name}」の行へのリンク">${icon("link")}</a></span>`;
      }
      if (i === 0 && detail) {
        content = `<span class="mdmark-row-head"><button class="mdmark-row-toggle" type="button" aria-expanded="false" aria-controls="${detailId}" aria-label="「${name}」の詳細">${icon("chevron")}</button>${content}</span>`;
      }
      return `<td${alignClass(def.columns[i])} data-label="${def.columns[i].name}">${content}</td>`;
    });
    const id = def.features?.rowlink ? ` id="${name}"` : "";
    const detailRow = detail ? `\n      <tr class="mdmark-row-detail" id="${detailId}" hidden><td colspan="${def.columns.length}">${detail}</td></tr>` : "";
    return `      <tr${id}>${tds.join("")}</tr>${detailRow}`;
  };

  /** 絞り込みのドロワー（種類ごとの入力）。 */
  const filterDrawer = (def, column, index, key) => {
    const title = `「${column.name}」で絞り込む`;
    let fields;
    if (column.filter === "select") {
      const values = [...new Set(def.rows.map((row) => textOf(row[index])))];
      const options = values.map((value) => `<li><label><input type="checkbox" value="${value}">${value}</label></li>`).join("");
      fields = `<label class="mdmark-filter-field">候補を検索<input class="mdmark-filter-search" type="search" autocomplete="off"></label>
    <ul class="mdmark-filter-options">${options}</ul>
    <p class="mdmark-filter-none" hidden>一致する候補がありません</p>`;
    } else if (column.filter === "date") {
      fields = '<div class="mdmark-filter-range"><label class="mdmark-filter-field">開始日<input type="date"></label><label class="mdmark-filter-field">終了日<input type="date"></label></div>';
    } else {
      fields = '<label class="mdmark-filter-field">含む文字<input type="search" autocomplete="off"></label>';
    }
    return `  <div class="mdmark-filter-drawer" id="${key}-filter-${index}" role="dialog" hidden aria-label="${title}" data-filter-kind="${column.filter}" data-column="${index}">
    <p class="mdmark-filter-title">${title}</p>
    ${fields}
    <button class="mdmark-filter-clear" type="button">絞り込みを外す</button>
  </div>`;
  };

  /** 表の上の道具の帯: 件数と、列の表示・集計・コピーのボタン。 */
  const toolBar = (def, key) => {
    const { count, columns, total, copy } = def.features ?? {};
    if (!count && !columns && !total && !copy) return "";
    const tools = [];
    if (columns) {
      tools.push(`<button class="mdmark-table-tool mdmark-columns-toggle" type="button" aria-expanded="false" aria-controls="${key}-columns">${icon("columns")}列の表示<span class="mdmark-visually-hidden"></span></button>`);
    }
    if (total) {
      tools.push(`<button class="mdmark-table-tool mdmark-totals-toggle" type="button" aria-expanded="false" aria-controls="${key}-totals">${icon("total")}集計<span class="mdmark-visually-hidden"></span></button>`);
    }
    if (copy) {
      tools.push(`<button class="mdmark-table-tool mdmark-copy" type="button" aria-expanded="false" aria-controls="${key}-copy" data-state="idle">${icon("copy")}<span class="mdmark-copy-label">表をコピー</span>${icon("chevron")}</button>`);
    }
    const countHtml = count ? '\n    <p class="mdmark-table-count" aria-live="polite"><span aria-hidden="true"></span><span class="mdmark-visually-hidden"></span></p>' : "";
    return `  <!-- 表の上の道具の帯: 件数（aria-live で書き換えを知らせる）と、列の表示・集計・コピーのボタン -->
  <div class="mdmark-table-bar">${countHtml}
    <div class="mdmark-table-tools">${tools.join("")}</div>
    <!-- コピー・集計の結果の読み上げ: ボタンの文言の書き換えと一緒に入れる -->
    <span class="mdmark-visually-hidden mdmark-table-status" role="status"></span>
  </div>`;
  };

  /** 列の表示・集計・コピーの形式のメニュー。 */
  const menus = (def, key) => {
    const parts = [];
    const { columns, total, copy } = def.features ?? {};
    if (columns) {
      const options = def.columns
        .map((column, i) => `<li><label><input type="checkbox" value="${i}"${i === 0 ? " checked disabled" : ""}>${column.name}</label></li>`)
        .join("");
      parts.push(`  <!-- 列の表示のメニュー: 道具の帯の列の表示のボタン（aria-controls）で開閉する。初めは閉じている -->
  <div class="mdmark-columns-menu mdmark-table-menu" id="${key}-columns" role="dialog" hidden aria-label="表示する列">
    <p class="mdmark-columns-title">表示する列</p>
    <ul class="mdmark-columns-options">${options}</ul>
    <p class="mdmark-columns-note">先頭の列は隠せません</p>
    <button class="mdmark-columns-reset" type="button">既定に戻す</button>
  </div>`);
    }
    if (total) {
      // total= に書いた計算だけを、合計・平均・件数の順に並べる
      const kinds = ["sum", "avg", "count"].filter((kind) => def.columns.some((column) => [column.total ?? []].flat().includes(kind)));
      const labels = { sum: "合計", avg: "平均", count: "件数" };
      const options = kinds.map((kind) => `<li><label><input type="checkbox" value="${kind}" checked>${labels[kind]}</label></li>`).join("");
      parts.push(`  <!-- 集計のメニュー: 道具の帯の集計のボタンで開閉する。total= に書いた計算のうち出す計算を選ぶ -->
  <div class="mdmark-totals-menu mdmark-table-menu" id="${key}-totals" role="dialog" hidden aria-label="出す集計">
    <p class="mdmark-columns-title">出す集計</p>
    <ul class="mdmark-columns-options">${options}</ul>
  </div>`);
    }
    if (copy) {
      parts.push(`  <!-- コピーの形式のメニュー: 表をコピーのボタンで開閉する。押した形式で、見えている行と列をコピーする -->
  <div class="mdmark-copy-menu mdmark-table-menu" id="${key}-copy" role="dialog" hidden aria-label="コピーの形式">
    <p class="mdmark-columns-title">コピーの形式</p>
    <ul class="mdmark-copy-options">
      <li><button class="mdmark-copy-format" type="button" data-format="markdown"><span class="mdmark-copy-format-name">Markdown の表</span><span class="mdmark-copy-format-note">文書に貼るとそのまま表になる</span></button></li>
      <li><button class="mdmark-copy-format" type="button" data-format="tsv"><span class="mdmark-copy-format-name">TSV</span><span class="mdmark-copy-format-note">表計算ソフトに貼るとセルに分かれる</span></button></li>
    </ul>
  </div>`);
    }
    return parts.join("\n");
  };

  /** 集計の行: total= の列に計算を data-total で持たせる（行を計算ごとに分けるのは table.js）。 */
  const footRow = (def) => {
    const cells = def.columns.map((column) => {
      const total = column.total ? ` data-total="${[column.total].flat().join(" ")}"` : "";
      return `<td${alignClass(column)} data-label="${column.name}"${total}></td>`;
    });
    return `    <tfoot><tr class="mdmark-table-total">${cells.join("")}</tr></tfoot>`;
  };

  /** 書き方の警告の枠。 */
  const warningBox = (html) => `  <div class="mdmark-syntax-warning">
    <p class="mdmark-syntax-warning-title">${icon("warning")}書き方の警告</p>
    ${html}
  </div>`;

  /** 定義から表の入れ物の HTML を組み立てる。 */
  const buildTable = (def, key) => {
    const head = def.columns.map((column, i) => headCell(def, column, i, key)).join("");
    const body = def.rows.map((cells, i) => bodyRow(def, cells, i, key)).join("\n");
    const empty = def.columns.some((column) => column.filter) ? `\n      <tr class="mdmark-table-empty" hidden><td colspan="${def.columns.length}">一致する行がありません</td></tr>` : "";
    const drawers = def.columns.map((column, i) => (column.filter ? filterDrawer(def, column, i, key) : "")).filter(Boolean).join("\n");
    const hidden = def.hide ? ` data-hidden-columns="${def.hide.join(",")}"` : "";
    const pinned = def.pinned ? ` data-pinned="${def.pinned}"` : "";
    return `<div class="mdmark-table" data-kind="${def.kind}"${hidden}${pinned}>
${def.warning ? `${warningBox(def.warning)}\n` : ""}${toolBar(def, key)}
  <table tabindex="0" aria-label="${def.label}">
    <thead><tr>${head}</tr></thead>
    <tbody>
${body}${empty}
    </tbody>
${def.features?.total ? footRow(def) : ""}
  </table>
${menus(def, key)}
${drawers}
</div>`;
  };

  for (const holder of document.querySelectorAll("[data-mock-table]")) {
    const key = holder.dataset.mockTable;
    const template = document.createElement("template");
    const def = window.mdmarkMockTables[key];
    // 集計できない列をセルで知らせる案: 表の上の書き方の警告を出さない
    template.innerHTML = buildTable(holder.dataset.mockUnreadable === "cell" ? { ...def, warning: undefined } : def, key);
    const wrapper = template.content.firstElementChild;
    // 描く先の要素の data-*（モックの指定）を表の入れ物へ写す
    for (const [name, value] of Object.entries(holder.dataset)) {
      if (name !== "mockTable") wrapper.dataset[name] = value;
    }
    holder.replaceWith(wrapper);
  }
}
