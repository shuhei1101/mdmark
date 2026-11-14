import { findScrollContainer } from "../interact/scroller.ts";
import {
  type DiffMinimapMark,
  renderDiffMinimap,
} from "../parts/diff-minimap.ts";

/** 帯に写す CSS 変数: 差分の行の計算値から読み込み、`document.body` の直下の帯の `style` に写す。利用側が `.mdmark` に記載した上書きを帯にも適用する */
const MINIMAP_VARIABLES = [
  "--mdmark-color-diff-del-sign",
  "--mdmark-color-diff-add-sign",
  "--mdmark-color-border",
  "--mdmark-color-surface",
  "--mdmark-color-muted",
  "--mdmark-color-text",
  "--mdmark-diff-minimap-width",
  "--mdmark-diff-minimap-z-index",
];

/** 配色が切り替わったことを知る問い合わせ */
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** 同じマーカーにまとめるときの、位置の割合の誤差 */
const MERGE_TOLERANCE = 0.001;

/** スクロール先ごとの帯の記録 */
type Entry = {
  /** 帯の要素 */
  band: HTMLElement;
  /** マーカーを出している差分の行の並び */
  lines: Set<HTMLElement>;
  /** 行の並びが変わったとき、観測とマーカーをもう一度配置する */
  sync: () => void;
  /** 帯と受け取りを解除する */
  destroy: () => void;
};

/** スクロール先のスクロールの要素から、そこに配置した帯とマーカーを出している差分の行の集まりを参照する */
const minimaps = new WeakMap<Element, Entry>();

/** HTML 文字列から要素を作る */
function parseElement(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 範囲を 0〜1 に収める */
function clamp(ratio: number): number {
  return Math.min(Math.max(ratio, 0), 1);
}

/** スクロール先のスクロールの要素に、帯を 1 本だけ作る。page はスクロール先が画面全体か */
function createEntry(target: HTMLElement, page: boolean): Entry {
  const band = parseElement(
    renderDiffMinimap({ marks: [], view: { top: 0, height: 1 } }),
  );
  const lines = new Set<HTMLElement>();
  document.body.append(band);

  /** 帯をスクロール先の右端に、スクロール先の高さで配置する。画面のときは CSS が右端に画面の高さいっぱいで貼り付ける */
  const placeBand = (): void => {
    if (page) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const width = band.offsetWidth;
    band.style.insetBlock = "auto";
    band.style.top = `${rect.top}px`;
    band.style.height = `${rect.height}px`;
    band.style.insetInlineEnd = "auto";
    band.style.left = `${rect.right - width}px`;
  };

  /** 利用側の変数の上書きを、集まりの最初の差分の行から帯に写す */
  const copyVariables = (): void => {
    const [first] = lines;
    if (first === undefined) {
      return;
    }
    const style = getComputedStyle(first);
    for (const name of MINIMAP_VARIABLES) {
      const value = style.getPropertyValue(name).trim();
      if (value !== "") {
        band.style.setProperty(name, value);
      }
    }
  };

  /** スクロール先の中での縦の位置（px）を、スクロール先の全体に対する割合にする */
  const ratioOf = (element: Element, edge: "top" | "bottom"): number => {
    const rect = element.getBoundingClientRect();
    const origin = page
      ? 0
      : target.getBoundingClientRect().top + target.clientTop;
    const y = rect[edge] - origin + target.scrollTop;
    return clamp(y / target.scrollHeight);
  };

  /** 今見えている範囲の枠をもう一度配置する */
  const placeView = (): void => {
    const view = band.querySelector<HTMLElement>(".mdmark-diff-minimap-view");
    if (view === null) {
      return;
    }
    const top = clamp(target.scrollTop / target.scrollHeight);
    const height = clamp(target.clientHeight / target.scrollHeight);
    view.style.top = `${Number((top * 100).toFixed(4))}%`;
    view.style.height = `${Number((height * 100).toFixed(4))}%`;
  };

  /** 集まりの全ての行からマーカーを再作成する。続いた同じ種類の行は 1 つのマーカーにまとめる */
  const placeMarks = (): void => {
    const marks: DiffMinimapMark[] = [];
    for (const group of lines) {
      const changed = group.querySelectorAll<HTMLElement>(
        '.mdmark-diff-line[data-kind="del"], .mdmark-diff-line[data-kind="add"]',
      );
      for (const line of changed) {
        // 隠れた見方の行は、見えている範囲の塊の位置で示す
        const shown =
          line.offsetParent === null ? line.closest(".mdmark-diff-html") : line;
        if (shown === null) {
          continue;
        }
        addMark(marks, {
          kind: line.dataset.kind === "del" ? "del" : "add",
          top: ratioOf(shown, "top"),
          bottom: ratioOf(shown, "bottom"),
        });
      }
    }
    const next = parseElement(
      renderDiffMinimap({
        marks,
        view: { top: 0, height: 1 },
      }),
    );
    band.replaceChildren(...next.childNodes);
    placeView();
  };

  /** 帯の位置・変数・マーカー・枠をもう一度配置する */
  const place = (): void => {
    placeBand();
    copyVariables();
    placeMarks();
  };

  /** 帯の上の位置をスクロール先の中ほどに配置するよう、スクロール先を送信する */
  const sendTo = (clientY: number): void => {
    const rect = band.getBoundingClientRect();
    const ratio = clamp((clientY - rect.top) / rect.height);
    const top = Math.max(
      ratio * target.scrollHeight - target.clientHeight / 2,
      0,
    );
    if (page) {
      window.scrollTo({ top });
    } else {
      target.scrollTo({ top });
    }
  };

  const abort = new AbortController();
  const { signal } = abort;
  band.addEventListener(
    "pointerdown",
    (event) => {
      band.setPointerCapture(event.pointerId);
      sendTo(event.clientY);
    },
    { signal },
  );
  band.addEventListener(
    "pointermove",
    (event) => {
      if (band.hasPointerCapture(event.pointerId)) {
        sendTo(event.clientY);
      }
    },
    { signal },
  );
  (page ? window : target).addEventListener("scroll", placeView, {
    passive: true,
    signal,
  });
  window.addEventListener("resize", place, { signal });
  // スクロール先が画面でないとき、スクロール先の外（画面や祖先の枠）のスクロールでもスクロール先の位置が変わるため、キャプチャーフェーズで受けて帯をもう一度配置する
  if (!page) {
    document.addEventListener("scroll", placeBand, { capture: true, signal });
  }
  window.matchMedia(DARK_QUERY).addEventListener("change", place, { signal });
  // 配色を決める祖先の class（`vscode-*`・`mdmark-theme-*`）が替わったら、変数をもう一度コピーする
  const themeObserver = new MutationObserver(copyVariables);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
  });
  // 差分の行の大きさとスクロール先の大きさが変わったらもう一度配置する
  const observer = new ResizeObserver(place);
  observer.observe(page ? document.documentElement : target);
  // 差分の行の並びを追加・削除するたびに、観測とマーカーをもう一度配置する
  const sync = (): void => {
    observer.disconnect();
    observer.observe(page ? document.documentElement : target);
    for (const group of lines) {
      observer.observe(group);
    }
    place();
  };
  return {
    band,
    lines,
    sync,
    destroy: () => {
      abort.abort();
      observer.disconnect();
      themeObserver.disconnect();
      band.remove();
    },
  };
}

/** 行のマーカーを並びに追加する。直前のマーカーと同じ種類で続いていれば、直前のマーカーを伸ばす */
function addMark(
  marks: DiffMinimapMark[],
  line: { kind: "del" | "add"; top: number; bottom: number },
): void {
  const { kind, top, bottom } = line;
  const last = marks.at(-1);
  if (last?.kind === kind && top <= last.top + last.height + MERGE_TOLERANCE) {
    last.height = Math.max(last.top + last.height, bottom) - last.top;
    return;
  }
  marks.push({ kind, top, height: bottom - top });
}

/** 差分の行の並びのスクロール先（一番近いスクロールする祖先、無ければ画面）の右端に、帯を 1 本だけ配置してマーカーと今見えている範囲の枠を並べ、押す・押したまま動かすで送信する。同じスクロール先の 2 つ目以降の差分は同じ帯にマーカーを追加する。返却する関数でこの行を帯から除外し、行が無くなったら帯と受け取りを解除する */
export function attachMinimap(lines: HTMLElement): () => void {
  const { target, page } = findScrollContainer(lines);
  const entry = minimaps.get(target) ?? createEntry(target, page);
  minimaps.set(target, entry);
  entry.lines.add(lines);
  entry.sync();
  let attached = true;
  return () => {
    if (!attached) {
      return;
    }
    attached = false;
    entry.lines.delete(lines);
    if (entry.lines.size === 0) {
      entry.destroy();
      minimaps.delete(target);
    } else {
      entry.sync();
    }
  };
}
