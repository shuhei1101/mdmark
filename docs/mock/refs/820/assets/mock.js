// #820 のモック: 配布物の mount で実物の部品を描き、追加するボタン・メニューだけを重ねる。
// メニューの項目は、部品が今持つキーの操作（Alt + 矢印キー・矢印キー）を送って動かす
import { mount } from "../../../../../dist/index.js";

const ICON = {
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  move: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
  wrap: '<path d="m16 16-3 3 3 3"/><path d="M3 12h14.5a1 1 0 0 1 0 7H13"/><path d="M3 19h6"/><path d="M3 5h18"/>',
};
const svg = (name) =>
  `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
/** 押してから離すまでに、ドラッグとみなす移動の距離（px） */
const DRAG_PX = 4;

/** 部品を 1 つ描く。描き直すたびに `patch` を当て直す */
export function draw(host, markdown, patch) {
  mount(host, { markdown });
  let applying = false;
  const apply = () => {
    if (applying) return;
    applying = true;
    patch?.(host);
    queueMicrotask(() => {
      applying = false;
    });
  };
  new MutationObserver(apply).observe(host, { childList: true, subtree: true });
  apply();
}

const sendKey = (target, key, altKey) =>
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, altKey, bubbles: true, cancelable: true }));

/** 開いたメニューを閉じ、開いた元へフォーカスを戻す */
function closeMenu(menu, focusOpener) {
  if (!menu.isConnected) return;
  const opener = menu.opener();
  menu.remove();
  opener?.setAttribute("aria-expanded", "false");
  if (focusOpener) opener?.focus();
}

/**
 * opener の下にメニューを開く。items は [{ label, icon, run }]。
 * opener は描き直しで入れ替わるため、取り出す関数で受け取る
 */
function openMenu(layer, opener, title, items) {
  layer.querySelector(".mock820-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "mock820-menu";
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", title);
  menu.opener = opener;
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${svg(item.icon)}<span>${item.label}</span>`;
    button.addEventListener("click", () => {
      item.run();
      requestAnimationFrame(() => place(menu, layer, opener()));
    });
    menu.append(button);
  }
  layer.append(menu);
  place(menu, layer, opener());
  opener()?.setAttribute("aria-expanded", "true");
  menu.addEventListener("keydown", (event) => {
    const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
    const at = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(menu, true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === "ArrowDown" ? 1 : -1;
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    }
  });
  const outside = (event) => {
    if (menu.contains(event.target) || opener()?.contains(event.target)) return;
    closeMenu(menu, false);
    document.removeEventListener("pointerdown", outside, true);
  };
  document.addEventListener("pointerdown", outside, true);
  menu.querySelector("button")?.focus({ preventScroll: true });
  return menu;
}

/** 要素の左下に合わせて置く（layer の中の位置） */
function place(element, layer, anchor) {
  if (!anchor) return;
  const base = layer.getBoundingClientRect();
  const box = anchor.getBoundingClientRect();
  element.style.top = `${box.bottom - base.top + 4}px`;
  element.style.left = `${Math.max(0, Math.min(box.left - base.left, base.width - element.offsetWidth))}px`;
}

/** 1 回のクリック・タップ（ドラッグでないとき）だけを受け取る */
function onSingleClick(root, handle) {
  let down = null;
  root.addEventListener(
    "pointerdown",
    (event) => {
      down = { x: event.clientX, y: event.clientY, target: event.target };
    },
    true,
  );
  root.addEventListener(
    "pointerup",
    (event) => {
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y) >= DRAG_PX;
      const target = down.target;
      down = null;
      if (!moved) requestAnimationFrame(() => handle(target));
    },
    true,
  );
}

/** 線の区間の押せる範囲の path が横か（M と L の 2 点の y が同じ） */
function isHorizontal(path) {
  const n = (path.getAttribute("d") ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
  return n.length >= 4 && Math.abs(n[1] - n[3]) < Math.abs(n[0] - n[2]);
}

const MOVE4 = [
  ["上へ移す", "up", "ArrowUp"],
  ["下へ移す", "down", "ArrowDown"],
  ["左へ移す", "left", "ArrowLeft"],
  ["右へ移す", "right", "ArrowRight"],
];

/**
 * map の構成図とシーケンス図に、最後に動かさずに押した要素のそばへ移動のボタンを出し、
 * ボタンで開くメニューの項目で Alt + 矢印キーを送る。グループの右下の角は、押すと大きさのメニューを開く
 */
export function attachMoveMenu(host) {
  host.classList.add("mock820-layer");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mock820-move";
  button.hidden = true;
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = svg("move");
  host.append(button);
  /** 移動のボタンが指す要素を、描き直しの後も取り出す */
  let pointed = null;
  const locate = () => pointed && host.querySelector(pointed.selector);
  const relocate = () => {
    const element = locate();
    button.hidden = !element || !isStillSelectedOrGroup();
    if (!button.hidden) {
      const base = host.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      button.style.top = `${box.top - base.top - 30}px`;
      button.style.left = `${box.right - base.left - 4}px`;
    }
  };
  /** ノードと参加者は選んでいる間だけ、グループと線の区間は押した後ずっと出す */
  const isStillSelectedOrGroup = () => {
    if (pointed.kind !== "node") return true;
    return locate()?.closest("[data-node]")?.classList.contains("is-selected") ?? false;
  };
  new MutationObserver(() => requestAnimationFrame(relocate)).observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  const pointAt = (target) => {
    if (target.closest(".mock820-move, .mock820-menu, button:not(.map-group-resize)")) return;
    const corner = target.closest(".map-group-resize");
    if (corner) {
      const id = corner.closest("[data-group]")?.dataset.group;
      const selector = `[data-group="${CSS.escape(id)}"] .map-group-resize`;
      openMenu(host, () => host.querySelector(selector), `「${id}」の大きさの変更`, [
        ["右へ広げる", "right", "ArrowRight"],
        ["下へ広げる", "down", "ArrowDown"],
        ["左へ狭める", "left", "ArrowLeft"],
        ["上へ狭める", "up", "ArrowUp"],
      ].map(([label, icon, key]) => ({ label, icon, run: () => sendKey(host.querySelector(selector), key, false) })));
      return;
    }
    const message = target.closest(".map-wire-hit[data-message]");
    if (message) {
      pointed = null;
      button.hidden = true;
      return;
    }
    const segment = target.closest(".map-wire-hit[data-wire] path, path.map-wire-hit[data-wire]");
    if (segment) {
      const id = segment.closest("[data-wire]").dataset.wire;
      const paths = [...host.querySelectorAll(`.map-wire-hit[data-wire="${CSS.escape(id)}"] path`)];
      const index = Math.max(0, paths.indexOf(segment));
      pointed = {
        kind: "wire",
        name: segment.closest("[aria-label]")?.getAttribute("aria-label") ?? id,
        selector: `.map-wire-hit[data-wire="${CSS.escape(id)}"] path:nth-of-type(${index + 1})`,
        items: isHorizontal(segment) ? MOVE4.slice(0, 2) : MOVE4.slice(2),
      };
    } else if (target.closest(".map-group-head, .map-group-bar")) {
      const id = target.closest("[data-group]").dataset.group;
      pointed = { kind: "group", name: id, selector: `[data-group="${CSS.escape(id)}"] .map-group-head`, items: MOVE4 };
    } else if (target.closest(".map-participant")) {
      const id = target.closest(".map-participant").dataset.participant;
      pointed = {
        kind: "node",
        name: id,
        selector: `.map-participant[data-participant="${CSS.escape(id)}"]`,
        items: MOVE4.slice(2),
      };
    } else if (target.closest("[data-node]")) {
      const id = target.closest("[data-node]").dataset.node;
      pointed = { kind: "node", name: id, selector: `.mdmark-diagram-node[data-node="${CSS.escape(id)}"]`, items: MOVE4 };
    } else {
      pointed = null;
      button.hidden = true;
      return;
    }
    button.setAttribute("aria-label", `「${pointed.name}」を移動`);
    button.title = "移動";
    relocate();
  };
  onSingleClick(host, pointAt);
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.target.closest(".mock820-menu")) {
      pointed = null;
      button.hidden = true;
    }
  });
  button.addEventListener("click", () => {
    if (!pointed) return;
    const current = pointed;
    openMenu(host, () => button, `「${current.name}」の移動`, current.items.map(([label, icon, key]) => ({
      label,
      icon,
      run: () => sendKey(host.querySelector(current.selector), key, true),
    })));
  });
}

/**
 * コードブロックとファイルツリーの帯の、コピーのボタンの前に折り返しのトグルボタンを置く。
 * 描いた直後の状態は wrap の有り無しに合わせる
 */
export function attachWrapToggle(host, { tree = true } = {}) {
  for (const bar of host.querySelectorAll(".mdmark-code-bar")) {
    if (bar.querySelector(".mock820-wrap-toggle")) continue;
    const block = bar.closest(".mdmark-code, .mdmark-tree");
    const isTree = block?.classList.contains("mdmark-tree");
    if (!block || (isTree && !tree)) continue;
    const target = isTree ? block : block.querySelector("pre");
    const wrapClass = isTree ? "mdmark-tree-wrap" : "mdmark-code-wrap";
    const isOn = () => target.classList.contains(wrapClass) || target.classList.contains("mock820-wrap");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mock820-wrap-toggle";
    toggle.innerHTML = `${svg("wrap")}<span>折り返し</span>`;
    toggle.setAttribute("aria-label", isTree ? "ツリーを折り返す" : "コードを折り返す");
    toggle.title = "画面の端で折り返す";
    const sync = () => toggle.setAttribute("aria-pressed", String(isOn()));
    toggle.addEventListener("click", () => {
      if (isOn()) target.classList.remove(wrapClass, "mock820-wrap");
      else target.classList.add(isTree ? wrapClass : "mock820-wrap");
      sync();
    });
    sync();
    const meta = bar.querySelector(".mdmark-code-meta");
    if (meta) meta.prepend(toggle);
    else {
      const holder = document.createElement("span");
      holder.className = "mdmark-code-meta";
      holder.append(toggle);
      bar.append(holder);
    }
  }
}

/**
 * ライトボックスの上のバーに、拡大中（画像の場所より大きいとき）だけ移動のボタンを出し、
 * ボタンで開くメニューの項目で画像の場所へ矢印キーを送る
 */
export function attachLightboxMove(root = document) {
  const decorate = (dialog) => {
    const tools = dialog.querySelector(".mdmark-lightbox-tools");
    const stage = dialog.querySelector(".mdmark-lightbox-stage");
    if (!tools || !stage || tools.querySelector(".mock820-lightbox-move")) return;
    const group = document.createElement("span");
    group.className = "mdmark-lightbox-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mdmark-lightbox-tool mock820-lightbox-move";
    button.setAttribute("aria-label", "拡大した画像を移動");
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.title = "移動";
    button.innerHTML = svg("move");
    group.append(button);
    tools.prepend(group);
    const zoomed = () => stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1;
    const sync = () => {
      group.hidden = !zoomed();
    };
    new ResizeObserver(sync).observe(stage.querySelector(".mdmark-lightbox-sizer") ?? stage);
    new MutationObserver(sync).observe(stage, { subtree: true, attributes: true });
    sync();
    dialog.classList.add("mock820-layer");
    button.addEventListener("click", () => {
      openMenu(dialog, () => button, "拡大した画像の移動", MOVE4.map(([label, icon, key]) => ({
        label,
        icon,
        run: () => sendKey(stage, key, false),
      })));
    });
    // メニューが開いている間の Esc は、メニューだけを閉じる
    dialog.addEventListener(
      "keydown",
      (event) => {
        const menu = dialog.querySelector(".mock820-menu");
        if (event.key === "Escape" && menu) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu(menu, true);
        }
      },
      true,
    );
    dialog.addEventListener("cancel", (event) => {
      if (dialog.querySelector(".mock820-menu")) event.preventDefault();
    });
  };
  new MutationObserver(() => root.querySelectorAll("dialog.mdmark-lightbox").forEach(decorate)).observe(
    root.body ?? root,
    { childList: true, subtree: true },
  );
  root.querySelectorAll("dialog.mdmark-lightbox").forEach(decorate);
}

/**
 * 音声の再生バーが、図とその祖先の overflow で切られているかを測って out に書く。
 * 1 行 = 1 つの audio
 */
export function measureAudio(host, out) {
  const rows = [];
  for (const audio of host.querySelectorAll("audio")) {
    const box = audio.getBoundingClientRect();
    let visibleBottom = box.bottom;
    let clipper = "なし";
    for (let node = audio.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowY !== "visible" || style.overflowX !== "visible") {
        const limit = node.getBoundingClientRect().bottom;
        if (limit < visibleBottom) {
          visibleBottom = limit;
          clipper = `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}`;
        }
      }
    }
    const cut = Math.max(0, Math.round(box.bottom - visibleBottom));
    rows.push(`<tr><td>${audio.closest("figure")?.querySelector("figcaption")?.textContent || "（キャプションなし）"}</td><td>${Math.round(box.height)}px</td><td>${cut}px</td><td>${clipper}</td></tr>`);
  }
  out.innerHTML = `<table class="mock820-measure"><thead><tr><th>音声</th><th>描いた高さ</th><th>切られた高さ</th><th>切っている要素</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
