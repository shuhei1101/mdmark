// #275 の表の見本: 多段の見出し・行見出し・セルの結合（^^・<<）・並べ替えの後の結合し直し・行見出しの列までのピン止め。
// [data-mock-table275] に、window.mdmarkMockTables275 の同じ名前の定義から表を描き、並べ替えとピン止めを付ける。
// syntax.js の後に読む（syntax.js は描く前の表にしか操作を付けないため、この表の操作はこのスクリプトが持つ）

{
  const ICON = {
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    ascending: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    descending: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    warning: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  };
  const SORT_CYCLE = ["none", "descending", "ascending"];
  const UP = "^^";
  const LEFT = "<<";

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const svg = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

  /** 見出しの行の ^^・<< を、左上のセルの rowspan・colspan に読み替える。 */
  const resolveHead = (head) => {
    const grid = head.map((row) => row.map(() => null));
    const cells = [];
    head.forEach((row, r) =>
      row.forEach((text, c) => {
        if (text === LEFT) {
          let k = c - 1;
          while (grid[r][k] === "covered") k -= 1;
          const origin = grid[r][k];
          origin.colspan += 1;
          grid[r][c] = "covered";
          return;
        }
        if (text === UP) {
          let k = r - 1;
          while (grid[k][c] === "covered") k -= 1;
          grid[k][c].rowspan += 1;
          grid[r][c] = "covered";
          return;
        }
        const cell = { text, row: r, col: c, rowspan: 1, colspan: 1 };
        grid[r][c] = cell;
        cells.push(cell);
      }),
    );
    // 列ごとの名前: その列を最も下で覆う見出しの文字（最下段の見出し）
    const names = head[0].map((_, c) => {
      for (let r = head.length - 1; r >= 0; r -= 1) {
        const cell = cells.find((x) => x.col <= c && c < x.col + x.colspan && x.row <= r && r < x.row + x.rowspan);
        if (cell) return cell.text;
      }
      return "";
    });
    return { cells, names, rows: head.length };
  };

  /** 本文の ^^ を上の値で埋め、^^ を書いた列を結合する列にする。 */
  const resolveBody = (body) => {
    const merge = new Set();
    const rows = [];
    body.forEach((row, r) => {
      rows.push(
        row.map((text, c) => {
          if (text === UP && r > 0) {
            merge.add(c);
            return rows[r - 1][c];
          }
          return text;
        }),
      );
    });
    return { rows, merge };
  };

  /** 今の並びで、結合する列の隣り合う同じ値を縦に結合する。左の結合する列の切れ目でも切る。 */
  const spansOf = (rows, mergeCols) => {
    const spans = rows.map((row) => row.map(() => 1));
    const ordered = [...mergeCols].sort((a, b) => a - b);
    ordered.forEach((c, k) => {
      let start = 0;
      for (let r = 1; r <= rows.length; r += 1) {
        const parentBreak = k > 0 && r < rows.length && spans[r][ordered[k - 1]] !== 0;
        if (r === rows.length || rows[r][c] !== rows[start][c] || parentBreak) {
          spans[start][c] = r - start;
          for (let i = start + 1; i < r; i += 1) spans[i][c] = 0;
          start = r;
        }
      }
    });
    return spans;
  };

  /** 書き方の警告の枠。 */
  const warningHtml = (html) =>
    `<div class="mdmark-syntax-warning"><p class="mdmark-syntax-warning-title">${svg("warning")}書き方の警告</p><p>${html}</p></div>`;

  /** 表を描き、並べ替えとピン止めを付ける。 */
  const mountTable = (root, def) => {
    const head = resolveHead(def.head);
    const body = resolveBody(def.body);
    const rowHeader = def.rowHeader ?? 0;
    const numeric = head.names.map((_, c) => body.rows.every((row) => row[c] === "" || !Number.isNaN(Number(String(row[c]).replace(/,/g, "")))));
    const state = { order: body.rows.map((_, i) => i), sortCol: -1, direction: "none", pinned: def.pinned ?? 0 };
    const visible = () => state.order.map((i) => body.rows[i]).filter((row) => !def.filter || row[def.filter.col] === def.filter.value);

    root.classList.add("mdmark-table");
    root.dataset.kind = def.kind ?? "default";
    const headHtml = Array.from({ length: head.rows }, (_, r) => {
      const cells = head.cells
        .filter((cell) => cell.row === r)
        .map((cell) => {
          const bottom = cell.row + cell.rowspan === head.rows && cell.colspan === 1;
          const span = `${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ""}${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ""}`;
          const align = numeric[cell.col] && cell.colspan === 1 ? ' class="mdmark-align-right"' : "";
          const scope = cell.colspan > 1 ? ' scope="colgroup"' : ' scope="col"';
          if (!bottom) return `<th${span}${scope} data-col="${cell.col}"${align}><span class="mdmark-th"><span>${esc(cell.text)}</span></span></th>`;
          // 列ごとに分かれた最下段の見出し: 並べ替え・ピン止めのボタンを置く
          const pin = `<span class="mdmark-th-tools"><button class="mdmark-pin" type="button" aria-pressed="false" aria-label="「${esc(cell.text)}」の列までピン止め" title="「${esc(cell.text)}」の列までピン止め">${svg("pin")}</button></span>`;
          return `<th${span}${scope} data-col="${cell.col}"${align}><span class="mdmark-th"><button class="mdmark-sort" type="button" data-sort-col="${cell.col}">${esc(cell.text)}${svg("sort")}</button>${pin}</span></th>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    root.innerHTML = `${def.warning ? warningHtml(def.warning) : ""}<table tabindex="0" aria-label="表: ${esc(def.label)}"><thead>${headHtml}</thead><tbody></tbody></table>`;
    const table = root.querySelector("table");

    const renderBody = () => {
      const rows = visible();
      const spans = spansOf(rows, body.merge);
      table.tBodies[0].innerHTML = rows
        .map((row, r) => {
          const cells = row
            .map((value, c) => {
              if (spans[r][c] === 0) return "";
              const rs = spans[r][c] > 1 ? ` rowspan="${spans[r][c]}"` : "";
              const cls = [numeric[c] ? "mdmark-align-right" : "", spans[r][c] > 1 ? "is-merged" : ""].filter(Boolean).join(" ");
              const attrs = `${rs}${cls ? ` class="${cls}"` : ""} data-col="${c}" data-label="${esc(head.names[c])}"`;
              const content = esc(value);
              return c < rowHeader ? `<th scope="row"${attrs}>${content}</th>` : `<td${attrs}>${content}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      applyPin();
    };

    /** 列の左端の位置（その列だけを覆うセルの左端）。留める前の位置で測る。 */
    const colLefts = () => {
      for (const cell of table.querySelectorAll(".is-pinned-col")) {
        cell.classList.remove("is-pinned-col", "is-pinned-edge");
        cell.style.left = "";
      }
      const origin = table.getBoundingClientRect().left - table.scrollLeft;
      return head.names.map((_, c) => {
        const cell = table.querySelector(`thead th[data-col="${c}"]:not([colspan]), tbody [data-col="${c}"]`);
        return cell ? cell.getBoundingClientRect().left - origin : 0;
      });
    };

    const applyPin = () => {
      // はみ出すかはピン止めのボタンを出さない幅で測る（ボタンの幅で、はみ出さない表をはみ出させない）
      for (const pin of root.querySelectorAll(".mdmark-pin")) pin.hidden = true;
      const overflow = table.scrollWidth > table.clientWidth;
      for (const pin of root.querySelectorAll(".mdmark-pin")) pin.hidden = !overflow;
      const lefts = colLefts();
      // 留めるのは表が幅からはみ出すときだけ（はみ出さない表は留めず、ピン止めのボタンも出さない）
      const count = overflow ? state.pinned : 0;
      for (const cell of table.querySelectorAll("th, td")) {
        const c = Number(cell.dataset.col);
        const span = Number(cell.getAttribute("colspan") ?? 1);
        const pinned = c + span - 1 < count;
        cell.classList.toggle("is-pinned-col", pinned);
        cell.classList.toggle("is-pinned-edge", pinned && c + span === count);
        cell.style.left = pinned ? `${lefts[c]}px` : "";
      }
      for (const pin of root.querySelectorAll(".mdmark-pin")) {
        pin.setAttribute("aria-pressed", String(Number(pin.closest("th").dataset.col) + 1 === count));
      }
      root.dataset.pinned = String(count);
    };

    for (const button of root.querySelectorAll(".mdmark-sort")) {
      button.addEventListener("click", () => {
        const col = Number(button.dataset.sortCol);
        state.direction = state.sortCol === col ? SORT_CYCLE[(SORT_CYCLE.indexOf(state.direction) + 1) % 3] : "descending";
        state.sortCol = col;
        sortBy(col, state.direction);
      });
    }
    const sortBy = (col, direction) => {
      state.order = body.rows.map((_, i) => i);
      if (direction !== "none") {
        state.order.sort((a, b) => {
          const x = body.rows[a][col];
          const y = body.rows[b][col];
          const diff = numeric[col] ? Number(String(x).replace(/,/g, "")) - Number(String(y).replace(/,/g, "")) : String(x).localeCompare(String(y), "ja");
          return direction === "ascending" ? diff : -diff;
        });
      }
      for (const th of table.tHead.querySelectorAll("th")) {
        const sorted = direction !== "none" && th.querySelector(`[data-sort-col="${col}"]`);
        if (sorted) th.setAttribute("aria-sort", direction);
        else th.removeAttribute("aria-sort");
        const icon = th.querySelector(".mdmark-sort .mdmark-icon");
        if (icon) icon.innerHTML = ICON[sorted ? direction : "sort"];
      }
      renderBody();
    };
    for (const pin of root.querySelectorAll(".mdmark-pin")) {
      pin.addEventListener("click", () => {
        const count = Number(pin.closest("th").dataset.col) + 1;
        state.pinned = pin.getAttribute("aria-pressed") === "true" ? 0 : count;
        applyPin();
      });
    }
    window.addEventListener("resize", applyPin);
    renderBody();
    // モックの見本: 並べ替えた後の状態で見せる
    if (def.sorted) {
      state.sortCol = def.sorted.col;
      state.direction = def.sorted.direction;
      sortBy(def.sorted.col, def.sorted.direction);
    }
  };

  for (const root of document.querySelectorAll("[data-mock-table275]")) {
    mountTable(root, window.mdmarkMockTables275[root.dataset.mockTable275]);
  }
}
