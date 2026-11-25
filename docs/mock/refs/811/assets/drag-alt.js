// #811 の表の見本: 列の幅と列の並べ替えに、ドラッグしない操作を付ける。
// #449 の table-resize.js（列の幅のつまみ）と #184 の refs/303/assets/table.js（テーブル設定の列の並べ替え）の後に読む。
// 幅と順の変更は、つまみへ ←・→・Enter・↑・↓ のキーを送って、元のスクリプトの範囲の制限のまま変える。
// [data-mock811] の値で案を切り替える。
//   width-a: 見出しのメニューのボタン / width-b: つまみを押して開くメニュー / width-c: テーブル設定の列名の行のボタン
//   reorder-a: テーブル設定の列名の行の前へ・後ろへのボタン / reorder-b: つまみを押して開くメニュー
// data-mock811-open に列の番号（width-*）か列名（reorder-*）を書くと、描いた直後にその列のメニューを開いて見せる

{
  const ICON = {
    more: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    wider: '<path d="m9 18 6-6-6-6"/>',
    narrower: '<path d="m15 18-6-6 6-6"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
  };
  const svg = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
  /** つまみを押してから離すまでに、ドラッグとみなす移動の距離（px） */
  const DRAG_PX = 4;
  /** 1 回目のクリックからダブルクリックを待つ時間（ms）。この間に 2 回目が来たらメニューを開かない */
  const DOUBLE_CLICK_MS = 250;

  const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  let menuId = 0;

  /** 開いたメニューを閉じ、開いた元へフォーカスを戻す */
  const closeMenu = (menu, opener, focus = true) => {
    if (menu.hidden) return;
    menu.hidden = true;
    opener.setAttribute?.("aria-expanded", "false");
    if (focus) opener.focus();
  };

  /** opener の下にメニューを開く。items は [{ label, icon, run, enabled }] */
  const openMenu = (host, opener, title, items) => {
    host.querySelector(".mdmark-811-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "mdmark-811-menu";
    menu.id = `mdmark-811-menu-${++menuId}`;
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", title);
    const buttons = items.map((item) => {
      if (item === "sep") return document.createElement("hr");
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `${svg(item.icon)}<span>${item.label}</span>`;
      button.addEventListener("click", () => {
        item.run();
        refresh();
      });
      button.item = item;
      return button;
    });
    menu.append(...buttons);
    const refresh = () => {
      for (const button of buttons) if (button.item) button.disabled = !button.item.enabled();
    };
    refresh();
    // つまみの左下に合わせて置く
    const hostBox = host.getBoundingClientRect();
    const box = opener.getBoundingClientRect();
    host.append(menu);
    menu.style.top = `${box.bottom - hostBox.top + 4}px`;
    menu.style.left = `${Math.max(0, Math.min(box.left - hostBox.left, hostBox.width - menu.offsetWidth))}px`;
    opener.setAttribute?.("aria-expanded", "true");
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(menu, opener);
      }
    });
    const outside = (event) => {
      if (menu.contains(event.target) || event.target === opener) return;
      closeMenu(menu, opener, false);
      document.removeEventListener("pointerdown", outside, true);
    };
    document.addEventListener("pointerdown", outside, true);
    menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    return menu;
  };

  /** 列の幅のメニューの項目。つまみの aria-value* から押せるかを決める */
  const widthItems = (handle) => {
    const value = (name) => Number(handle.getAttribute(name));
    return [
      { label: "幅を広げる", icon: "wider", run: () => key(handle, "ArrowRight"), enabled: () => value("aria-valuenow") < value("aria-valuemax") },
      { label: "幅を狭める", icon: "narrower", run: () => key(handle, "ArrowLeft"), enabled: () => value("aria-valuenow") > value("aria-valuemin") },
      "sep",
      { label: "元の幅に戻す", icon: "reset", run: () => key(handle, "Enter"), enabled: () => true },
    ];
  };

  /** 案 B: つまみの 1 回のクリック・タップ（ドラッグ・ダブルクリックでないとき）でメニューを開く */
  const onSingleClick = (element, open) => {
    let down = null;
    let timer = 0;
    element.addEventListener("pointerdown", (event) => {
      down = { x: event.clientX, y: event.clientY };
    });
    element.addEventListener("click", (event) => {
      const moved = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_PX;
      down = null;
      clearTimeout(timer);
      if (moved || event.detail > 1) return;
      timer = setTimeout(open, DOUBLE_CLICK_MS);
    });
    element.addEventListener("dblclick", () => clearTimeout(timer));
  };

  const setupWidth = (root, variant) => {
    const table = root.querySelector("table");
    const handles = [...root.querySelectorAll(".mdmark-col-resize")];
    const nameOf = (handle) => table.querySelectorAll("thead th")[Number(handle.dataset.col)].querySelector(".mdmark-th > span").textContent;
    const describe = (handle, text) => {
      const note = document.createElement("span");
      note.id = `mdmark-811-note-${++menuId}`;
      note.hidden = true;
      note.textContent = text;
      handle.after(note);
      handle.setAttribute("aria-describedby", note.id);
    };
    const opens = new Map();

    for (const handle of handles) {
      const title = `「${nameOf(handle)}」の列の幅`;
      if (variant === "width-a") {
        // 案 A: 見出しのボタンの並びに「列のメニュー」を足す
        const tools = handle.closest("th").querySelector(".mdmark-th-tools");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mdmark-811-colmenu";
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", `「${nameOf(handle)}」の列のメニュー`);
        button.title = button.getAttribute("aria-label");
        button.innerHTML = svg("more");
        tools.append(button);
        const open = () => openMenu(root, button, title, widthItems(handle));
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          open();
        });
        opens.set(handle.dataset.col, open);
      } else if (variant === "width-b") {
        // 案 B: つまみの 1 回のクリック・タップでメニューを開く。つまみは separator のまま、開くことは説明で伝える
        describe(handle, "押すと、列の幅を広げる・狭める・元に戻すメニューを開きます");
        const open = () => openMenu(root, handle, title, widthItems(handle));
        onSingleClick(handle, open);
        opens.set(handle.dataset.col, open);
      }
    }

    if (variant === "width-c") {
      // 案 C: 表の下のテーブル設定の列名の行に、幅を広げる・狭めるボタンを並べる
      const list = document.createElement("ul");
      list.className = "mdmark-811-width-list";
      list.setAttribute("aria-label", "テーブル設定（列の幅）");
      for (const handle of handles) {
        const items = widthItems(handle).filter((item) => item !== "sep");
        const li = document.createElement("li");
        li.innerHTML = `<span>${nameOf(handle)}</span><span class="mdmark-811-row-tools"></span>`;
        const tools = li.querySelector(".mdmark-811-row-tools");
        const buttons = items.map((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `「${nameOf(handle)}」の${item.label}`);
          button.title = button.getAttribute("aria-label");
          button.innerHTML = svg(item.icon);
          button.addEventListener("click", () => {
            item.run();
            refreshAll();
          });
          button.item = item;
          tools.append(button);
          return button;
        });
        li.buttons = buttons;
        list.append(li);
      }
      const refreshAll = () => {
        for (const li of list.children) for (const button of li.buttons) button.disabled = !button.item.enabled();
      };
      refreshAll();
      root.append(list);
    }

    const open = root.dataset.mock811Open;
    if (open !== undefined) requestAnimationFrame(() => opens.get(open)?.());
  };

  const setupReorder = (root, variant) => {
    const list = root.querySelector(".mdmark-table-settings-list");
    if (!list) return;
    /** 隣の列へ動かせるか（#184 の canMove と同じ: 同じ結合の範囲とピン止めの側の中だけ） */
    const canMove = (from, to) =>
      Boolean(to?.dataset.column) &&
      (from.dataset.group ?? "") === (to.dataset.group ?? "") &&
      (from.dataset.pinned === "true") === (to.dataset.pinned === "true");
    const itemsOf = (item) => [
      { label: "前へ移す", icon: "up", run: () => key(item.querySelector(".mdmark-table-settings-grip"), "ArrowUp"), enabled: () => canMove(item, item.previousElementSibling) },
      { label: "後ろへ移す", icon: "down", run: () => key(item.querySelector(".mdmark-table-settings-grip"), "ArrowDown"), enabled: () => canMove(item, item.nextElementSibling) },
    ];
    const opens = new Map();
    const note = root.querySelector(".mdmark-table-settings-note");

    for (const item of list.querySelectorAll("[data-column]")) {
      const grip = item.querySelector(".mdmark-table-settings-grip");
      const name = item.dataset.name;
      if (variant === "reorder-a") {
        // 案 A: 列名の行に、前へ・後ろへのボタンを常に並べる
        const tools = document.createElement("span");
        tools.className = "mdmark-811-row-tools";
        const buttons = itemsOf(item).map((entry) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `「${name}」を${entry.label}`);
          button.title = button.getAttribute("aria-label");
          button.innerHTML = svg(entry.icon);
          button.addEventListener("click", () => {
            entry.run();
            refreshRows();
            button.focus();
          });
          button.entry = entry;
          tools.append(button);
          return button;
        });
        item.buttons = buttons;
        item.querySelector(".mdmark-table-settings-eye")?.before(tools) ?? item.append(tools);
      } else if (variant === "reorder-b") {
        // 案 B: つまみの 1 回のクリック・タップでメニューを開く
        if (note) note.textContent = "つまみをドラッグするか、つまみを押して開くメニュー・↑・↓ キーで並べ替えます。先頭の列は隠せません";
        const open = () => openMenu(root, grip, `「${name}」の列の移動`, itemsOf(item));
        onSingleClick(grip, open);
        opens.set(name, open);
      }
    }
    const refreshRows = () => {
      for (const item of list.querySelectorAll("[data-column]")) for (const button of item.buttons ?? []) button.disabled = !button.entry.enabled();
    };
    refreshRows();

    const open = root.dataset.mock811Open;
    if (open !== undefined) requestAnimationFrame(() => opens.get(open)?.());
  };

  for (const root of document.querySelectorAll("[data-mock811]")) {
    const variant = root.dataset.mock811;
    if (variant.startsWith("width-")) setupWidth(root, variant);
    else setupReorder(root, variant);
  }
}
