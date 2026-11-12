// #505 の表の見本: 列ごとに、セルの中身の種類と改行で分けた行の幅から、折り返すかと列の幅を決める。
// [data-mock-table505] の中の表に、描いた直後と、表を包む要素の幅が変わったときに当てる。
// 見出しのセルの data-mock-width-mode（nowrap）・data-mock-width-min・data-mock-width-max（em）は、マーカーの columns.{列名}.width に当たる

{
  /** 折り返さない短い列の上限（em） */
  const SHORT_EM = 12;
  /** 折り返す列の最小の幅（em。列の中の最も長い単語の幅の方が広ければそちら） */
  const MIN_EM = 12;
  /** 折り返す列の最大の幅（em） */
  const MAX_EM = 40;

  const canvas = document.createElement("canvas").getContext("2d");

  /** 要素の文字の表示の幅（px） */
  const textWidth = (text, element) => {
    const style = getComputedStyle(element);
    canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return canvas.measureText(text).width;
  };

  /** セルを改行（br・リストの項目・段落）で行に分ける */
  const linesOf = (cell) => {
    const clone = cell.cloneNode(true);
    for (const br of clone.querySelectorAll("br")) {
      br.replaceWith("\n");
    }
    for (const block of clone.querySelectorAll("li, p")) {
      block.append("\n");
    }
    return clone.textContent.split("\n").map((line) => line.trim()).filter(Boolean);
  };

  /** セルの中身が、数値・日付・チェック・バッジ・行内のコードだけか */
  const isCompact = (cell) => {
    const text = cell.textContent.trim();
    if (text === "" || /^[-+]?[\d,.]+%?$/.test(text) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text) || /^[✓✔]$/.test(text)) {
      return true;
    }
    return [...cell.childNodes].every((node) =>
      node.nodeType === Node.TEXT_NODE ? node.textContent.trim() === "" : node.matches("code, .mdmark-badge"),
    );
  };

  /** 表の列の幅を決めて当てる */
  const layout = (table) => {
    const scroll = table.closest(".mdmark-table-scroll");
    const available = scroll.clientWidth;
    const em = Number.parseFloat(getComputedStyle(table).fontSize);
    const head = [...table.tHead.rows.at(-1).cells];
    const rows = [...table.tBodies[0].rows];
    const columns = head.map((th, index) => {
      const cells = rows.map((row) => row.cells[index]).filter(Boolean);
      const style = getComputedStyle(th);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) + 1;
      const longest = Math.max(...[th, ...cells].flatMap((cell) => linesOf(cell).map((line) => textWidth(line, cell)))) + padding;
      const longestWord = Math.max(0, ...cells.flatMap((cell) => linesOf(cell).flatMap((line) => line.split(/\s+/)).map((word) => textWidth(word, cell)))) + padding;
      const min = th.dataset.mockWidthMin ? Number(th.dataset.mockWidthMin) * em : Math.max(MIN_EM * em, longestWord);
      const max = Math.max(min, th.dataset.mockWidthMax ? Number(th.dataset.mockWidthMax) * em : MAX_EM * em);
      const nowrap = th.dataset.mockWidthMode === "nowrap" || cells.every(isCompact) || (longest <= SHORT_EM * em && !th.dataset.mockWidthMin);
      return { th, cells, longest, min, max, nowrap };
    });
    const fixed = columns.filter((column) => column.nowrap).reduce((sum, column) => sum + column.longest, 0);
    const wrapping = columns.filter((column) => !column.nowrap);
    // 折り返す列が望む幅: 最長の行の幅を、最小の幅と最大の幅の間に収める
    for (const column of wrapping) {
      column.wanted = Math.min(Math.max(column.longest, column.min), column.max);
    }
    const wanted = wrapping.reduce((sum, column) => sum + column.wanted, 0);
    const rest = available - fixed;
    for (const column of columns) {
      if (column.nowrap) {
        column.width = column.longest;
      } else if (fixed + wanted <= available) {
        column.width = column.wanted;
      } else {
        // 残りの幅を望む幅の比で分け、最小の幅を下回る列は最小の幅で止める（表は横にスクロールする）
        column.width = Math.max(column.min, (rest * column.wanted) / wanted);
      }
    }
    let colgroup = table.querySelector("colgroup[data-mock-505]");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      colgroup.dataset.mock505 = "";
      table.prepend(colgroup);
    }
    colgroup.replaceChildren(...columns.map((column) => {
      const col = document.createElement("col");
      col.style.width = `${Math.ceil(column.width)}px`;
      return col;
    }));
    for (const column of columns) {
      for (const cell of [column.th, ...column.cells]) {
        cell.classList.toggle("is-mock-nowrap", column.nowrap);
      }
    }
    table.style.width = `${Math.ceil(columns.reduce((sum, column) => sum + Math.ceil(column.width), 0))}px`;
  };

  const start = () => {
    for (const table of document.querySelectorAll("[data-mock-table505] .mdmark-table-scroll > table")) {
      layout(table);
      // 表を包む要素の幅が変わったときだけ決め直す
      let last = table.closest(".mdmark-table-scroll").clientWidth;
      new ResizeObserver(([entry]) => {
        const width = Math.round(entry.contentRect.width);
        if (width !== last) {
          last = width;
          layout(table);
        }
      }).observe(table.closest(".mdmark-table-scroll"));
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
