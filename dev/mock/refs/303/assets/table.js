// 表の列の並べ替え（+reorder）と、キーの列の階層（tree=）・YAML の見本（example=）のモックの操作
(() => {
  /** 列を入れ替えてよいか: 同じ結合の範囲（data-group）とピン止めの側（data-pinned）の中だけで動かす */
  function canMove(from, to) {
    return (
      (from.dataset.group ?? "") === (to.dataset.group ?? "") &&
      (from.dataset.pinned === "true") === (to.dataset.pinned === "true")
    );
  }

  /** 列の一覧の並びのとおりに、見出しと全ての本文の行のセルを並べ直す */
  function applyOrder(table, list) {
    const order = Array.from(list.querySelectorAll("[data-column]")).map((item) => item.dataset.column);
    const rows = [table.tHead.rows[table.tHead.rows.length - 1], ...table.tBodies[0].rows];
    for (const row of rows) {
      const byColumn = new Map(Array.from(row.children).map((cell) => [cell.dataset.col, cell]));
      for (const column of order) row.append(byColumn.get(column));
    }
  }

  /** 先頭・末尾と、範囲とピン止めの境に当たるつまみを、キーボードで動かせない向きの分だけ案内に出す */
  function refreshGrips(list) {
    const items = Array.from(list.querySelectorAll("[data-column]"));
    items.forEach((item, index) => {
      const grip = item.querySelector(".mdmark-table-settings-grip");
      if (!grip) return;
      const up = index > 0 && canMove(item, items[index - 1]);
      const down = index < items.length - 1 && canMove(item, items[index + 1]);
      grip.disabled = !up && !down;
    });
  }

  /** テーブル設定: 帯のボタンでパネルを開閉し、列の一覧で並べ替えと表示の切り替えをする */
  function setupSettings(wrapper) {
    const table = wrapper.querySelector("table");
    const toggle = wrapper.querySelector(".mdmark-table-settings-toggle");
    const panel = wrapper.querySelector(".mdmark-table-settings");
    const list = panel?.querySelector(".mdmark-table-settings-list");
    if (!toggle || !panel || !list) return;
    // 単段の見出しの表だけ、セルに元の列の位置を持たせて並べ直す
    const reorderable = table.tHead.rows.length === 1;
    if (reorderable) {
      for (const row of [table.tHead.rows[0], ...table.tBodies[0].rows]) {
        Array.from(row.children).forEach((cell, index) => {
          cell.dataset.col ??= String(index);
        });
      }
    }
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggle.setAttribute("aria-expanded", "false");
        panel.hidden = true;
        toggle.focus();
      }
    });
    let dragged = null;
    for (const item of list.querySelectorAll("[data-column]")) {
      const grip = item.querySelector(".mdmark-table-settings-grip");
      const eye = item.querySelector(".mdmark-table-settings-eye");
      eye?.addEventListener("click", () => {
        const hidden = eye.getAttribute("aria-pressed") !== "true";
        eye.setAttribute("aria-pressed", String(hidden));
        eye.setAttribute("aria-label", `「${item.dataset.name}」を${hidden ? "表示" : "隠す"}`);
        item.classList.toggle("is-hidden-column", hidden);
        for (const cell of table.querySelectorAll(`[data-col="${item.dataset.column}"]`)) cell.hidden = hidden;
      });
      if (!grip) continue;
      grip.draggable = true;
      grip.addEventListener("dragstart", (event) => {
        dragged = item;
        event.dataTransfer.effectAllowed = "move";
        item.classList.add("is-dragging");
      });
      grip.addEventListener("dragend", () => {
        for (const other of list.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after")) {
          other.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
        }
        dragged = null;
      });
      item.addEventListener("dragover", (event) => {
        if (!dragged || dragged === item) return;
        item.classList.remove("is-drop-before", "is-drop-after");
        // 結合の範囲の外とピン止めの境の向こうには線を出さない
        if (!canMove(dragged, item)) return;
        event.preventDefault();
        const rect = item.getBoundingClientRect();
        item.classList.add(event.clientY < rect.top + rect.height / 2 ? "is-drop-before" : "is-drop-after");
      });
      item.addEventListener("dragleave", () => item.classList.remove("is-drop-before", "is-drop-after"));
      item.addEventListener("drop", (event) => {
        if (!dragged || !canMove(dragged, item)) return;
        event.preventDefault();
        if (item.classList.contains("is-drop-after")) item.after(dragged);
        else item.before(dragged);
        if (reorderable) applyOrder(table, list);
        refreshGrips(list);
      });
      // キーボード: つまみにフォーカスして ↑・↓ で 1 つずつ動かす
      grip.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const target = event.key === "ArrowUp" ? item.previousElementSibling : item.nextElementSibling;
        if (!target?.dataset.column || !canMove(item, target)) return;
        if (event.key === "ArrowUp") target.before(item);
        else target.after(item);
        if (reorderable) applyOrder(table, list);
        refreshGrips(list);
        grip.focus();
      });
    }
    refreshGrips(list);
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
        const shown = exampleToggle.getAttribute("aria-expanded") === "true";
        exampleToggle.setAttribute("aria-expanded", String(!shown));
        exampleToggle.textContent = shown ? "見本を表示" : "見本を隠す";
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
    for (const wrapper of document.querySelectorAll(".mdmark-table[data-settings]")) setupSettings(wrapper);
    for (const table of document.querySelectorAll(".mdmark-table[data-tree] table")) setupTree(table);
  });
})();
