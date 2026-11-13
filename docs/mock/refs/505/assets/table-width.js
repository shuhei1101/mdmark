// #505 の表の見本: 列ごとに、セルの中身の文字数と改行で分けた行の幅から、折り返すかと列の幅を決める。
// [data-mock-table505] の中の表に、描いた直後と、表を包む要素の幅が変わったときに当てる。
// 見出しのセルの data-mock-width-mode（nowrap）・data-mock-width-min・data-mock-width-max（em）は、マーカーの columns.{列名}.width に当たる
//
// 1. 長文の列（改行で分けた 1 行が LONG_CHARS 文字以上のセルを持つ列）だけを折り返し、ほかの列は折り返さず最も長い行の幅にする
// 2. 長文の列は、最も長い行の幅まで（表を本文の幅いっぱいまで）広げる。折り返さずに収まるなら、その幅で止める
// 3. 長文の列は LONG_MIN_EM より狭くしない（最も長い行の幅が短ければ、その幅を最小の幅にする）。ほかの列の最小の幅と最大の幅は、最も長い行の幅。全ての列の最小の幅の合計が見える幅を超えたら、最小の幅で描いて表を横にスクロールする

{
  /** 長文の列とみなす、1 行の文字数 */
  const LONG_CHARS = 20;
  /** 長文の列の最小の幅（em。列の中の最も長い半角の単語の幅の方が広ければそちら） */
  const LONG_MIN_EM = 45;

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
    let available = scroll.clientWidth - (table.offsetWidth - table.clientWidth) - 2;
    const em = Number.parseFloat(getComputedStyle(table).fontSize);
    // 畳んだ列と隠した列は数えない（列の幅を当てない）
    const allHead = [...[...table.tHead.rows].at(-1).cells];
    const head = allHead.filter((th) => getComputedStyle(th).display !== "none");
    const indexes = head.map((th) => allHead.indexOf(th));
    // 行の詳細などの、列と 1 対 1 でない行は数えない
    const rows = [...table.tBodies[0].rows].filter((row) => row.cells.length === allHead.length);
    const columns = head.map((th, position) => {
      const index = indexes[position];
      const cells = rows.map((row) => row.cells[index]).filter(Boolean);
      const style = getComputedStyle(th);
      // セルの左右の余白と枠線の幅に、測った幅の端数の分を足す
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth) + 2;
      const lines = [th, ...cells].flatMap((cell) => linesOf(cell).map((line) => ({ line, cell })));
      const longest = Math.ceil(Math.max(...lines.map(({ line, cell }) => textWidth(line, cell))) + padding);
      // 単語は空白で区切った半角の連なり（全角の文字はどこでも折り返せるので単語に数えない）
      const longestWord = Math.max(0, ...lines.flatMap(({ line, cell }) => (line.match(/[\x21-\x7e]+/g) ?? []).map((word) => textWidth(word, cell)))) + padding;
      const ranged = th.dataset.mockWidthMin || th.dataset.mockWidthMax;
      const long = ranged || (!cells.every(isCompact) && cells.some((cell) => linesOf(cell).some((line) => [...line].length >= LONG_CHARS)));
      const nowrap = th.dataset.mockWidthMode === "nowrap" || !long;
      const min = nowrap ? longest : th.dataset.mockWidthMin ? Number(th.dataset.mockWidthMin) * em : Math.min(longest, Math.max(LONG_MIN_EM * em, longestWord));
      const max = th.dataset.mockWidthMax ? Number(th.dataset.mockWidthMax) * em : Number.POSITIVE_INFINITY;
      // 望む幅: 折り返さずに収まる幅（最も長い行の幅）を、最小の幅と最大の幅の間に収める
      const wanted = nowrap ? longest : Math.max(min, Math.min(longest, max));
      return { th, cells, min, wanted, nowrap, long: !nowrap, ranged: Boolean(ranged) };
    });
    // 列ごとに切り上げる分（1 列 1px まで）を、配れる幅から引いておく
    available -= columns.length;
    const minimum = columns.reduce((sum, column) => sum + column.min, 0);
    const fixed = columns.filter((column) => column.nowrap).reduce((sum, column) => sum + column.wanted, 0);
    const wrapping = columns.filter((column) => !column.nowrap);
    for (const column of columns) {
      if (column.nowrap) {
        column.width = column.wanted;
      } else if (minimum > available) {
        // 最小の幅の合計が見える幅を超える: 最小の幅で描き、表を横にスクロールする
        column.width = column.min;
      } else {
        column.width = column.wanted;
      }
    }
    if (minimum <= available && fixed + wrapping.reduce((sum, column) => sum + column.wanted, 0) > available) {
      // 残りの幅（本文の幅いっぱいまで）を、長文の列に望む幅の比で分ける。
      // 最小の幅を下回る列は最小の幅で止め、その列を除いた残りの幅をほかの列へ分け直す（止める列が出なくなるまで繰り返す）
      let open = [...wrapping];
      let rest = available - fixed;
      for (;;) {
        const total = open.reduce((sum, column) => sum + column.wanted, 0);
        const stopped = open.filter((column) => (rest * column.wanted) / total < column.min);
        if (stopped.length === 0) {
          for (const column of open) {
            column.width = (rest * column.wanted) / total;
          }
          break;
        }
        for (const column of stopped) {
          column.width = column.min;
          rest -= column.min;
        }
        open = open.filter((column) => !stopped.includes(column));
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
      col.style.width = `${Math.ceil(column.width)}px`;
      return col;
    }));
    for (const column of columns) {
      for (const cell of [column.th, ...column.cells]) {
        cell.classList.toggle("is-mock-nowrap", column.nowrap);
      }
    }
    table.style.width = `${columns.reduce((sum, column) => sum + Math.ceil(column.width), 0)}px`;
    // モックだけの内訳: 列ごとに長文の列か・最小の幅・決めた幅を、表の下に出す
    const holder = table.closest(".mdmark-table");
    let note = holder.nextElementSibling?.matches(".mock-505-note") ? holder.nextElementSibling : null;
    if (!note) {
      note = document.createElement("p");
      note.className = "mock-505-note";
      holder.after(note);
    }
    const scroll2 = minimum > available ? "最小の幅の合計が見える幅を超えるので、横にスクロール" : "横にスクロールしない";
    note.textContent = `列の幅（モックだけの内訳）: ${columns
      .map((column) => `${column.th.textContent.trim()} = ${column.nowrap ? "短い列（折り返さない）" : column.ranged ? "幅の範囲を記載した列" : "長文の列"} ${Math.ceil(column.width)}px（最小 ${Math.ceil(column.min)}px）`)
      .join("、")}。${scroll2}`;
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
