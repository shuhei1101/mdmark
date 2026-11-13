import type { TooltipPlacement } from "../config.ts";
import { ZOOM } from "../diagram/geometry.ts";
import { iconSvg } from "../parts/icons.ts";
import { attachDiagramResize, diagramHeightKey } from "./diagram-resize.ts";
import { attachDiagramTips } from "./diagram-tips.ts";
import { attachDiagramTouch } from "./diagram-touch.ts";
import { attachErFolds } from "./er-folds.ts";
import type { PartStates } from "./part-states.ts";
import { attachZoom } from "./zoom.ts";

export { ZOOM };

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// 文字を選べる所（ここではドラッグを始めない）
const TEXT_SELECTOR =
  ".mdmark-diagram-er-head, .mdmark-diagram-er-columns, .mdmark-diagram-node-kind, .mdmark-diagram-node-name, .mdmark-diagram-node-sub, .mdmark-diagram-label, .mdmark-diagram-axis-text, .mdmark-diagram-value-text, .mdmark-term";

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
  for (const name of ["aria-describedby", "aria-labelledby", "for"]) {
    for (const element of [scope, ...scope.querySelectorAll(`[${name}]`)]) {
      const value = element.getAttribute(name);
      if (value !== null) {
        element.setAttribute(name, value.split(/\s+/).map(swap).join(" "));
      }
    }
  }
  // 矢じりと塗りの模様の参照
  for (const name of ["marker-end", "fill"]) {
    for (const element of scope.querySelectorAll(`[${name}]`)) {
      const value = element.getAttribute(name) ?? "";
      element.setAttribute(name, value.replace(`url(#${head}`, `url(#${to}-`));
    }
  }
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
  const stickHeads = (): void => {
    if (!heads) {
      return;
    }
    heads.style.transform = `translateY(${viewport.scrollTop / scale}px)`;
    heads.classList.toggle("is-stuck", viewport.scrollTop > 0);
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
    keyTargets: [box],
    percentBase: "fit",
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

/** 図を全画面のモーダルで開き、開いた全画面を閉じる関数を返却する。閉じるボタンか Esc で閉じたら、付けた操作と監視を解除して `dialog` を削除し、フォーカスを全画面のボタンへ戻す */
export function openDiagramDialog(options: {
  /** 開く図 */
  figure: HTMLElement;
  /** 全画面のボタン */
  opener: HTMLButtonElement;
  /** モーダルの中のツールチップを先に出す側 */
  placement: TooltipPlacement;
}): () => void {
  const { figure, opener, placement } = options;
  const host = figure.closest<HTMLElement>(".mdmark") ?? document.body;
  const dialog = document.createElement("dialog");
  dialog.className = "mdmark-diagram-dialog";
  const modalFigure = prepareModalFigure(figure);
  dialog.append(modalFigure);
  host.append(dialog);
  dialog.showModal();
  const tips = attachDiagramTips({ figure: modalFigure, placement });
  const detachView = attachView(modalFigure, {
    modal: true,
    onPanStart: () => tips.closeOpen(),
  });
  // コピーした ER 図は、開いたときの列の開閉の状態のまま開閉できる
  const detachFolds = attachErFolds(modalFigure);
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
      tips.detach();
      detachFolds();
      detachView();
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
  /** 文書の中の ER 図に指定する部品の開閉の記録（省くと記録しない） */
  partStates?: PartStates;
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
    const title = figure.querySelector(".mdmark-diagram-head")?.id ?? "";
    // 同じページに文書を 2 つ以上描いても `id` が重ならないようもう一度振る
    renumberIds(
      figure,
      title.replace(/-title$/, ""),
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
      title: figure.querySelector(".mdmark-diagram-title")?.textContent ?? "",
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
    const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
    const viewport = figure.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    if (box && viewport) {
      detachers.push(attachDiagramTouch({ box, viewport }));
    }
    if (figure.dataset.diagram === "er") {
      detachers.push(attachErFolds(figure, options.partStates));
    }
    const opener = figure.querySelector<HTMLButtonElement>(
      '[data-tool="fullscreen"]',
    );
    let closeDialog: (() => void) | undefined;
    const onOpen = (): void => {
      if (opener) {
        closeDialog = openDiagramDialog({ figure, opener, placement });
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
