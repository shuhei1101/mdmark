// #505 の表の見本: 列ごとに、セルの中身の文字数と改行で分けた行の幅から、折り返すかと列の幅を決める。
// [data-mock-table505] の中の表に、描いた直後と、表を包む要素の幅が変わったときに当てる。
// 見出しのセルの data-mock-width-mode（nowrap）・data-mock-width-min・data-mock-width-max（em）は、マーカーの columns.{列名}.width に当たる
//
// 1. 長文の列（改行で分けた 1 行が LONG_CHARS 文字以上のセルを持つ列）だけを折り返し、ほかの列は折り返さず最も長い行の幅にする
// 2. 長文の列は、最も長い行の幅まで（表を本文の幅いっぱいまで）広げる。折り返さずに収まるなら、その幅で止める
// 3. 長文の列は LONG_MIN_EM より狭くしない。全ての列の最小の幅の合計が見える幅を超えたら、最小の幅で描いて表を横にスクロールする

{
  /** 長文の列とみなす、1 行の文字数 */
  const LONG_CHARS = 20;
  /** 長文の列の最小の幅（em。列の中の最も長い半角の単語の幅の方が広ければそちら） */
  const LONG_MIN_EM = 20;

  /** セルの中で、行の文字を折り返さずに置いたときの表示の幅（px） */
  const textWidth = (text, cell) => {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;text-wrap:nowrap";
    probe.textContent = text;
    cell.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
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
    // 表の左右の枠線の分を引いた、列に配れる幅
    const available = scroll.clientWidth - (table.offsetWidth - table.clientWidth) - 2;
    const em = Number.parseFloat(getComputedStyle(table).fontSize);
    const head = [...[...table.tHead.rows].at(-1).cells];
    const rows = [...table.tBodies[0].rows];
    const columns = head.map((th, index) => {
      const cells = rows.map((row) => row.cells[index]).filter(Boolean);
      const style = getComputedStyle(th);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) + 1;
      const lines = [th, ...cells].flatMap((cell) => linesOf(cell).map((line) => ({ line, cell })));
      const longest = Math.max(...lines.map(({ line, cell }) => textWidth(line, cell))) + padding;
      // 単語は空白で区切った半角の連なり（全角の文字はどこでも折り返せるので単語に数えない）
      const longestWord = Math.max(0, ...lines.flatMap(({ line, cell }) => (line.match(/[\x21-\x7e]+/g) ?? []).map((word) => textWidth(word, cell)))) + padding;
      const ranged = th.dataset.mockWidthMin || th.dataset.mockWidthMax;
      const long = ranged || (!cells.every(isCompact) && cells.some((cell) => linesOf(cell).some((line) => [...line].length >= LONG_CHARS)));
      const nowrap = th.dataset.mockWidthMode === "nowrap" || !long;
      const min = nowrap ? longest : th.dataset.mockWidthMin ? Number(th.dataset.mockWidthMin) * em : Math.max(LONG_MIN_EM * em, longestWord);
      const max = th.dataset.mockWidthMax ? Number(th.dataset.mockWidthMax) * em : Number.POSITIVE_INFINITY;
      // 望む幅: 折り返さずに収まる幅（最も長い行の幅）を、最小の幅と最大の幅の間に収める
      const wanted = nowrap ? longest : Math.max(min, Math.min(longest, max));
      return { th, cells, min, wanted, nowrap };
    });
    const minimum = columns.reduce((sum, column) => sum + column.min, 0);
    const fixed = columns.filter((column) => column.nowrap).reduce((sum, column) => sum + column.wanted, 0);
    const wrapping = columns.filter((column) => !column.nowrap);
    const wanted = wrapping.reduce((sum, column) => sum + column.wanted, 0);
    const rest = available - fixed;
    for (const column of columns) {
      if (column.nowrap) {
        column.width = column.wanted;
      } else if (minimum > available) {
        // 最小の幅の合計が見える幅を超える: 最小の幅で描き、表を横にスクロールする
        column.width = column.min;
      } else if (fixed + wanted <= available) {
        // 折り返さずに収まる: 本文の幅まで広げず、最も長い行の幅で止める
        column.width = column.wanted;
      } else {
        // 残りの幅（本文の幅いっぱいまで）を望む幅の比で分ける。最小の幅より狭くしない
        column.width = Math.max(column.min, (rest * column.wanted) / wanted);
      }
    }
    let colgroup = table.querySelector("colgroup[data-mock-505]");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      colgroup.setAttribute("data-mock-505", "");
      table.prepend(colgroup);
    }
    colgroup.replaceChildren(...columns.map((column) => {
      const col = document.createElement("col");
      col.style.width = `${Math.floor(column.width)}px`;
      return col;
    }));
    for (const column of columns) {
      for (const cell of [column.th, ...column.cells]) {
        cell.classList.toggle("is-mock-nowrap", column.nowrap);
      }
    }
    table.style.width = `${columns.reduce((sum, column) => sum + Math.floor(column.width), 0)}px`;
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
