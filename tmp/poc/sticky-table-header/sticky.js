// PoC: 表の見出し行を画面の上端、集計の行を画面の下端に、ページのスクロールで留める
// mode "a": 枠の外に複製を置く / mode "b": 元のセルを CSS のスクロール連動のアニメーションで動かす / mode "c": 元のセルを transform で動かす

/** 画面の上端から留める位置のずれ（px） */
const stickyTop = (root) =>
  Number.parseFloat(getComputedStyle(root).getPropertyValue("--poc-sticky-top")) || 0;

/** 表の中の見出し行・本文・集計の行の、ずらす前の画面上の位置 */
function naturalBox(table) {
  const rect = table.getBoundingClientRect();
  const origin = rect.top + table.clientTop - table.scrollTop;
  const head = table.tHead;
  const body = table.tBodies[0];
  const foot = table.tFoot;
  return {
    left: rect.left + table.clientLeft,
    width: table.clientWidth,
    headTop: origin + head.offsetTop,
    headHeight: head.offsetHeight,
    bodyTop: origin + body.offsetTop,
    bodyBottom: origin + body.offsetTop + body.offsetHeight,
    footTop: foot ? origin + foot.offsetTop : 0,
    footHeight: foot ? foot.offsetHeight : 0,
  };
}

/** 案 C: 見出し行を下げ、集計の行を上げるずれを変数で渡す */
function shiftMode(root, table) {
  const update = () => {
    const box = naturalBox(table);
    const top = stickyTop(root);
    // 見出し行: 画面の上端より上に出た分だけ下げ、本文の最後の行より下へは下げない
    const headMax = Math.max(0, box.bodyBottom - box.headTop - box.headHeight);
    const headShift = Math.min(Math.max(0, top - box.headTop), headMax);
    table.style.setProperty("--poc-head-shift", `${headShift}px`);
    if (table.tFoot) {
      // 集計の行: 画面の下端より下に出た分だけ上げ、本文の最初の行より上へは上げない
      const footMin = Math.min(0, box.bodyTop - box.footTop);
      const footShift = Math.max(Math.min(0, innerHeight - box.footTop - box.footHeight), footMin);
      table.style.setProperty("--poc-foot-shift", `${footShift}px`);
    }
  };
  return {
    update,
    headCells: () => [...table.tHead.rows[0].cells],
    footCells: () => (table.tFoot ? [...table.tFoot.rows[0].cells] : []),
  };
}

/** 案 B: 見出し行と集計の行の動く範囲だけを変数で渡し、ずらすのは CSS のスクロール連動のアニメーションに任せる */
function timelineMode(root, table) {
  const update = () => {
    const head = table.tHead;
    const body = table.tBodies[0];
    const foot = table.tFoot;
    // 表の上端から見出し行の上端まで（枠の太さ）
    table.style.setProperty("--poc-head-start", `${table.clientTop + head.offsetTop}px`);
    // 見出し行を下げられる量: 本文の最後の行の下端まで
    table.style.setProperty("--poc-head-max", `${Math.max(0, body.offsetTop + body.offsetHeight - head.offsetTop - head.offsetHeight)}px`);
    if (foot) {
      // 集計の行を上げられる量: 本文の最初の行の上端まで
      table.style.setProperty("--poc-foot-max", `${foot.offsetTop - body.offsetTop}px`);
      // 表の下端から集計の行の下端まで（枠の太さ）
      table.style.setProperty("--poc-foot-end", `${table.offsetHeight - table.clientTop - foot.offsetTop - foot.offsetHeight}px`);
    }
  };
  return {
    update: () => {},
    rebuild: update,
    headCells: () => [...table.tHead.rows[0].cells],
    footCells: () => (table.tFoot ? [...table.tFoot.rows[0].cells] : []),
  };
}

/** 要素から section までの子の番号の並び */
function indexPath(el, section) {
  const path = [];
  for (let node = el; node !== section; node = node.parentElement) {
    path.unshift([...node.parentElement.children].indexOf(node));
  }
  return path;
}

/** 案 A: 見出し行か集計の行の複製を、画面に固定した枠に置いて動かす */
function cloneSection(root, table, section, edge) {
  const holder = document.createElement("div");
  holder.className = "poc-clone";
  holder.setAttribute("aria-hidden", "true");
  holder.hidden = true;
  const clone = document.createElement("table");
  holder.append(clone);
  table.parentElement.append(holder);

  /** 複製を作り直し、セルの幅を元に合わせる */
  const rebuild = () => {
    const copy = section.cloneNode(true);
    for (const drawer of copy.querySelectorAll(".mdmark-filter-drawer")) {
      drawer.remove();
    }
    for (const focusable of copy.querySelectorAll("button, input, a")) {
      focusable.tabIndex = -1;
    }
    const sourceCells = [...section.rows[0].cells];
    [...copy.rows[0].cells].forEach((cell, index) => {
      const width = `${sourceCells[index].getBoundingClientRect().width}px`;
      Object.assign(cell.style, { width, minWidth: width, maxWidth: width, boxSizing: "border-box" });
    });
    clone.replaceChildren(copy);
  };

  /** 複製のボタンを押したら、元の同じボタンを押す */
  clone.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    // 複製のボタンを、表の操作の受け取り（文書の要素に付けた委譲）に元のボタンとして読ませない
    event.stopPropagation();
    const original = indexPath(button, clone.firstElementChild).reduce(
      (node, index) => node.children[index],
      section,
    );
    original.click();
    // 開いた絞り込みのパネルを、押した複製のボタンの下へ移す
    const drawer = original.closest("th")?.querySelector(".mdmark-filter-drawer:not([hidden])");
    if (drawer) {
      const rect = button.getBoundingClientRect();
      drawer.style.top = `${rect.bottom + 4}px`;
      drawer.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - drawer.offsetWidth - 16))}px`;
    }
  });

  new MutationObserver(() => rebuild()).observe(section, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
  });

  const update = () => {
    const box = naturalBox(table);
    const top = stickyTop(root);
    let y;
    let shown;
    if (edge === "top") {
      y = Math.min(top, box.bodyBottom - box.headHeight);
      shown = box.headTop < top && y + box.headHeight > 0;
    } else {
      y = Math.max(innerHeight - box.footHeight, box.bodyTop);
      shown = box.footTop + box.footHeight > innerHeight && y < innerHeight;
    }
    holder.hidden = !shown;
    if (!shown) {
      return;
    }
    Object.assign(holder.style, { top: `${y}px`, left: `${box.left}px`, width: `${box.width}px` });
    Object.assign(clone.style, { width: `${box.width}px`, maxWidth: `${box.width}px` });
    clone.scrollLeft = table.scrollLeft;
  };

  rebuild();
  return {
    update,
    rebuild,
    cells: () => [...(holder.hidden ? section : clone.firstElementChild).rows[0].cells],
  };
}

/** 案 A: 見出し行と集計の行の両方に複製を付ける */
function cloneMode(root, table) {
  const head = cloneSection(root, table, table.tHead, "top");
  const foot = table.tFoot ? cloneSection(root, table, table.tFoot, "bottom") : undefined;
  return {
    update: () => {
      head.update();
      foot?.update();
    },
    rebuild: () => {
      head.rebuild();
      foot?.rebuild();
    },
    headCells: head.cells,
    footCells: () => foot?.cells() ?? [],
  };
}

/** root の中の表に、mode の留め方を付ける */
export function install(root, mode) {
  root.classList.add(`poc-${mode}`);
  const tables = [...root.querySelectorAll(".mdmark-table table")];
  const modes = { a: cloneMode, b: timelineMode, c: shiftMode };
  const parts = tables.map((table) => modes[mode](root, table));
  const update = () => {
    for (const part of parts) {
      part.update();
    }
  };
  const relayout = () => {
    for (const part of parts) {
      part.rebuild?.();
    }
    update();
  };
  relayout();
  addEventListener("scroll", update, { passive: true });
  // 表の中の横のスクロール
  document.addEventListener("scroll", update, { capture: true, passive: true });
  addEventListener("resize", relayout);
  for (const table of tables) {
    new ResizeObserver(relayout).observe(table);
  }
  update();
  return { mode, update, tables, parts };
}
