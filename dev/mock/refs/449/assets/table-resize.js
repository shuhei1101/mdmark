// #449 の表の見本: 列の見出しの右端のつまみで列の幅を変える。
// [data-mock-table449] に、window.mdmarkMockTables449 の同じ名前の定義から表を描き、ピン止め（table.pin: each）とつまみを付ける。
// つまみはドラッグ・タッチ・←→ キーで幅を変え、ダブルクリック・ダブルタップ・Enter で描いた直後の幅に戻す。
// 幅を変えるたびに、留めた列の left・right を今の列の幅で再計算する

{
  const ICON_PIN =
    '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>';
  /** ←・→ キー 1 回で変える幅（px） */
  const KEY_STEP = 16;
  /** 2 回のタップをダブルタップとみなす間隔（ms） */
  const DOUBLE_TAP_MS = 300;

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pinSvg = `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PIN}</svg>`;

  /** 表を描き、ピン止めと列の幅のつまみを付ける */
  const mountTable = (root, def) => {
    const names = def.head[0];
    const wideCol = def.wide ? names.indexOf(def.wide) : -1;
    const pinned = new Set(def.pin ?? [0]);

    root.classList.add("mdmark-table");
    root.dataset.kind = def.resize ? "data" : "plain";
    root.classList.toggle("is-coarse", Boolean(def.coarse));
    const headHtml = `<tr>${names
      .map((name, c) => {
        const label = `「${esc(name)}」の列をピン止め`;
        const handle = def.resize
          ? `<span class="mdmark-col-resize" role="separator" aria-orientation="vertical" tabindex="0" aria-label="「${esc(name)}」の列の幅" data-col="${c}"></span>`
          : "";
        return `<th scope="col" data-col="${c}"${c === wideCol ? ' class="mdmark-wide"' : ""}><span class="mdmark-th"><span>${esc(name)}</span><span class="mdmark-th-tools"><button class="mdmark-pin" type="button" aria-pressed="false" aria-label="${label}" title="${label}">${pinSvg}</button></span></span>${handle}</th>`;
      })
      .join("")}</tr>`;
    const bodyHtml = def.body
      .map((row) => `<tr>${row.map((value, c) => `<td data-col="${c}"${c === wideCol ? ' class="mdmark-wide"' : ""}>${esc(value)}</td>`).join("")}</tr>`)
      .join("");
    root.innerHTML = `<table tabindex="0" aria-label="表: ${esc(def.label)}"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
    const table = root.querySelector("table");
    const headCells = [...table.querySelectorAll("thead th")];

    /** 列の幅（見出しのセルの幅） */
    const widthOf = (c) => headCells[c].getBoundingClientRect().width;
    /** 列の最小幅（px） */
    const minWidthOf = (c) => parseFloat(getComputedStyle(headCells[c]).minWidth) || 0;

    /** 列の幅を指定する。null で指定を解除し、描いた直後の幅に戻す（wide= の列は wide= の幅に戻る） */
    const setWidth = (c, width) => {
      const resized = width !== null;
      const value = resized ? `${Math.round(Math.max(minWidthOf(c), width))}px` : "";
      for (const cell of table.querySelectorAll(`[data-col="${c}"]:is(th, td)`)) {
        cell.style.width = value;
        cell.classList.toggle("is-resized", resized);
      }
      applyPin();
    };

    let boxes = [];
    let offsets = [];

    /** 列ごとの留める前の左端の位置と幅（本文のセルで測る） */
    const measure = () => {
      for (const cell of table.querySelectorAll("th, td")) {
        cell.classList.remove("is-pinned-col", "is-pinned-edge", "is-pinned-edge-end");
        cell.style.left = "";
        cell.style.right = "";
      }
      const origin = table.getBoundingClientRect().left - table.scrollLeft;
      return names.map((_, c) => {
        const rect = table.querySelector(`tbody td[data-col="${c}"]`).getBoundingClientRect();
        return { left: rect.left - origin, width: rect.width };
      });
    };

    /** 留めた列に left・right を入れ、つまみの aria-valuenow を今の幅にする */
    const applyPin = () => {
      const overflow = table.scrollWidth > table.clientWidth;
      for (const pin of root.querySelectorAll(".mdmark-pin")) pin.hidden = !overflow;
      boxes = measure();
      const applied = overflow ? [...pinned].sort((a, b) => a - b) : [];
      offsets = names.map((_, c) => ({
        start: applied.filter((k) => k < c).reduce((sum, k) => sum + boxes[k].width, 0),
        end: applied.filter((k) => k > c).reduce((sum, k) => sum + boxes[k].width, 0),
      }));
      for (const cell of table.querySelectorAll("th, td")) {
        const c = Number(cell.dataset.col);
        const isPinned = applied.includes(c);
        cell.classList.toggle("is-pinned-col", isPinned);
        cell.style.left = isPinned ? `${offsets[c].start}px` : "";
        cell.style.right = isPinned ? `${offsets[c].end}px` : "";
      }
      for (const pin of root.querySelectorAll(".mdmark-pin")) {
        pin.setAttribute("aria-pressed", String(applied.includes(Number(pin.closest("th").dataset.col))));
      }
      for (const handle of root.querySelectorAll(".mdmark-col-resize")) {
        const c = Number(handle.dataset.col);
        handle.setAttribute("aria-valuenow", String(Math.round(widthOf(c))));
        handle.setAttribute("aria-valuemin", String(Math.round(minWidthOf(c))));
      }
      markEdges();
    };

    /** 左端に留まっている最も右の列と、右端に留まっている最も左の列に、境の線を引く */
    const markEdges = () => {
      const view = { start: table.scrollLeft, end: table.scrollLeft + table.clientWidth };
      const applied = [...pinned].filter((c) => table.querySelector(`td.is-pinned-col[data-col="${c}"]`));
      const atStart = applied.filter((c) => boxes[c].left < view.start + offsets[c].start + 1);
      const atEnd = applied.filter((c) => boxes[c].left + boxes[c].width > view.end - offsets[c].end - 1);
      const startEdge = atStart.length > 0 ? Math.max(...atStart) : -1;
      const endEdge = atEnd.length > 0 ? Math.min(...atEnd) : -1;
      for (const cell of table.querySelectorAll("th, td")) {
        const c = Number(cell.dataset.col);
        const isPinned = cell.classList.contains("is-pinned-col");
        cell.classList.toggle("is-pinned-edge", isPinned && c === startEdge);
        cell.classList.toggle("is-pinned-edge-end", isPinned && c === endEdge);
      }
    };

    for (const pin of root.querySelectorAll(".mdmark-pin")) {
      pin.addEventListener("click", () => {
        const c = Number(pin.closest("th").dataset.col);
        if (pinned.has(c)) pinned.delete(c);
        else pinned.add(c);
        applyPin();
      });
    }

    for (const handle of root.querySelectorAll(".mdmark-col-resize")) {
      const c = Number(handle.dataset.col);
      let drag = null;
      let lastTap = 0;
      handle.addEventListener("pointerdown", (event) => {
        // つまみのドラッグを、見出しの並べ替え・ピン止めのボタンの操作として受けない
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        drag = { x: event.clientX, width: widthOf(c) };
        handle.classList.add("is-dragging");
      });
      handle.addEventListener("pointermove", (event) => {
        if (!drag) return;
        setWidth(c, drag.width + (event.clientX - drag.x));
      });
      const endDrag = (event) => {
        if (!drag) return;
        drag = null;
        handle.classList.remove("is-dragging");
        if (event.type !== "pointerup" || event.pointerType !== "touch") return;
        // タッチは dblclick が来ないので、2 回のタップの間隔でダブルタップを見分ける
        if (event.timeStamp - lastTap < DOUBLE_TAP_MS) {
          setWidth(c, null);
          lastTap = 0;
        } else {
          lastTap = event.timeStamp;
        }
      };
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
      handle.addEventListener("dblclick", () => setWidth(c, null));
      handle.addEventListener("click", (event) => event.stopPropagation());
      handle.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          setWidth(c, widthOf(c) + (event.key === "ArrowRight" ? KEY_STEP : -KEY_STEP));
        } else if (event.key === "Enter") {
          event.preventDefault();
          setWidth(c, null);
        }
      });
    }

    table.addEventListener("scroll", markEdges, { passive: true });
    window.addEventListener("resize", applyPin);
    applyPin();

    // モックの見本: 幅を変えた後・スクロールした後・つまみの状態で見せる
    for (const [c, delta] of Object.entries(def.widths ?? {})) {
      setWidth(Number(c), widthOf(Number(c)) + delta);
    }
    for (const [c, state] of Object.entries(def.state ?? {})) {
      root.querySelector(`.mdmark-col-resize[data-col="${c}"]`).classList.add(`is-${state === "drag" ? "dragging" : "hover"}`);
    }
    if (def.scroll === "end") table.scrollLeft = table.scrollWidth;
    markEdges();
    if (def.focus !== undefined) {
      root.querySelector(`.mdmark-col-resize[data-col="${def.focus}"]`).classList.add("is-focus");
    }
  };

  for (const root of document.querySelectorAll("[data-mock-table449]")) {
    mountTable(root, window.mdmarkMockTables449[root.dataset.mockTable449]);
  }
}
