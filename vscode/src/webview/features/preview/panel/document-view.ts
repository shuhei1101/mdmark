import type {
  AxeViolation,
  HostMessage,
  InspectedElement,
  PreviewTheme,
} from "../../../../messages.ts";
import {
  createDiffSource,
  DIFF_DOC_ID,
  type DiffTexts,
} from "./diff-source.ts";
import {
  type Mdmark,
  type MountHandle,
  supportsDiffBlocks,
} from "./load-mdmark.ts";
import {
  type Anchor,
  collectAnchors,
  fractionalLineForTop,
  lineForTop,
  topForLine,
  topInset,
} from "./scroll.ts";

/** `inspect` の `play` で、`play()` を呼んでから調べるまで待つミリ秒 */
export const INSPECT_PLAY_MS = 1000;

/** `render` のメッセージ */
type RenderMessage = Extract<HostMessage, { type: "render" }>;

/** axe-core の `run` の結果のうち、使うもの */
type AxeResult = {
  violations: {
    id: string;
    impact?: string | null;
    nodes: { target: unknown[] }[];
  }[];
};

/** 結合テストのビルドが置く axe-core（UMD のため `window.axe` に入る） */
type AxeGlobal = {
  axe?: {
    run: (context: {
      include: Element[];
      exclude: Element[];
    }) => Promise<AxeResult>;
  };
};

/** React の外の DOM として持つ描く先の要素に、mdmark の `mount`・`update` で文書を描き、スクロールの位置と配色の class を持つ */
export type DocumentView = {
  /** React が描いた描く先の要素を受ける */
  attach: (element: HTMLElement) => void;
  /** 描画を destroy し、描く先の要素と描画を外す */
  detach: () => void;
  /** 読み終えた配布物を受ける */
  useMdmark: (mdmark: Mdmark) => void;
  /** 受けた配布物が差分の色分けに対応するか。受ける前は true */
  supportsDiff: () => boolean;
  /** `render` を受けて文書を描く */
  render: (message: RenderMessage) => void;
  /** 元の行番号の位置を先頭に置く */
  scrollToLine: (line: number) => void;
  /** 自分が起こしたスクロールなら `undefined`、そうでなければ見えている先頭の行 */
  takeScroll: () => number | undefined;
  /** 見えている先頭の元の行番号。描く前は `undefined` */
  currentLine: () => number | undefined;
  /** 見えている先頭の、切り捨てない元の行番号。描く前は `undefined` */
  currentPosition: () => number | undefined;
  /** `selector` に当たる要素ごとの様子を返す（テストのときだけ） */
  inspect: (selector: string, play?: boolean) => Promise<InspectedElement[]>;
  /** パネルの部品を axe で検査する（テストのときだけ） */
  audit: () => Promise<AxeViolation[]>;
};

/** 画面がスクロールする要素 */
const scroller = (): Element =>
  document.scrollingElement ?? document.documentElement;

/** `light`・`dark` のときだけ包む要素に配色の class を付け、`auto` のときは両方を外す */
const applyTheme = (root: HTMLElement, theme: PreviewTheme): void => {
  root.classList.toggle("mdmark-theme-light", theme === "light");
  root.classList.toggle("mdmark-theme-dark", theme === "dark");
};

/** 要素 1 つの様子 */
const inspectElement = (element: Element): InspectedElement => {
  const rect = element.getBoundingClientRect();
  const inspected: InspectedElement = {
    tagName: element.tagName.toLowerCase(),
    className: element.getAttribute("class") ?? "",
    attributes: Object.fromEntries(
      element
        .getAttributeNames()
        .map((name) => [name, element.getAttribute(name) ?? ""]),
    ),
    text: element.textContent ?? "",
    top: rect.top,
    height: rect.height,
  };
  if (element instanceof HTMLImageElement) {
    inspected.naturalWidth = element.naturalWidth;
  }
  if (element instanceof HTMLMediaElement) {
    inspected.currentTime = element.currentTime;
    inspected.readyState = element.readyState;
  }
  return inspected;
};

/** 当たった動画・音声を `muted` で再生し、`INSPECT_PLAY_MS` 待つ（`play()` が拒まれた要素もそのまま） */
const playMedia = async (selector: string): Promise<void> => {
  const media = [...document.querySelectorAll(selector)].filter(
    (element): element is HTMLMediaElement =>
      element instanceof HTMLMediaElement,
  );
  for (const element of media) {
    element.muted = true;
    await element.play().catch(() => undefined);
  }
  await new Promise((resolve) => setTimeout(resolve, INSPECT_PLAY_MS));
};

/** `preview.js` と同じ場所の `test/axe.js` を読み、`window.axe` を返す */
const loadAxe = async (): Promise<NonNullable<AxeGlobal["axe"]>> => {
  const script = document.querySelector<HTMLScriptElement>(
    "script[src$='preview.js']",
  );
  if (script === null) {
    throw new Error("preview.js の script が無い");
  }
  await import(
    /* @vite-ignore */ script.src.replace(/preview\.js$/, "test/axe.js")
  );
  const { axe } = window as unknown as AxeGlobal;
  if (axe === undefined) {
    throw new Error("axe を読めなかった");
  }
  return axe;
};

/** 描く先を包む要素と保存した行を受け、`DocumentView` を作る */
export const createDocumentView = (options: {
  /** 描く先を包む要素（`#mdmark-preview`） */
  root: HTMLElement;
  /** 作り直した Webview が `getState` で読んだ行 */
  savedLine?: number;
  /** 読んだ配布物（単体テストが渡す） */
  mdmark?: Mdmark;
}): DocumentView => {
  const { root } = options;
  let element: HTMLElement | undefined;
  let mdmark = options.mdmark;
  let handle: MountHandle | undefined;
  let configKey: string | undefined;
  let pendingScrollTop: number | undefined;
  let diffTexts: DiffTexts | undefined;
  let savedLine = options.savedLine;

  /** 行の印と、見えている先頭の位置（上端の帯があればその下端）。描く前は `undefined` */
  const visibleTop = (): { anchors: Anchor[]; top: number } | undefined => {
    if (handle === undefined || element === undefined) {
      return undefined;
    }
    const scrolling = scroller();
    return {
      anchors: collectAnchors({ root: element, scroller: scrolling }),
      top:
        scrolling.scrollTop + topInset({ root: element, scroller: scrolling }),
    };
  };

  const scrollToLine = (line: number): void => {
    if (element === undefined) {
      return;
    }
    const scrolling = scroller();
    const anchors = collectAnchors({ root: element, scroller: scrolling });
    const before = scrolling.scrollTop;
    // 狭い幅で右側の目次が上端の帯のときは、帯の下端に置く。帯は動かした後に上端へ留まって下端が変わるため、留まった帯の下端で置き直す
    for (let pass = 0; pass < 2; pass += 1) {
      scrolling.scrollTop =
        topForLine(anchors, line) -
        topInset({ root: element, scroller: scrolling });
    }
    if (scrolling.scrollTop !== before) {
      pendingScrollTop = scrolling.scrollTop;
    }
  };

  const currentLine = (): number | undefined => {
    const top = visibleTop();
    return top === undefined ? undefined : lineForTop(top.anchors, top.top);
  };

  /** 初回と `config` か `aliases` が変わったときは `mount`（前の描画は `destroy`）、それ以外は `update` */
  const draw = (
    loaded: Mdmark,
    target: HTMLElement,
    message: RenderMessage,
  ): void => {
    const key = JSON.stringify([message.config, message.aliases]);
    const includes =
      message.includes === undefined ? {} : { includes: message.includes };
    if (handle !== undefined && key === configKey) {
      // 取り込む文書の表を持たないメッセージ（前のバージョンの拡張機能）は、前の表のまま描き直す
      if (message.includes === undefined) {
        handle.update(message.markdown);
      } else {
        handle.update(message.markdown, includes);
      }
      return;
    }
    handle?.destroy();
    handle = loaded.mount(target, {
      markdown: message.markdown,
      config: message.config,
      ...includes,
      ...(message.aliases === undefined ? {} : { aliases: message.aliases }),
      ...(diffTexts === undefined
        ? {}
        : {
            diffSource: createDiffSource(diffTexts),
            docId: DIFF_DOC_ID,
            diffMode: "blocks" as const,
          }),
    });
    configKey = key;
  };

  /** 作り直した Webview は、背面に回す前に保存した行へ戻す（`pendingScrollTop` に覚えるため `revealLine` は送らない） */
  const restoreSavedLine = (line: number): void => {
    savedLine = undefined;
    scrollToLine(line);
    // 差分のパネルは描いた後に色分けで描き直して高さが変わるため、その間に動かされていなければ次の描画のタイミングで置き直す
    const placedTop = scroller().scrollTop;
    requestAnimationFrame(() => {
      if (scroller().scrollTop === placedTop) {
        scrollToLine(line);
      }
    });
  };

  return {
    attach: (target) => {
      element = target;
    },
    detach: () => {
      handle?.destroy();
      handle = undefined;
      configKey = undefined;
      element = undefined;
    },
    useMdmark: (loaded) => {
      mdmark = loaded;
    },
    supportsDiff: () => mdmark === undefined || supportsDiffBlocks(mdmark),
    render: (message) => {
      if (mdmark === undefined || element === undefined) {
        throw new Error("mdmark の配布物を読む前に render を受けた");
      }
      applyTheme(root, message.theme);
      // 描き直しでスクロールの位置が動かないよう、描く前の位置を控える
      const scrollTop = scroller().scrollTop;
      if (message.previous !== undefined) {
        diffTexts ??= { modified: "", original: "" };
        diffTexts.modified = message.markdown;
        diffTexts.original = message.previous;
      }
      draw(mdmark, element, message);
      if (savedLine === undefined) {
        scroller().scrollTop = scrollTop;
        return;
      }
      restoreSavedLine(savedLine);
    },
    scrollToLine,
    takeScroll: () => {
      const pending = pendingScrollTop;
      pendingScrollTop = undefined;
      if (scroller().scrollTop === pending) {
        return undefined;
      }
      return currentLine();
    },
    currentLine,
    currentPosition: () => {
      const top = visibleTop();
      return top === undefined
        ? undefined
        : fractionalLineForTop(top.anchors, top.top);
    },
    inspect: async (selector, play = false) => {
      if (play) {
        await playMedia(selector);
      }
      return [...document.querySelectorAll(selector)].map(inspectElement);
    },
    audit: async () => {
      const axe = await loadAxe();
      const result = await axe.run({
        include: [root],
        exclude: element === undefined ? [] : [element],
      });
      return result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        targets: violation.nodes.map((node) => node.target.join(" ")),
      }));
    },
  };
};
