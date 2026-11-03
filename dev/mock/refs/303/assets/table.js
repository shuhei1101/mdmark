// 表の列の並べ替え（+reorder）と、キーの列の階層（tree=）・YAML の見本（example=）のモックの操作
(() => {
  /** ドラッグ中とメニューで動かす列の見出しの位置を表の中で数える */
  function columnIndexOf(th) {
    return Array.from(th.parentElement.children).indexOf(th);
  }

  /** 列を入れ替えてよいか: 同じ結合の範囲（data-group）とピン止めの側（data-pinned）の中だけで動かす */
  function canMove(fromTh, toTh) {
    return (
      fromTh.dataset.group === toTh.dataset.group &&
      (fromTh.dataset.pinned === "true") === (toTh.dataset.pinned === "true")
    );
  }

  /** 表の最下段の見出しの from 列を to 列の前か後ろへ動かし、全ての本文の行のセルも同じ順に動かす */
  function moveColumn(table, from, to, after) {
    const rows = [table.tHead.rows[table.tHead.rows.length - 1], ...table.tBodies[0].rows];
    for (const row of rows) {
      const cells = row.children;
      const moving = cells[from];
      const target = cells[to];
      if (after) {
        target.after(moving);
      } else {
        target.before(moving);
      }
    }
    refreshMenus(table);
  }

  /** 列のメニューの左へ移動・右へ移動を、動かせない向きだけ disabled にする */
  function refreshMenus(table) {
    const head = table.tHead.rows[table.tHead.rows.length - 1];
    const ths = Array.from(head.children);
    ths.forEach((th, index) => {
      const left = th.querySelector("[data-move='left']");
      const right = th.querySelector("[data-move='right']");
      if (left) left.disabled = index === 0 || !canMove(th, ths[index - 1]);
      if (right) right.disabled = index === ths.length - 1 || !canMove(th, ths[index + 1]);
    });
  }

  /** +reorder の表にドラッグ＆ドロップと列のメニューを付ける */
  function setupReorder(table) {
    const head = table.tHead.rows[table.tHead.rows.length - 1];
    let dragged = null;
    for (const th of head.children) {
      const grip = th.querySelector(".mdmark-col-grip");
      if (!grip) continue;
      grip.draggable = true;
      grip.addEventListener("dragstart", (event) => {
        dragged = th;
        event.dataTransfer.effectAllowed = "move";
        const index = columnIndexOf(th);
        for (const row of table.rows) row.children[index]?.classList.add("is-dragging");
      });
      grip.addEventListener("dragend", () => {
        for (const cell of table.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after")) {
          cell.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
        }
        table.closest(".mdmark-table").classList.remove("is-drop-blocked");
        dragged = null;
      });
      th.addEventListener("dragover", (event) => {
        if (!dragged || dragged === th) return;
        const wrapper = table.closest(".mdmark-table");
        th.classList.remove("is-drop-before", "is-drop-after");
        // 結合の範囲の外とピン止めの境の向こうには線を出さない
        if (!canMove(dragged, th)) {
          wrapper.classList.add("is-drop-blocked");
          return;
        }
        wrapper.classList.remove("is-drop-blocked");
        event.preventDefault();
        const rect = th.getBoundingClientRect();
        th.classList.add(event.clientX < rect.left + rect.width / 2 ? "is-drop-before" : "is-drop-after");
      });
      th.addEventListener("dragleave", () => th.classList.remove("is-drop-before", "is-drop-after"));
      th.addEventListener("drop", (event) => {
        if (!dragged || !canMove(dragged, th)) return;
        event.preventDefault();
        moveColumn(table, columnIndexOf(dragged), columnIndexOf(th), th.classList.contains("is-drop-after"));
      });

      // 列のメニュー: ⋯ で開閉し、Esc で閉じる
      const toggle = th.querySelector(".mdmark-col-menu-toggle");
      const menu = th.querySelector(".mdmark-col-menu");
      if (!toggle || !menu) continue;
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        menu.hidden = !open;
        if (open) menu.querySelector("button:not(:disabled)")?.focus();
      });
      menu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          toggle.setAttribute("aria-expanded", "false");
          menu.hidden = true;
          toggle.focus();
        }
      });
      for (const button of menu.querySelectorAll("[data-move]")) {
        button.addEventListener("click", () => {
          const index = columnIndexOf(th);
          const toRight = button.dataset.move === "right";
          moveColumn(table, index, toRight ? index + 1 : index - 1, toRight);
          toggle.setAttribute("aria-expanded", "false");
          menu.hidden = true;
          // 動かした列の見出しにフォーカスを残す
          toggle.focus();
        });
      }
    }
    refreshMenus(table);
  }

  /** 階層の行の子孫の行を返す（data-path が自分のパスで始まる行） */
  function descendantsOf(rows, row) {
    const path = row.dataset.path;
    return rows.filter((other) => other.dataset.parent && (other.dataset.parent === path || other.dataset.parent.startsWith(`${path}.`) || other.dataset.parent.startsWith(`${path}[]`)));
  }

  /** 開閉の状態から、畳んだ祖先を持つ行を隠す */
  function applyFold(rows) {
    const byPath = new Map(rows.map((row) => [row.dataset.path, row]));
    for (const row of rows) {
      let parent = byPath.get(row.dataset.parent);
      let hidden = false;
      while (parent) {
        const toggle = parent.querySelector(".mdmark-tree-toggle");
        if (toggle?.getAttribute("aria-expanded") === "false") hidden = true;
        parent = byPath.get(parent.dataset.parent);
      }
      row.hidden = hidden || row.dataset.filtered === "out";
    }
  }

  /** 選んだ行と同じ親を持つ行の範囲の、その階層の縦線を濃くする */
  function highlightGuides(rows, selected) {
    for (const guide of rows.flatMap((row) => Array.from(row.querySelectorAll(".mdmark-tree-guide")))) {
      guide.classList.remove("is-active");
    }
    if (!selected) return;
    const depth = Number(selected.dataset.depth);
    if (depth === 0) return;
    for (const row of rows) {
      if (row === selected || row.dataset.parent === selected.dataset.parent || descendantsOf(rows, selected).includes(row) || rows.some((sibling) => sibling.dataset.parent === selected.dataset.parent && descendantsOf(rows, sibling).includes(row))) {
        row.querySelectorAll(".mdmark-tree-guide")[depth - 1]?.classList.add("is-active");
      }
    }
  }

  /** 見本の行のうち、パスが一致する行に色を付ける（開いているタブの中だけ） */
  function linkExample(layout, path) {
    const lines = Array.from(layout.querySelectorAll(".mdmark-yaml-line"));
    for (const line of lines) line.classList.remove("is-linked");
    if (!path) return;
    for (const line of lines) {
      const panel = line.closest("[role='tabpanel']");
      if (panel?.hidden) continue;
      if (line.dataset.path === path) line.classList.add("is-linked");
    }
  }

  /** tree= の表に開閉・選択・コピー・見本との連動を付ける */
  function setupTree(table) {
    const rows = Array.from(table.querySelectorAll(".mdmark-tree-row"));
    const layout = table.closest(".mdmark-tree-layout");
    let selected = null;

    const select = (row) => {
      selected = selected === row ? null : row;
      for (const other of rows) other.setAttribute("aria-selected", String(other === selected));
      highlightGuides(rows, selected);
      if (layout) linkExample(layout, selected?.dataset.path);
    };

    for (const row of rows) {
      row.addEventListener("click", (event) => {
        // ▾・⧉ を押したときは行を選ばない
        if (event.target.closest(".mdmark-tree-toggle, .mdmark-tree-copy")) return;
        select(row);
      });
      const toggle = row.querySelector(".mdmark-tree-toggle");
      toggle?.addEventListener("click", (event) => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", `${row.dataset.path} を${open ? "畳む" : "開く"}`);
        // Shift を押しながら押すと、入れ子もまとめて開閉する
        if (event.shiftKey) {
          for (const child of descendantsOf(rows, row)) {
            const childToggle = child.querySelector(".mdmark-tree-toggle");
            childToggle?.setAttribute("aria-expanded", String(open));
          }
        }
        applyFold(rows);
      });
      const copy = row.querySelector(".mdmark-tree-copy");
      copy?.addEventListener("click", () => {
        navigator.clipboard?.writeText(row.dataset.path).catch(() => {});
        copy.classList.add("is-copied");
        copy.textContent = "コピーしました";
        setTimeout(() => {
          copy.classList.remove("is-copied");
          copy.textContent = "⧉";
        }, 2000);
      });
    }

    // 見本の行を押すと、表の同じパスの行を選ぶ
    if (layout) {
      for (const line of layout.querySelectorAll(".mdmark-yaml-line")) {
        line.addEventListener("click", () => {
          const row = rows.find((candidate) => candidate.dataset.path === line.dataset.path);
          if (row && row !== selected) select(row);
        });
      }
      for (const tab of layout.querySelectorAll("[role='tab']")) {
        tab.addEventListener("click", () => linkExample(layout, selected?.dataset.path));
      }
      const exampleToggle = layout.parentElement.querySelector(".mdmark-tree-example-toggle");
      exampleToggle?.addEventListener("click", () => {
        const shown = exampleToggle.getAttribute("aria-pressed") === "true";
        exampleToggle.setAttribute("aria-pressed", String(!shown));
        layout.classList.toggle("is-example-hidden", shown);
      });
    }

    // 絞り込み: 末尾の名前で照合し、当たった行と祖先の行を残す
    const filter = table.closest(".mdmark-table")?.querySelector("[data-tree-filter]");
    const count = table.closest(".mdmark-table")?.querySelector("[data-tree-count]");
    filter?.addEventListener("input", () => {
      const word = filter.value.trim();
      const byPath = new Map(rows.map((row) => [row.dataset.path, row]));
      const keep = new Set();
      let hits = 0;
      for (const row of rows) {
        const name = row.querySelector(".mdmark-tree-name");
        name.innerHTML = name.textContent;
        if (!word) continue;
        const text = name.textContent;
        const at = text.indexOf(word);
        if (at < 0) continue;
        name.innerHTML = `${text.slice(0, at)}<mark class="mdmark-tree-hit">${word}</mark>${text.slice(at + word.length)}`;
        keep.add(row);
        // 件数は補った行を数えない
        if (!row.classList.contains("is-virtual")) hits += 1;
        let parent = byPath.get(row.dataset.parent);
        while (parent) {
          keep.add(parent);
          parent = byPath.get(parent.dataset.parent);
        }
      }
      for (const row of rows) row.dataset.filtered = word && !keep.has(row) ? "out" : "in";
      if (count) count.textContent = word ? `${hits} 件` : `${rows.filter((row) => !row.classList.contains("is-virtual")).length} 件`;
      applyFold(rows);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    for (const table of document.querySelectorAll(".mdmark-table[data-reorder] table")) setupReorder(table);
    for (const table of document.querySelectorAll(".mdmark-table[data-tree] table")) setupTree(table);
  });
})();
