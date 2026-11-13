// #533 の表の見本: 留めた列の幅の合計が表の見える幅を超えるときのピン止め（#438 の table-pin-each.js に、収まる列だけを留める処理を加えた）。
// [data-mock-table533] に、window.mdmarkMockTables533 の同じ名前の定義から表を描く。
// 選んだ列（through は押した列までの列）を左から順に足し、見える幅を超える列から右は留めずにスクロールに任せる。
// 選んだのに留まっていない列のボタンは押したままにし、is-unpinned と、アクセシブルな名前・title の追記で留まっていないことを示す

{
  const ICON = {
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    warning: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  };
  const LEFT = "<<";

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const svg = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

  /** 見出しの行の << を、左のセルの colspan に読み替える。列ごとの名前は最下行の見出しの文字 */
  const resolveHead = (head) => {
    const cells = [];
    head.forEach((row, r) => {
      row.forEach((text, c) => {
        if (text === LEFT) {
          cells.filter((cell) => cell.row === r).at(-1).colspan += 1;
          return;
        }
        cells.push({ text, row: r, col: c, colspan: 1 });
      });
    });
    const names = head.at(-1).map((text, c) => (text === LEFT ? head.at(-1)[c - 1] : text));
    return { cells, names, rows: head.length };
  };

  /** 書き方の警告の枠 */
  const warningHtml = (html) =>
    `<div class="mdmark-syntax-warning"><p class="mdmark-syntax-warning-title">${svg("warning")}書き方の警告</p><p>${html}</p></div>`;

  /** 表を描き、ピン止めを付ける */
  const mountTable = (root, def) => {
    const head = resolveHead(def.head);
    const isEach = def.mode === "each";
    // 留めた列の集まり。pin= の列名から作り、無ければ先頭の列にする（through は最も右の列までにする）
    const named = (def.pin ?? []).map((name) => head.names.indexOf(name)).filter((c) => c >= 0);
    const initial = named.length > 0 ? named : [0];
    const pinned = new Set(isEach ? initial : Array.from({ length: Math.max(...initial) + 1 }, (_, c) => c));

    root.classList.add("mdmark-table");
    root.dataset.notice = def.notice ?? "a";
    root.dataset.kind = "default";
    root.dataset.pinMode = def.mode;
    const headHtml = Array.from({ length: head.rows }, (_, r) =>
      `<tr>${head.cells
        .filter((cell) => cell.row === r)
        .map((cell) => {
          const span = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "";
          const scope = cell.colspan > 1 ? ' scope="colgroup"' : ' scope="col"';
          // ピン止めのボタンは、列ごとに分かれた最下行の見出しにだけ配置する
          const bottom = r === head.rows - 1 && cell.colspan === 1;
          if (!bottom) return `<th${span}${scope} data-col="${cell.col}"><span class="mdmark-th"><span>${esc(cell.text)}</span></span></th>`;
          const label = isEach ? `「${esc(cell.text)}」の列をピン止め` : `「${esc(cell.text)}」の列までピン止め`;
          return `<th${scope} data-col="${cell.col}"><span class="mdmark-th"><span>${esc(cell.text)}</span><span class="mdmark-th-tools"><button class="mdmark-pin" type="button" aria-pressed="false" aria-label="${label}" title="${label}" data-label="${label}">${svg("pin")}</button></span></span></th>`;
        })
        .join("")}</tr>`,
    ).join("");
    const wideCol = def.wide ? head.names.indexOf(def.wide) : -1;
    const bodyHtml = def.body
      .map((row) => `<tr>${row.map((value, c) => `<td data-col="${c}"${c === wideCol ? ' class="mdmark-wide"' : ""}>${esc(value)}</td>`).join("")}</tr>`)
      .join("");
    root.innerHTML = `${def.warning ? warningHtml(def.warning) : ""}<table tabindex="0" aria-label="表: ${esc(def.label)}"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
    const table = root.querySelector("table");

    /** 列ごとの留める前の左端の位置と幅（本文のセルで測る） */
    const measure = () => {
      for (const cell of table.querySelectorAll("th, td")) {
        cell.classList.remove("is-pinned-col", "is-pinned-edge", "is-pinned-edge-end");
        cell.style.left = "";
        cell.style.right = "";
      }
      const origin = table.getBoundingClientRect().left - table.scrollLeft;
      return head.names.map((_, c) => {
        const rect = table.querySelector(`tbody td[data-col="${c}"]`).getBoundingClientRect();
        return { left: rect.left - origin, width: rect.width };
      });
    };

    let boxes = [];
    let offsets = [];

    /** 留めた列に left・right を入れる。結合した見出しは、またぐ列が全て留まっているときだけ留める */
    const applyPin = () => {
      const overflow = table.scrollWidth > table.clientWidth;
      for (const pin of root.querySelectorAll(".mdmark-pin")) pin.hidden = !overflow;
      boxes = measure();
      // 選んだ列を左から順に足し、見える幅を超える列から右は留めない
      const selected = overflow ? [...pinned].sort((a, b) => a - b) : [];
      const applied = [];
      let total = 0;
      for (const c of selected) {
        if (total + boxes[c].width > table.clientWidth) break;
        total += boxes[c].width;
        applied.push(c);
      }
      const unpinned = selected.filter((c) => !applied.includes(c));
      offsets = head.names.map((_, c) => ({
        start: applied.filter((k) => k < c).reduce((sum, k) => sum + boxes[k].width, 0),
        end: applied.filter((k) => k > c).reduce((sum, k) => sum + boxes[k].width, 0),
      }));
      for (const cell of table.querySelectorAll("th, td")) {
        const first = Number(cell.dataset.col);
        const last = first + Number(cell.getAttribute("colspan") ?? 1) - 1;
        const covered = Array.from({ length: last - first + 1 }, (_, i) => first + i);
        const isPinned = covered.every((c) => applied.includes(c));
        cell.classList.toggle("is-pinned-col", isPinned);
        cell.style.left = isPinned ? `${offsets[first].start}px` : "";
        // through は今と同じく左端にだけ留める
        cell.style.right = isPinned && isEach ? `${offsets[last].end}px` : "";
      }
      for (const pin of root.querySelectorAll(".mdmark-pin")) {
        const c = Number(pin.closest("th").dataset.col);
        // ボタンは読む人が選んだ列を表す（留まったかによらない）
        const pressed = isEach ? pinned.has(c) : pinned.size > 0 && c === Math.max(...pinned);
        // 留まっていないことを示すボタン: each は留まっていない選んだ列、through は留まっていない列があるときの押した列
        const notFit = pressed && (isEach ? unpinned.includes(c) : unpinned.length > 0);
        pin.setAttribute("aria-pressed", String(pressed));
        pin.classList.toggle("is-unpinned", notFit);
        const label = notFit ? `${pin.dataset.label}（表の幅に収まらないため留まっていません）` : pin.dataset.label;
        pin.setAttribute("aria-label", label);
        pin.setAttribute("title", label);
      }
      markEdges();
    };

    /** 左端に留まっている最も右の列と、右端に留まっている最も左の列に、境の線を引く */
    const markEdges = () => {
      const view = { start: table.scrollLeft, end: table.scrollLeft + table.clientWidth };
      const applied = [...pinned].filter((c) => table.querySelector(`td.is-pinned-col[data-col="${c}"]`));
      const atStart = applied.filter((c) => boxes[c].left < view.start + offsets[c].start + 1);
      const atEnd = isEach ? applied.filter((c) => boxes[c].left + boxes[c].width > view.end - offsets[c].end - 1) : [];
      const startEdge = atStart.length > 0 ? Math.max(...atStart) : -1;
      const endEdge = atEnd.length > 0 ? Math.min(...atEnd) : -1;
      for (const cell of table.querySelectorAll("th, td")) {
        const first = Number(cell.dataset.col);
        const last = first + Number(cell.getAttribute("colspan") ?? 1) - 1;
        const isPinned = cell.classList.contains("is-pinned-col");
        cell.classList.toggle("is-pinned-edge", isPinned && last === startEdge);
        cell.classList.toggle("is-pinned-edge-end", isPinned && first === endEdge);
      }
    };

    for (const pin of root.querySelectorAll(".mdmark-pin")) {
      pin.addEventListener("click", () => {
        const c = Number(pin.closest("th").dataset.col);
        const pressed = pin.getAttribute("aria-pressed") === "true";
        if (isEach) {
          if (pressed) pinned.delete(c);
          else pinned.add(c);
        } else {
          pinned.clear();
          if (!pressed) for (let k = 0; k <= c; k += 1) pinned.add(k);
        }
        applyPin();
      });
    }
    table.addEventListener("scroll", markEdges, { passive: true });
    window.addEventListener("resize", applyPin);
    applyPin();

    // モックの見本: 押した後とスクロールした後の状態で見せる
    for (const c of def.press ?? []) {
      if (isEach) pinned.add(c);
      else {
        pinned.clear();
        for (let k = 0; k <= c; k += 1) pinned.add(k);
      }
    }
    applyPin();
    if (def.scroll === "end") table.scrollLeft = table.scrollWidth;
    // 数値は列の位置: その列の右端が表の見える範囲の右端に揃うまでスクロールする
    if (typeof def.scroll === "number") {
      table.scrollLeft = boxes[def.scroll].left + boxes[def.scroll].width - table.clientWidth;
    }
    markEdges();
  };

  for (const root of document.querySelectorAll("[data-mock-table533]")) {
    mountTable(root, window.mdmarkMockTables533[root.dataset.mockTable533]);
  }
}
