import { escapeHtml } from "./escape.logic.ts";
import { type IconName, iconSvg } from "./icons.part.ts";

/** メニューの 1 つのボタンの文言・アイコン・押せるか・押したときの処理 */
export type StepMenuItem = {
  /** ボタンの文言（`上へ移す`・`高くする` など） */
  label: string;
  /** 文言の前に出すアイコン */
  icon: IconName;
  /** 押せるか。開いたときと項目を押した後に呼ぶ */
  enabled: () => boolean;
  /** 押したときの処理 */
  run: () => void;
};

/** 開いたメニューを置き直す・閉じる関数 */
export type StepMenuHandle = {
  /** 項目の `disabled` を求め直し、開いた元の要素の今の位置に置き直す */
  refresh: () => void;
  /** メニューを閉じて削除し、`restoreFocus` が `true` なら開いた元の要素へフォーカスを戻す */
  close: (options: { restoreFocus: boolean }) => void;
};

/** メニューを置く側 */
export type StepMenuSide = "below" | "above" | "right" | "left";

/** 既定の試す側の順 */
const DEFAULT_SIDES: ReadonlyArray<StepMenuSide> = [
  "below",
  "above",
  "right",
  "left",
];

/** 矩形の左上と大きさ */
type Box = { x: number; y: number; width: number; height: number };

/** 2 つの矩形が重なるか（辺が接するだけなら重ならない） */
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/** 画面に収まるか */
const fitsIn = (box: Box, viewport: { width: number; height: number }) =>
  box.x >= 0 &&
  box.y >= 0 &&
  box.x + box.width <= viewport.width &&
  box.y + box.height <= viewport.height;

/** 側ごとのメニューの左上の座標 */
const candidateOf = (options: {
  side: StepMenuSide;
  anchor: DOMRect;
  size: { width: number; height: number };
  align: "start" | "center";
}): { x: number; y: number } => {
  const { side, anchor, size, align } = options;
  const x =
    align === "center"
      ? anchor.x + anchor.width / 2 - size.width / 2
      : anchor.x;
  switch (side) {
    case "below":
      return { x, y: anchor.y + anchor.height };
    case "above":
      return { x, y: anchor.y - size.height };
    case "right":
      return { x: anchor.x + anchor.width, y: anchor.y };
    case "left":
      return { x: anchor.x - size.width, y: anchor.y };
    default: {
      const never: never = side;
      return never;
    }
  }
};

/** 開いた元の要素の周りの候補の側のうち、画面に収まり避ける矩形と重ならない最初の側の座標を返す */
export const placeStepMenu = (options: {
  /** 開いた元の要素の矩形 */
  anchor: DOMRect;
  /** メニューの大きさ */
  size: { width: number; height: number };
  /** 重ねない矩形 */
  avoid: DOMRect[];
  /** 画面の大きさ */
  viewport: { width: number; height: number };
  /** 試す側の順 */
  sides: ReadonlyArray<StepMenuSide>;
  /** 上下の候補の合わせ方。既定は `start` */
  align?: "start" | "center";
}): { x: number; y: number; side: StepMenuSide } => {
  const { anchor, size, avoid, viewport, sides, align = "start" } = options;
  const candidates = sides.map((side) => ({
    side,
    ...candidateOf({ side, anchor, size, align }),
  }));
  const boxOf = (candidate: { x: number; y: number }): Box => ({
    ...candidate,
    ...size,
  });
  const free = candidates.find(
    (candidate) =>
      fitsIn(boxOf(candidate), viewport) &&
      !avoid.some((rect) => overlaps(boxOf(candidate), rect)),
  );
  if (free) {
    return free;
  }
  const fitting = candidates.find((candidate) =>
    fitsIn(boxOf(candidate), viewport),
  );
  if (fitting) {
    return fitting;
  }
  const first = candidates[0] ?? { side: "below" as const, x: 0, y: 0 };
  return {
    side: first.side,
    x: Math.min(Math.max(first.x, 0), Math.max(viewport.width - size.width, 0)),
    y: Math.min(
      Math.max(first.y, 0),
      Math.max(viewport.height - size.height, 0),
    ),
  };
};

/** 開いた元の要素のそばに popover の `role="group"` のメニューを開き、項目を押しても開いたままにする */
export const openStepMenu = (options: {
  /** 開いた元のボタン・ハンドル */
  opener: HTMLElement;
  /** メニューの `aria-label` */
  label: string;
  /** 並べる項目 */
  items: StepMenuItem[];
  /** メニューを重ねない矩形。`opener` の矩形は常に含める */
  avoid?: () => DOMRect[];
  /** 試す側の順 */
  sides?: ReadonlyArray<StepMenuSide>;
  /** 上下の候補の合わせ方 */
  align?: "start" | "center";
  /** Esc で閉じたときにフォーカスを戻す要素。既定は `anchor` の要素 */
  focusBack?: HTMLElement;
  /** 配置の基準にする今の要素（再描画で `opener` が置き換わるとき）。既定は `opener` */
  anchor?: () => HTMLElement | null;
  /** メニューを入れる要素。既定は `opener` の直後 */
  container?: HTMLElement;
  /** Esc・メニューの外の押下・`close` のどれで閉じたときも呼ぶ */
  onClose?: () => void;
}): StepMenuHandle => {
  const {
    opener,
    label,
    items,
    avoid = () => [],
    sides = DEFAULT_SIDES,
    align = "start",
    anchor = () => opener,
    container,
  } = options;
  const menu = document.createElement("div");
  menu.className = "mdmark-step-menu";
  menu.popover = "auto";
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", label);
  const buttons = items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${iconSvg(item.icon)}${escapeHtml(item.label)}`;
    menu.append(button);
    return button;
  });
  if (container) {
    container.append(menu);
  } else {
    opener.after(menu);
  }
  const controller = new AbortController();
  const { signal } = controller;
  let closed = false;

  const updateDisabled = (): void => {
    items.forEach((item, index) => {
      const button = buttons[index];
      if (button) {
        button.disabled = !item.enabled();
      }
    });
  };
  const place = (): void => {
    const anchorRect = (anchor() ?? opener).getBoundingClientRect();
    const rect = menu.getBoundingClientRect();
    const placed = placeStepMenu({
      anchor: anchorRect,
      size: { width: rect.width, height: rect.height },
      avoid: [anchorRect, ...avoid()],
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      sides,
      align,
    });
    menu.style.left = `${placed.x}px`;
    menu.style.top = `${placed.y}px`;
    menu.dataset.side = placed.side;
  };
  const enabledButtons = (): HTMLButtonElement[] =>
    buttons.filter((button) => !button.disabled);
  /** フォーカスのある項目が押せなくなったら、次の押せる項目（無ければ前の押せる項目）へ移す */
  const keepFocus = (index: number): void => {
    const current = buttons[index];
    if (!current?.disabled) {
      return;
    }
    const next =
      buttons.slice(index + 1).find((button) => !button.disabled) ??
      buttons
        .slice(0, index)
        .reverse()
        .find((button) => !button.disabled);
    next?.focus({ preventScroll: true });
  };
  const refresh = (): void => {
    if (closed) {
      return;
    }
    const focused = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    updateDisabled();
    place();
    if (focused >= 0) {
      keepFocus(focused);
    }
  };
  const close = (closeOptions: { restoreFocus: boolean }): void => {
    if (closed) {
      return;
    }
    closed = true;
    controller.abort();
    if (menu.matches(":popover-open")) {
      menu.hidePopover();
    }
    menu.remove();
    opener.setAttribute("aria-expanded", "false");
    options.onClose?.();
    if (closeOptions.restoreFocus) {
      (options.focusBack ?? anchor() ?? opener).focus({ preventScroll: true });
    }
  };

  menu.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest("button");
      const index = button ? buttons.indexOf(button) : -1;
      const item = items[index];
      if (!item || button?.disabled) {
        return;
      }
      button?.focus({ preventScroll: true });
      item.run();
      refresh();
    },
    { signal },
  );
  menu.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: true });
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const enabled = enabledButtons();
      const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next =
        enabled[(at + step + enabled.length) % Math.max(enabled.length, 1)];
      next?.focus({ preventScroll: true });
    },
    { signal },
  );
  // メニューの外を押して閉じたとき（light dismiss）はフォーカスを動かさない
  menu.addEventListener(
    "toggle",
    (event) => {
      if ((event as ToggleEvent).newState === "closed") {
        close({ restoreFocus: false });
      }
    },
    { signal },
  );
  window.addEventListener("scroll", place, { signal, passive: true });
  window.addEventListener("resize", place, { signal });

  updateDisabled();
  menu.showPopover();
  opener.setAttribute("aria-expanded", "true");
  place();
  enabledButtons()[0]?.focus({ preventScroll: true });
  return { refresh, close };
};
