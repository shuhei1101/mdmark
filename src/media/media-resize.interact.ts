import { iconSvg } from "../shared/icons.part.ts";
import {
  readStoredSize,
  storedSizeKey,
  writeStoredSize,
} from "../shared/stored-size.logic.ts";
import { fileNameOf } from "./media.part.ts";

/** リサイズハンドルで変えた幅を sessionStorage に記載するキーの頭 */
export const MEDIA_WIDTH_KEY_PREFIX = "mdmark-media-width:";

/** 1 回の `↑`・`↓` とメニューのボタンで変える高さ・幅の下限・ドラッグにする動きの下限（px） */
export const MEDIA_RESIZE = { step: 32, minWidth: 160, dragThreshold: 4 };

// ドラッグの間にハンドルに付ける class
const RESIZING_CLASS = "is-resizing";
// メニューを開いている間にハンドルに付ける class
const OPEN_CLASS = "is-open";
// 動画の図の幅の CSS 変数
const WIDTH_PROPERTY = "--mdmark-image-width";
// メニューとハンドルの間（px）
const MENU_GAP = 4;
// メニューを画面の左端から離す幅（px）
const MENU_MARGIN = 8;

// 上下キーと、高さを変える向き
const KEY_STEPS: Record<string, number> = {
  ArrowUp: -MEDIA_RESIZE.step,
  ArrowDown: MEDIA_RESIZE.step,
};

/** 幅を下限以上、本文の幅以下の整数にする（本文の幅が下限より狭いときは本文の幅） */
export const clampMediaWidth = (options: {
  width: number;
  maxWidth: number;
}): number =>
  Math.round(
    Math.min(options.maxWidth, Math.max(MEDIA_RESIZE.minWidth, options.width)),
  );

/** 同じページの同じ順の同じ動画だけが同じ幅を読み込む、sessionStorage のキー */
export const mediaWidthKey = (options: {
  pathname: string;
  index: number;
  src: string;
}): string =>
  storedSizeKey({
    prefix: MEDIA_WIDTH_KEY_PREFIX,
    pathname: options.pathname,
    index: options.index,
    name: options.src,
  });

/** 動画の縦横の比（高さ ÷ 幅）。読み込んでいないときは描いた大きさから求める */
const ratioOf = (video: HTMLVideoElement): number => {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return video.videoHeight / video.videoWidth;
  }
  const rect = video.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 1;
};

/** リサイズハンドルと大きさのメニューで、縦横の比を保って動画の幅を変える操作を付ける。付けたときに保った幅を当て、その幅と操作を削除する関数を返却する */
export const attachMediaResize = (options: {
  /** 動画の図 */
  figure: HTMLElement;
  /** 動画 */
  video: HTMLVideoElement;
  /** リサイズハンドル */
  handle: HTMLButtonElement;
  /** 大きさのメニュー */
  menu: HTMLElement;
  /** 幅を保つキー（`mediaWidthKey`） */
  key: string;
  /** 幅を保つ先（sessionStorage。使用できないときは `null`） */
  storage: Storage | null;
  /** 本文の幅を返却する */
  maxWidth: () => number;
}): { restored: number | null; detach: () => void } => {
  const { figure, video, handle, menu, key, storage, maxWidth } = options;
  const controller = new AbortController();
  const { signal } = controller;
  // render が付けた幅（無ければ空）。戻すときにこの値にする
  const original = figure.style.getPropertyValue(WIDTH_PROPERTY);
  const currentWidth = (): number => video.getBoundingClientRect().width;
  const buttonOf = (size: string): HTMLButtonElement | null =>
    menu.querySelector<HTMLButtonElement>(`[data-size="${size}"]`);
  const isOpen = (): boolean => menu.matches(":popover-open");

  /** メニューのボタンを、下限・上限・元の大きさのときは押せなくする */
  const updateMenu = (): void => {
    const width = currentWidth();
    const smaller = buttonOf("smaller");
    const larger = buttonOf("larger");
    const reset = buttonOf("reset");
    if (smaller) {
      smaller.disabled = width <= MEDIA_RESIZE.minWidth + 0.5;
    }
    if (larger) {
      larger.disabled = width >= maxWidth() - 0.5;
    }
    if (reset) {
      reset.disabled = readStoredSize(storage, key) === null;
    }
  };

  /** 開いているメニューを、ハンドルの下に右端を合わせて配置する（下に入らなければ上） */
  const placeMenu = (): void => {
    if (!isOpen()) {
      return;
    }
    const rect = handle.getBoundingClientRect();
    const below = rect.bottom + MENU_GAP;
    const top =
      below + menu.offsetHeight > window.innerHeight
        ? rect.top - MENU_GAP - menu.offsetHeight
        : below;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(MENU_MARGIN, rect.right - menu.offsetWidth)}px`;
  };

  /** 幅を範囲に収めて当て、保つ */
  const setWidth = (width: number): void => {
    const next = clampMediaWidth({ width, maxWidth: maxWidth() });
    figure.style.setProperty(WIDTH_PROPERTY, `${next}px`);
    writeStoredSize(storage, key, next);
    updateMenu();
    placeMenu();
  };

  /** 記載した幅に戻し、保った幅を削除する */
  const reset = (): void => {
    if (original === "") {
      figure.style.removeProperty(WIDTH_PROPERTY);
    } else {
      figure.style.setProperty(WIDTH_PROPERTY, original);
    }
    writeStoredSize(storage, key, null);
    updateMenu();
    placeMenu();
  };

  /** 高さを `step` px 分だけ変える幅を加える */
  const stepWidth = (step: number): void => {
    setWidth(currentWidth() + step / ratioOf(video));
  };

  // ドラッグ: 横の動きと「縦の動き ÷ 縦横の比」の大きい方を、押したときの幅に加える
  let drag:
    | { x: number; y: number; width: number; id: number; moved: boolean }
    | undefined;
  let dragged = false;
  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) {
        return;
      }
      // 文字の選択を止めるため既定の動作を止めるので、ハンドルへフォーカスを移して上下キーを受け取る
      event.preventDefault();
      handle.focus();
      handle.setPointerCapture(event.pointerId);
      dragged = false;
      drag = {
        x: event.clientX,
        y: event.clientY,
        width: currentWidth(),
        id: event.pointerId,
        moved: false,
      };
    },
    { signal },
  );
  handle.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = (event.clientY - drag.y) / ratioOf(video);
      if (
        !drag.moved &&
        Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <
          MEDIA_RESIZE.dragThreshold
      ) {
        return;
      }
      drag.moved = true;
      dragged = true;
      handle.classList.add(RESIZING_CLASS);
      setWidth(drag.width + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
    },
    { signal },
  );
  const endDrag = (): void => {
    drag = undefined;
    handle.classList.remove(RESIZING_CLASS);
  };
  handle.addEventListener("pointerup", endDrag, { signal });
  handle.addEventListener("pointercancel", endDrag, { signal });

  // ドラッグした後の click: メニューを開閉しない
  handle.addEventListener(
    "click",
    (event) => {
      if (!dragged) {
        return;
      }
      dragged = false;
      event.preventDefault();
    },
    { signal },
  );

  // 上下キー: 高さを `MEDIA_RESIZE.step` 分ずつ変える
  handle.addEventListener(
    "keydown",
    (event) => {
      const step = KEY_STEPS[event.key];
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      stepWidth(step);
    },
    { signal },
  );

  // ダブルクリック: 記載した幅に戻し、開いたメニューを閉じる
  handle.addEventListener(
    "dblclick",
    () => {
      reset();
      if (isOpen()) {
        menu.hidePopover();
      }
    },
    { signal },
  );

  // メニュー: toggle のイベントは開いた後に届くため、配置するまで隠し、ブラウザの既定の位置でハンドルへの次の押下を受けないようにする
  menu.addEventListener(
    "beforetoggle",
    (event) => {
      if ((event as ToggleEvent).newState === "open") {
        menu.style.visibility = "hidden";
      }
    },
    { signal },
  );
  // メニュー: 開いたらボタンの押せる・押せないを合わせ、配置して最初の押せるボタンへフォーカスし、閉じたらハンドルへ戻す
  menu.addEventListener(
    "toggle",
    (event) => {
      const open = (event as ToggleEvent).newState === "open";
      handle.classList.toggle(OPEN_CLASS, open);
      if (open) {
        updateMenu();
        placeMenu();
        menu.style.removeProperty("visibility");
        menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
        return;
      }
      if (menu.contains(document.activeElement)) {
        handle.focus();
      }
    },
    { signal },
  );
  menu.addEventListener(
    "click",
    (event) => {
      const button = (
        event.target as Element | null
      )?.closest<HTMLButtonElement>("button[data-size]");
      if (!button) {
        return;
      }
      if (button.dataset.size === "smaller") {
        stepWidth(-MEDIA_RESIZE.step);
      } else if (button.dataset.size === "larger") {
        stepWidth(MEDIA_RESIZE.step);
      } else {
        reset();
      }
      if (button.disabled) {
        menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      }
    },
    { signal },
  );
  window.addEventListener("scroll", placeMenu, { signal, passive: true });
  window.addEventListener("resize", placeMenu, { signal });

  // 保った幅は、操作で変えるときと同じく範囲に収めて適用する
  const kept = readStoredSize(storage, key);
  const restored =
    kept === null
      ? null
      : clampMediaWidth({ width: kept, maxWidth: maxWidth() });
  if (restored !== null) {
    figure.style.setProperty(WIDTH_PROPERTY, `${restored}px`);
  }
  return { restored, detach: () => controller.abort() };
};

/** 大きさのメニューの HTML（3 つのボタン） */
const MENU_HTML = [
  `<button type="button" data-size="smaller">${iconSvg("minus")}小さくする</button>`,
  `<button type="button" data-size="larger">${iconSvg("plus")}大きくする</button>`,
  `<button type="button" data-size="reset">${iconSvg("rotate-ccw")}元の大きさに戻す</button>`,
].join("");

/** `root` の中の再生バーを持つ動画ごとに、入れ物・リサイズハンドル・大きさのメニューを配置して操作を付け、配置した要素と操作を削除する関数を返却する */
export const attachMediaResizes = (options: {
  /** 描いた文書の根 */
  root: HTMLElement;
  /** 幅を保つ先（sessionStorage。使用できないときは `null`） */
  storage: Storage | null;
}): (() => void) => {
  const { root, storage } = options;
  const cleanups: Array<() => void> = [];
  const videos = root.querySelectorAll<HTMLVideoElement>(
    "figure.mdmark-media > video",
  );
  videos.forEach((video, index) => {
    const figure = video.parentElement;
    if (!figure) {
      return;
    }
    const src = video.getAttribute("src") ?? "";
    const alt = video.getAttribute("aria-label") ?? "";
    const label = alt === "" ? fileNameOf(src) : alt;
    const frame = document.createElement("div");
    frame.className = "mdmark-media-frame";
    video.before(frame);
    frame.append(video);
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "mdmark-media-resize";
    handle.setAttribute("aria-label", `「${label}」の大きさを変える`);
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    frame.append(handle);
    const menu = document.createElement("div");
    menu.className = "mdmark-media-size-menu";
    menu.popover = "auto";
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", `「${label}」の大きさ`);
    menu.innerHTML = MENU_HTML;
    figure.after(menu);
    handle.popoverTargetElement = menu;
    handle.popoverTargetAction = "toggle";
    const { detach } = attachMediaResize({
      figure,
      video,
      handle,
      menu,
      key: mediaWidthKey({ pathname: location.pathname, index, src }),
      storage,
      maxWidth: () => figure.parentElement?.clientWidth ?? figure.clientWidth,
    });
    cleanups.push(() => {
      detach();
      if (menu.matches(":popover-open")) {
        menu.hidePopover();
      }
      menu.remove();
      frame.before(video);
      frame.remove();
    });
  });
  return () => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  };
};
