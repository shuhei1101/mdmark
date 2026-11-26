// #811 の表の見本: テーブル設定の列の並べ替えに、ドラッグしない操作（つまみを 1 回押して開くメニュー）を付ける。
// #184 の refs/303/assets/table.js（テーブル設定の列の並べ替え）の後に読む。
// 順の変更は、つまみへ ↑・↓ のキーを送って、元のスクリプトの範囲の制限のまま変える。
// [data-mock811="reorder"] の表に付ける。data-mock811-open に列名を書くと、描いた直後にその列のメニューを開いて見せる

{
  const ICON = {
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
  };
  const svg = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
  /** つまみを押してから離すまでに、ドラッグとみなす移動の距離（px） */
  const DRAG_PX = 4;

  const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  let menuId = 0;

  /** 開いたメニューを閉じ、開いた元へフォーカスを戻す */
  const closeMenu = (menu, opener, focus = true) => {
    if (menu.hidden) return;
    menu.hidden = true;
    opener.setAttribute("aria-expanded", "false");
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
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `${svg(item.icon)}<span>${item.label}</span>`;
      button.addEventListener("click", () => {
        item.run();
        refresh();
        // 押した項目が押せなくなったら、フォーカスがメニューの外へ落ちないよう押せる項目（反対の向き）へ移す
        if (button.disabled) menu.querySelector("button:not(:disabled)")?.focus();
      });
      button.item = item;
      return button;
    });
    menu.append(...buttons);
    const refresh = () => {
      for (const button of buttons) button.disabled = !button.item.enabled();
    };
    refresh();
    // つまみの左下に合わせて置く
    const hostBox = host.getBoundingClientRect();
    const box = opener.getBoundingClientRect();
    host.append(menu);
    menu.style.top = `${box.bottom - hostBox.top + 4}px`;
    menu.style.left = `${Math.max(0, Math.min(box.left - hostBox.left, hostBox.width - menu.offsetWidth))}px`;
    opener.setAttribute("aria-expanded", "true");
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
  };

  /** つまみの 1 回のクリック・タップ（ドラッグでないとき）でメニューを開く */
  const onSingleClick = (element, open) => {
    let down = null;
    element.addEventListener("pointerdown", (event) => {
      down = { x: event.clientX, y: event.clientY };
    });
    element.addEventListener("click", (event) => {
      const moved = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_PX;
      down = null;
      if (!moved) open();
    });
  };

  for (const root of document.querySelectorAll('[data-mock811="reorder"]')) {
    const list = root.querySelector(".mdmark-table-settings-list");
    if (!list) continue;
    /** 隣の列へ動かせるか（#184 の canMove と同じ: 同じ結合の範囲とピン止めの側の中だけ） */
    const canMove = (from, to) =>
      Boolean(to?.dataset.column) &&
      (from.dataset.group ?? "") === (to.dataset.group ?? "") &&
      (from.dataset.pinned === "true") === (to.dataset.pinned === "true");
    const note = root.querySelector(".mdmark-table-settings-note");
    if (note) note.textContent = "つまみをドラッグするか、つまみを押して開くメニュー・↑・↓ キーで並べ替えます。先頭の列は隠せません";
    const opens = new Map();
    for (const item of list.querySelectorAll("[data-column]")) {
      const grip = item.querySelector(".mdmark-table-settings-grip");
      const name = item.dataset.name;
      const items = [
        { label: "前へ移す", icon: "up", run: () => key(grip, "ArrowUp"), enabled: () => canMove(item, item.previousElementSibling) },
        { label: "後ろへ移す", icon: "down", run: () => key(grip, "ArrowDown"), enabled: () => canMove(item, item.nextElementSibling) },
      ];
      const open = () => openMenu(root, grip, `「${name}」の列の移動`, items);
      onSingleClick(grip, open);
      opens.set(name, open);
    }
    const open = root.dataset.mock811Open;
    if (open !== undefined) requestAnimationFrame(() => opens.get(open)?.());
  }
}
