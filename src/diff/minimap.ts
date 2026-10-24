import {
  type DiffMinimapMark,
  renderDiffMinimap,
} from "../parts/diff-minimap.ts";

/** 帯に写す CSS 変数: 差分の行の計算値から読み、`document.body` の直下の帯の `style` に写す。使う側が `.mdmark` に書いた上書きを帯にも当てる */
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

/** 同じ印にまとめるときの、位置の割合の誤差 */
const MERGE_TOLERANCE = 0.001;

/** 送り先ごとの帯の控え */
type Entry = {
  /** 帯の要素 */
  band: HTMLElement;
  /** 印を出している差分の行の並び */
  lines: Set<HTMLElement>;
  /** 行の並びが変わったとき、観測と印を置き直す */
  sync: () => void;
  /** 帯と受け取りを外す */
  destroy: () => void;
};

/** 送り先のスクロールの要素から、そこに置いた帯と印を出している差分の行の集まりを引く */
const minimaps = new WeakMap<Element, Entry>();

/** 差分の行の祖先をたどり、縦にスクロールして中身がはみ出す一番近い要素を返す。無ければ画面をスクロールする要素 */
function findScroller(lines: HTMLElement): HTMLElement {
  for (
    let element = lines.parentElement;
    element !== null && element !== document.body;
    element = element.parentElement
  ) {
    const { overflowY } = getComputedStyle(element);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight
    ) {
      return element;
    }
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

/** 送り先が画面をスクロールする要素か */
function isPage(target: HTMLElement): boolean {
  return target === (document.scrollingElement ?? document.documentElement);
}

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

/** 送り先のスクロールの要素に、帯を 1 本だけ作る */
function createEntry(target: HTMLElement): Entry {
  const band = parseElement(
    renderDiffMinimap({ marks: [], view: { top: 0, height: 1 } }),
  );
  const lines = new Set<HTMLElement>();
  document.body.append(band);
  const page = isPage(target);

  /** 帯を送り先の右端に、送り先の高さで置く。画面のときは CSS が右端に画面の高さいっぱいで貼り付ける */
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

  /** 使う側の変数の上書きを、集まりの最初の差分の行から帯に写す */
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

  /** 送り先の中での縦の位置（px）を、送り先の全体に対する割合にする */
  const ratioOf = (element: Element, edge: "top" | "bottom"): number => {
    const rect = element.getBoundingClientRect();
    const origin = page
      ? 0
      : target.getBoundingClientRect().top + target.clientTop;
    const y = rect[edge] - origin + target.scrollTop;
    return clamp(y / target.scrollHeight);
  };

  /** 今見えている範囲の枠を置き直す */
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

  /** 集まりの全ての行から印を作り直す。続いた同じ種類の行は 1 つの印にまとめる */
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
        const kind = line.dataset.kind === "del" ? "del" : "add";
        const top = ratioOf(shown, "top");
        const bottom = ratioOf(shown, "bottom");
        const last = marks.at(-1);
        if (
          last?.kind === kind &&
          top <= last.top + last.height + MERGE_TOLERANCE
        ) {
          last.height = Math.max(last.top + last.height, bottom) - last.top;
          continue;
        }
        marks.push({ kind, top, height: bottom - top });
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

  /** 帯の位置・変数・印・枠を置き直す */
  const place = (): void => {
    placeBand();
    copyVariables();
    placeMarks();
  };

  /** 帯の上の位置を送り先の中ほどに置くよう、送り先を送る */
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
  // 送り先が画面でないとき、送り先の外（画面や祖先の枠）のスクロールでも送り先の位置が変わるため、捕捉の段で受けて帯を置き直す
  if (!page) {
    document.addEventListener("scroll", placeBand, { capture: true, signal });
  }
  window.matchMedia(DARK_QUERY).addEventListener("change", place, { signal });
  // 配色を決める祖先の class（`vscode-*`・`mdmark-theme-*`）が替わったら、変数を写し直す
  const themeObserver = new MutationObserver(copyVariables);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
  });
  // 差分の行の大きさと送り先の大きさが変わったら置き直す
  const observer = new ResizeObserver(place);
  observer.observe(page ? document.documentElement : target);
  // 差分の行の並びを足し外しするたびに、観測と印を置き直す
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

/** 差分の行の並びの送り先（一番近いスクロールする祖先、無ければ画面）の右端に、帯を 1 本だけ置いて印と今見えている範囲の枠を並べ、押す・押したまま動かすで送る。同じ送り先の 2 つ目以降の差分は同じ帯に印を足す。返す関数でこの行を帯から外し、行が無くなったら帯と受け取りを外す */
export function attachMinimap(lines: HTMLElement): () => void {
  const target = findScroller(lines);
  const entry = minimaps.get(target) ?? createEntry(target);
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
