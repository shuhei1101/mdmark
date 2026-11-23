import type { TooltipPlacement } from "../config.ts";
import { iconSvg } from "../shared/icons.part.ts";
import {
  findScrollContainer,
  type ScrollContainer,
} from "../shared/scroller.interact.ts";
import { readStickyTop } from "../shared/sticky-top.ts";
import { attachZoom } from "../shared/zoom.interact.ts";
import { PANEL_CLOSE_LABEL, PANEL_OPEN_LABEL } from "./diagram.part.ts";
import {
  attachDiagramResize,
  diagramHeightKey,
} from "./diagram-resize.interact.ts";
import { attachDiagramTips } from "./diagram-tips.interact.ts";
import { ZOOM } from "./geometry.ts";

export { ZOOM };

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// 文字を選べる所（ここではドラッグを始めない）
const TEXT_SELECTOR =
  ".mdmark-diagram-node-kind, .mdmark-diagram-node-name, .mdmark-diagram-node-sub, .mdmark-diagram-label, .mdmark-diagram-axis-text, .mdmark-diagram-value-text, .mdmark-term, .mdmark-mermaid svg text, .mdmark-mermaid svg tspan, .mdmark-mermaid svg foreignObject *";

// 操作を付けた回数の通し番号。`id` を重ならせないために使用する
let attachCounter = 0;

/** 図の中身を再描画したときに `figure` へ送信するイベント（ツールチップをもう一度付ける） */
export const DIAGRAM_REDRAW_EVENT = "mdmark-diagram-redraw";

/** 高さを保つ先（sessionStorage）。使用できない環境では `null` */
const defaultStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** 図の `id` の頭 `from` を `to` にもう一度振り、それを指す属性も合わせて修正する */
export function renumberIds(
  scope: HTMLElement,
  from: string,
  to: string,
): void {
  if (from === "") {
    return;
  }
  const head = `${from}-`;
  const swap = (value: string): string =>
    value.startsWith(head) ? `${to}-${value.slice(head.length)}` : value;
  for (const element of scope.querySelectorAll("[id]")) {
    element.id = swap(element.id);
  }
  if (scope.id) {
    scope.id = swap(scope.id);
  }
  for (const name of [
    "aria-describedby",
    "aria-labelledby",
    "aria-controls",
    "for",
  ]) {
    for (const element of [scope, ...scope.querySelectorAll(`[${name}]`)]) {
      const value = element.getAttribute(name);
      if (value !== null) {
        element.setAttribute(name, value.split(/\s+/).map(swap).join(" "));
      }
    }
  }
  // 矢じり（線の端の記号を含む）と塗りの模様の参照
  for (const name of ["marker-start", "marker-end", "fill"]) {
    for (const element of scope.querySelectorAll(`[${name}]`)) {
      const value = element.getAttribute(name) ?? "";
      element.setAttribute(name, value.replace(`url(#${head}`, `url(#${to}-`));
    }
  }
}

/** 参加者の行を文書のスクロールでも留める図の、表示する枠をスクロールさせる場所（全画面のモーダルと、参加者の行の無い図は `undefined`） */
function headsScroller(
  figure: HTMLElement,
  options: { modal: boolean; heads: HTMLElement | null },
): ScrollContainer | undefined {
  if (options.modal || !options.heads) return undefined;
  return findScrollContainer(figure);
}

/** スクロールする場所の `scroll` を受け取る */
function listenScroller(
  scroller: ScrollContainer | undefined,
  listener: () => void,
  signal: AbortSignal,
): void {
  if (!scroller) return;
  (scroller.page ? window : scroller.target).addEventListener(
    "scroll",
    listener,
    { passive: true, signal },
  );
}

/** シーケンス図の参加者の行を表示する枠の上端から下げる幅（px）。表示する枠の中を縦に動かした分と、文書のスクロールで表示する枠の上端が留める位置より上へ出た分の大きいほうで、表示する枠の下端より下へは出さない */
function headsOffset(target: {
  viewport: HTMLElement;
  heads: HTMLElement;
  scroller: ScrollContainer | undefined;
  scale: number;
  /** `--mdmark-sticky-top` の px */
  stickyTop: number;
}): number {
  const { viewport, heads, scroller, scale, stickyTop } = target;
  if (!scroller) return viewport.scrollTop;
  const top = scroller.page ? 0 : scroller.target.getBoundingClientRect().top;
  const page = top + stickyTop - viewport.getBoundingClientRect().top;
  const limit =
    viewport.clientHeight - heads.clientHeight * scale + viewport.scrollTop;
  return Math.max(
    viewport.scrollTop,
    Math.min(viewport.scrollTop + page, limit),
  );
}

/** シーケンス図の参加者の行を留める位置（`--mdmark-sticky-top` の px）を、付けたときと画面の大きさが変わったときだけ求めて返却する関数。参加者の行を持たない図では 0 */
function trackStickyTop(options: {
  figure: HTMLElement;
  enabled: boolean;
  onResize: () => void;
  signal: AbortSignal;
}): () => number {
  const { figure, enabled, onResize, signal } = options;
  if (!enabled) return () => 0;
  let value = readStickyTop(figure);
  window.addEventListener(
    "resize",
    () => {
      value = readStickyTop(figure);
      onResize();
    },
    { passive: true, signal },
  );
  return () => value;
}

/** 開閉のボタン: 押すたびにパネルを開閉し、開閉のボタンの状態とスクリーンリーダー向けの名前を合わせる */
function attachPanelToggle(figure: HTMLElement, signal: AbortSignal): void {
  const panel = figure.querySelector<HTMLElement>(".mdmark-diagram-tools");
  const more = figure.querySelector<HTMLButtonElement>('[data-tool="more"]');
  more?.addEventListener(
    "click",
    () => {
      const open = !panel?.hasAttribute("data-open");
      panel?.toggleAttribute("data-open", open);
      more.setAttribute("aria-expanded", String(open));
      more.setAttribute(
        "aria-label",
        open ? PANEL_CLOSE_LABEL : PANEL_OPEN_LABEL,
      );
    },
    { signal },
  );
}

/** 図 1 つの倍率と位置の操作（右上のボタン・キー・ドラッグ・リサイズハンドル）と、グループのタイトルを上端に留める処理を付け、操作と監視を解除する関数を返却する */
function attachView(
  figure: HTMLElement,
  options: {
    modal: boolean;
    /** ドラッグで動かし始めたときに呼ぶ（開いているツールチップを閉じる） */
    onPanStart?: () => void;
    /** リサイズハンドルで変えた高さを保つキーと保つ先 */
    resize?: { key: string; storage: Storage | null };
  },
): () => void {
  const { modal, onPanStart, resize } = options;
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );
  const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const heads = figure.querySelector<HTMLElement>(".mdmark-diagram-seq-heads");
  const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
  if (!viewport || !stage || !box) {
    return () => {};
  }
  const content = {
    width: Number.parseFloat(stage.style.width),
    height: Number.parseFloat(stage.style.height),
  };
  let scale = 1;
  // リサイズハンドルで変えた高さ（変えていなければ `null`）
  let userHeight: number | null = null;
  /** シーケンス図の相手の名前の行を、表示する枠の上端に留める（図の座標で縦に動いた分だけ下げる） */
  const scroller = headsScroller(figure, { modal, heads });
  // 留める位置は付けたときと画面の大きさが変わったときだけ求め、スクロールでは保持した値を使用する
  let stickyTop = (): number => 0;
  const stickHeads = (): void => {
    if (!heads) {
      return;
    }
    const offset = headsOffset({
      viewport,
      heads,
      scroller,
      scale,
      stickyTop: stickyTop(),
    });
    heads.style.transform = `translateY(${Math.round(offset) / scale}px)`;
    heads.classList.toggle("is-stuck", offset > 0);
  };

  /** 倍率が変わったとき: 文書の中では表示する枠の高さを合わせ、相手の名前の行をもう一度留める */
  const onChange = (zoom: number, fit: number): void => {
    scale = zoom;
    if (!modal) {
      // 全体が収まる倍率では、高さを全体が収まる高さと `--mdmark-diagram-max-height` の小さいほうにする
      if (Math.abs(zoom - fit) < ZOOM_EPSILON && userHeight === null) {
        viewport.style.maxHeight = "";
        const cap = Number.parseFloat(getComputedStyle(viewport).maxHeight);
        const height = content.height * fit;
        viewport.style.height = `${Number.isNaN(cap) ? height : Math.min(height, cap)}px`;
      }
      // 利用側が高さを変えたときに図の全体が収まる高さまで広げられるよう、上限を今の倍率の図の高さにする（map の図は上限を持たず、ドラッグした分だけ広げる）
      viewport.style.maxHeight =
        figure.dataset.diagram === "map"
          ? "none"
          : `${content.height * zoom}px`;
    }
    stickHeads();
  };

  const controller = new AbortController();
  viewport.addEventListener("scroll", stickHeads, {
    passive: true,
    signal: controller.signal,
  });
  listenScroller(scroller, stickHeads, controller.signal);
  stickyTop = trackStickyTop({
    figure,
    enabled: heads !== null,
    onResize: stickHeads,
    signal: controller.signal,
  });

  const zoom = attachZoom({
    viewport,
    content: stage,
    size: content,
    tools: figure,
    onChange,
    ...(onPanStart ? { onPanStart } : {}),
    // 文書の中は幅だけで決め、リサイズハンドルで高さを変えた後は高さでも決める
    fitHeight: () => modal || userHeight !== null,
    dragIgnore: TEXT_SELECTOR,
    dragOwner: "[data-drag-owner]",
    keyTargets: [box],
    percentBase: "fit",
    touchPan: "native",
    wheelToScroller: true,
    ...(figure.dataset.fitMin === undefined
      ? {}
      : { fitMin: Number(figure.dataset.fitMin) }),
  });

  const handle = figure.querySelector<HTMLElement>(".mdmark-diagram-resize");
  let detachResize = (): void => {};
  if (!modal && handle && resize) {
    const attached = attachDiagramResize({
      viewport,
      handle,
      key: resize.key,
      storage: resize.storage,
      fit: () =>
        content.height * scale +
        (viewport.offsetHeight - viewport.clientHeight),
      onResize: (height) => {
        userHeight = height;
        zoom.refit();
      },
    });
    detachResize = attached.detach;
    if (attached.restored !== null) {
      // 保った高さで開く: その高さで全体が収まる倍率にする
      userHeight = attached.restored;
      zoom.reset();
    }
  }

  attachPanelToggle(figure, controller.signal);

  return () => {
    detachResize();
    zoom.detach();
    controller.abort();
  };
}

/** 全画面の枠にコピーした図を、モーダルの図にする: 開いている状態を削除し、`id` をコピーと重ならない値にし、全画面のボタンを閉じるボタンにする */
function prepareModalFigure(figure: HTMLElement): HTMLElement {
  const copy = figure.cloneNode(true) as HTMLElement;
  // 全画面の中では高さを変えない
  copy.querySelector(".mdmark-diagram-resize")?.remove();
  const title = copy.querySelector(".mdmark-diagram-head")?.id ?? "";
  const from = title.replace(/-title$/, "");
  renumberIds(copy, from, `${from}-modal`);
  for (const tip of copy.querySelectorAll<HTMLElement>(".mdmark-diagram-tip")) {
    tip.hidden = true;
    tip.style.left = "";
    tip.style.top = "";
  }
  for (const wire of copy.querySelectorAll(".mdmark-diagram-wire.is-active")) {
    wire.classList.remove("is-active");
  }
  const viewport = copy.querySelector<HTMLElement>(".mdmark-diagram-viewport");
  if (viewport) {
    viewport.style.height = "";
    viewport.style.maxHeight = "";
  }
  const opener = copy.querySelector<HTMLButtonElement>(
    '[data-tool="fullscreen"]',
  );
  if (opener) {
    opener.dataset.tool = "close";
    opener.setAttribute("aria-label", "全画面を閉じる");
    opener.innerHTML = iconSvg("x");
  }
  return copy;
}

/** 全画面のモーダルに複製した図（modal）に、元の図（source）の部品の操作を付け直し、解除する関数を返す */
export type AttachModal = (
  modal: HTMLElement,
  source: HTMLElement,
) => () => void;

/** 図を全画面のモーダルで開き、開いた全画面を閉じる関数を返却する。閉じるボタンか Esc で閉じたら、付けた操作と監視を解除して `dialog` を削除し、フォーカスを全画面のボタンへ戻す */
export function openDiagramDialog(options: {
  /** 開く図 */
  figure: HTMLElement;
  /** 全画面のボタン */
  opener: HTMLButtonElement;
  /** モーダルの中のツールチップを先に出す側 */
  placement: TooltipPlacement;
  /** 複製した図に部品の操作を付け直し、解除する関数を返す（map の図） */
  attachModal?: AttachModal | undefined;
}): () => void {
  const { figure, opener, placement } = options;
  const host = figure.closest<HTMLElement>(".mdmark") ?? document.body;
  const dialog = document.createElement("dialog");
  dialog.className = "mdmark-diagram-dialog";
  const modalFigure = prepareModalFigure(figure);
  dialog.append(modalFigure);
  host.append(dialog);
  dialog.showModal();
  let tips = attachDiagramTips({ figure: modalFigure, placement });
  // 部品が中身を描き直したとき（map の図の操作）は、ツールチップをもう一度付ける
  const onRedraw = (): void => {
    tips.detach();
    tips = attachDiagramTips({ figure: modalFigure, placement });
  };
  modalFigure.addEventListener(DIAGRAM_REDRAW_EVENT, onRedraw);
  const detachView = attachView(modalFigure, {
    modal: true,
    onPanStart: () => tips.closeOpen(),
  });
  const detachModal = options.attachModal?.(modalFigure, figure);
  const heading = modalFigure.querySelector(".mdmark-diagram-head");
  if (heading) {
    dialog.setAttribute("aria-labelledby", heading.id);
  }
  const closeButton = modalFigure.querySelector<HTMLButtonElement>(
    '[data-tool="close"]',
  );
  closeButton?.addEventListener("click", () => dialog.close());
  // ツールチップを開いている間の Esc は、ツールチップだけを閉じる（close request を発生させない）
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tips.closeOpen()) {
      event.preventDefault();
    }
  });
  modalFigure.querySelector<HTMLElement>(".mdmark-diagram-viewport")?.focus();
  dialog.addEventListener(
    "close",
    () => {
      modalFigure.removeEventListener(DIAGRAM_REDRAW_EVENT, onRedraw);
      tips.detach();
      detachView();
      detachModal?.();
      dialog.remove();
      opener.focus();
    },
    { once: true },
  );
  return () => {
    if (dialog.open) {
      dialog.close();
    }
  };
}

/** 図の見出しの `id`。無ければ空 */
const titleIdOf = (figure: HTMLElement): string =>
  figure.querySelector(".mdmark-diagram-head")?.id ?? "";

/** 図のタイトルの文字。無ければ空 */
const titleTextOf = (figure: HTMLElement): string =>
  figure.querySelector(".mdmark-diagram-title")?.textContent ?? "";

/** `root` の中の図ごとに、開いたときの倍率を当て、拡大・縮小・移動・全画面のボタンとキー・ドラッグ、ツールチップを付ける。付けた操作と監視を解除し、開いている全画面を閉じる関数を返却する */
export function attachDiagrams(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 図のツールチップを先に出す側（`attachDiagramTips` と `openDiagramDialog` へ指定する） */
  placement: TooltipPlacement;
  /** リサイズハンドルで変えた高さを保つ先（既定は sessionStorage） */
  storage?: Storage | null;
  /** 付ける図（省くと `root` の中の全ての図。高さのキーの通し番号は `root` の中の順） */
  figures?: HTMLElement[];
  /** 全画面のモーダルに複製した図へ部品の操作を付け直す関数（`openDiagramDialog` へ指定する） */
  attachModal?: AttachModal;
}): () => void {
  const { root, placement, storage = defaultStorage() } = options;
  attachCounter += 1;
  const detachers: Array<() => void> = [];
  const figures = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ].filter((figure) => !figure.closest("dialog"));
  const targets = options.figures ? new Set(options.figures) : undefined;
  figures.forEach((figure, index) => {
    if (targets && !targets.has(figure)) {
      return;
    }
    // 同じページに文書を 2 つ以上描いても `id` が重ならないようもう一度振る
    renumberIds(
      figure,
      titleIdOf(figure).replace(/-title$/, ""),
      `mdmark-diagram-${attachCounter}-${index}`,
    );
    let tips = attachDiagramTips({ figure, placement });
    // 中身を再描画したとき（操作できる部品のグラフ）は、ツールチップをもう一度付ける
    const onRedraw = (): void => {
      tips.detach();
      tips = attachDiagramTips({ figure, placement });
    };
    figure.addEventListener(DIAGRAM_REDRAW_EVENT, onRedraw);
    const key = diagramHeightKey({
      pathname: window.location.pathname,
      index,
      title: titleTextOf(figure),
    });
    detachers.push(
      attachView(figure, {
        modal: false,
        onPanStart: () => tips.closeOpen(),
        resize: { key, storage },
      }),
    );
    detachers.push(() => {
      figure.removeEventListener(DIAGRAM_REDRAW_EVENT, onRedraw);
      tips.detach();
    });
    const opener = figure.querySelector<HTMLButtonElement>(
      '[data-tool="fullscreen"]',
    );
    let closeDialog: (() => void) | undefined;
    const onOpen = (): void => {
      if (opener) {
        closeDialog = openDiagramDialog({
          figure,
          opener,
          placement,
          attachModal: options.attachModal,
        });
      }
    };
    opener?.addEventListener("click", onOpen);
    detachers.push(() => {
      opener?.removeEventListener("click", onOpen);
      closeDialog?.();
    });
  });
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
