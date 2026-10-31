import type {
  HostMessage,
  InspectedElement,
  LoadFailureReason,
  PreviewTheme,
  WebviewMessage,
} from "../messages.ts";
import { renderConfigBand } from "./parts/config-band.ts";
import {
  type PreviewStatusState,
  renderPreviewStatus,
} from "./parts/preview-status.ts";
import {
  type Anchor,
  collectAnchors,
  fractionalLineForTop,
  lineForTop,
  topForLine,
  topInset,
} from "./scroll.ts";

/** HTML を入れてからこのミリ秒が経っても描けていなければ読み込み中を出す */
export const LOADING_DELAY_MS = 1000;

/** VS Code が Webview に渡す API。状態の読み書きを持たない代役では、行を保存しない */
declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewMessage) => void;
  getState?: () => unknown;
  setState?: (state: PreviewState) => void;
};

/** `setState` で保存し、作り直した Webview が `getState` で読む値 */
export type PreviewState = {
  /** 見えている先頭の元の行番号（0 始まり）。整数に切り捨てず、小数部で行の途中の割合を持つ */
  line: number;
};

/** `getState` で読んだ値が `PreviewState` なら、その行を返す */
function savedLineFrom(state: unknown): number | undefined {
  if (typeof state !== "object" || state === null || !("line" in state)) {
    return undefined;
  }
  return typeof state.line === "number" ? state.line : undefined;
}

/** `mount` の戻り値 */
type MountHandle = {
  update: (markdown: string) => void;
  destroy: () => void;
};

/** 差分の取り出し元（mdmark の `DiffSource` のうち、この入口が作るもの） */
type DiffSourceLike = {
  revisions: (docId: string) => Promise<{ id: string; at: string }[]>;
  content: (target: { docId: string; revisionId: string }) => Promise<string>;
};

/** `import()` で読んだ mdmark の配布物のうち、この入口が使うもの。`diffModes` を持たない前のバージョンもある */
export type Mdmark = {
  mount: (
    element: HTMLElement,
    options: {
      markdown: string;
      config?: unknown;
      diffSource?: DiffSourceLike;
      docId?: string;
      diffMode?: "blocks";
    },
  ) => MountHandle;
  diffModes?: unknown;
};

/** 差分のパネルで取り出し元に渡す、最後に受けた `render` の全文。書き換えられる入れ物 */
export type DiffTexts = {
  /** 変更後の全文（`render` の `markdown`） */
  modified: string;
  /** 変更前の全文（`render` の `previous`） */
  original: string;
};

/** 差分の取り出し元に使う docId */
const DIFF_DOC_ID = "diff";

/** `revisions` が `modified`・`original` の 2 つをこの順に返し、`content` が呼ばれた時点の全文を返す取り出し元を作る。`content` は知らない `revisionId` で reject する */
export function createDiffSource(texts: DiffTexts): DiffSourceLike {
  return {
    revisions: async () => {
      const at = new Date().toISOString();
      return [
        { id: "modified", at },
        { id: "original", at },
      ];
    },
    content: async ({ revisionId }) => {
      if (revisionId === "modified" || revisionId === "original") {
        return texts[revisionId];
      }
      throw new Error(`知らないリビジョン: ${revisionId}`);
    },
  };
}

/** 読んだ配布物の `diffModes` が配列で `blocks` を含むとき、差分の色分けに対応する */
export function supportsDiffBlocks(mdmark: { diffModes?: unknown }): boolean {
  return Array.isArray(mdmark.diffModes) && mdmark.diffModes.includes("blocks");
}

/** 描く先を包む要素の `data-*` に置かれた、パネルの始め方 */
type PreviewBoot = {
  distJs: string | undefined;
  version: string | undefined;
  status: "versionUndecidable" | undefined;
  configPath: string;
  test: boolean;
};

/** 画面がスクロールする要素 */
function scroller(): Element {
  return document.scrollingElement ?? document.documentElement;
}

/** HTML の文字列から要素を 1 つ作る */
function elementFrom(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 読めなかった `index.js` の URL を `fetch` の `HEAD` で確かめ、404 なら `versionMissing`、それ以外は `offline` を返す */
export async function classifyLoadFailure(options: {
  /** 読めなかった URL */
  url: string;
  /** 要求に使う `fetch` */
  fetch: typeof fetch;
}): Promise<LoadFailureReason> {
  try {
    const response = await options.fetch(options.url, { method: "HEAD" });
    return response.status === 404 ? "versionMissing" : "offline";
  } catch {
    return "offline";
  }
}

/** 描く先を包む要素の中の状態の表示・帯・描いた文書を切り替え、mdmark の `mount`・`update` とスクロールの位置を持つ */
export class PreviewView {
  /** 描く先を包む要素（`#mdmark-preview`） */
  private readonly root: HTMLElement;
  /** mdmark の `mount` に渡す描く先の要素 */
  private readonly documentElement: HTMLElement;
  /** `import()` で読んだ mdmark の配布物 */
  private mdmark: Mdmark | undefined;
  /** 今の描画。初回の `render` までは `undefined` */
  private handle: MountHandle | undefined;
  /** 今の描画に渡した `config` の `JSON.stringify`（前と同じかの比較に使う） */
  private configKey: string | undefined;
  /** `scrollToLine` で動かした `scrollTop`。次の `scroll` の知らせでその値なら `revealLine` を送らずに消す */
  private pendingScrollTop: number | undefined;
  /** 状態の表示の要素 */
  private statusElement: HTMLElement | undefined;
  /** 設定ファイルを読めない帯の要素 */
  private bandElement: HTMLElement | undefined;
  /** 差分のパネルで取り出し元に渡した全文。`previous` を持つ `render` を初めて受けたときに作る */
  private diffTexts: DiffTexts | undefined;
  /** 作り直した Webview が起動したときに `getState` で読んだ行。最初の `render` でその行へ戻したら消す */
  private savedLine: number | undefined;

  constructor(options: {
    root: HTMLElement;
    mdmark?: Mdmark;
    savedLine?: number;
  }) {
    this.root = options.root;
    this.mdmark = options.mdmark;
    this.savedLine = options.savedLine;
    this.documentElement = document.createElement("div");
    this.root.append(this.documentElement);
  }

  /** `import()` で読んだ mdmark の配布物を渡す */
  useMdmark(mdmark: Mdmark): void {
    this.mdmark = mdmark;
  }

  /** `render` を受けて文書を描く。初回と `config` が変わったときは `mount`（前の描画は `destroy`）、それ以外は `update` */
  render(message: Extract<HostMessage, { type: "render" }>): void {
    const mdmark = this.mdmark;
    if (mdmark === undefined) {
      throw new Error("mdmark の配布物を読む前に render を受けた");
    }
    this.applyTheme(message.theme);
    // 描き直しでスクロールの位置が動かないよう、描く前の位置を控える
    const scrollTop = scroller().scrollTop;
    const configKey = JSON.stringify(message.config);
    if (message.previous !== undefined) {
      this.diffTexts ??= { modified: "", original: "" };
      this.diffTexts.modified = message.markdown;
      this.diffTexts.original = message.previous;
    }
    if (this.handle !== undefined && configKey === this.configKey) {
      this.handle.update(message.markdown);
    } else {
      this.handle?.destroy();
      this.handle = mdmark.mount(this.documentElement, {
        markdown: message.markdown,
        config: message.config,
        ...(this.diffTexts === undefined
          ? {}
          : {
              diffSource: createDiffSource(this.diffTexts),
              docId: DIFF_DOC_ID,
              diffMode: "blocks" as const,
            }),
      });
      this.configKey = configKey;
    }
    this.clearStatus();
    if (this.savedLine === undefined) {
      scroller().scrollTop = scrollTop;
      return;
    }
    // 作り直した Webview は、背面に回す前に保存した行へ戻す（`pendingScrollTop` に覚えるため `revealLine` は送らない）
    const savedLine = this.savedLine;
    this.savedLine = undefined;
    this.scrollToLine(savedLine);
    // 差分のパネルは描いた後に色分けで描き直して高さが変わるため、その間に動かされていなければ次の描画のタイミングで置き直す
    const placedTop = scroller().scrollTop;
    requestAnimationFrame(() => {
      if (scroller().scrollTop === placedTop) {
        this.scrollToLine(savedLine);
      }
    });
  }

  /** 描いた文書の代わりに、プレビューの状態の表示を入れる */
  showStatus(options: { state: PreviewStatusState; version?: string }): void {
    this.clearStatus();
    this.statusElement = elementFrom(renderPreviewStatus(options));
    this.root.insertBefore(this.statusElement, this.documentElement);
    this.documentElement.hidden = true;
  }

  /** 描いた文書の前に設定ファイルを読めない帯を置く（既にあれば置き換える） */
  showConfigError(line: number): void {
    this.clearConfigError();
    this.bandElement = elementFrom(
      renderConfigBand({ path: this.root.dataset.configPath ?? "", line }),
    );
    this.root.insertBefore(this.bandElement, this.documentElement);
  }

  /** 設定ファイルを読めない帯を取り除く */
  clearConfigError(): void {
    this.bandElement?.remove();
    this.bandElement = undefined;
  }

  /** 元の行番号の位置を先頭に置く。動かす `scrollTop` が今の値と違うときだけ動かし、`pendingScrollTop` に覚える */
  scrollToLine(line: number): void {
    const element = scroller();
    const anchors = collectAnchors({
      root: this.documentElement,
      scroller: element,
    });
    const before = element.scrollTop;
    // 狭い幅で右側の目次が上端の帯のときは、帯の下端に置く。帯は動かした後に上端へ留まって下端が変わるため、留まった帯の下端で置き直す
    for (let pass = 0; pass < 2; pass += 1) {
      element.scrollTop =
        topForLine(anchors, line) -
        topInset({ root: this.documentElement, scroller: element });
    }
    if (element.scrollTop !== before) {
      this.pendingScrollTop = element.scrollTop;
    }
  }

  /** `scroll` の知らせを受け、自分が起こしたスクロールなら `undefined`、そうでなければ見えている先頭の元の行番号を返す */
  takeScroll(): number | undefined {
    const element = scroller();
    const pending = this.pendingScrollTop;
    this.pendingScrollTop = undefined;
    if (element.scrollTop === pending) {
      return undefined;
    }
    return this.currentLine();
  }

  /** 見えている先頭の位置（上端の帯があればその下端）を元の行番号にして返す。描く前は `undefined` */
  currentLine(): number | undefined {
    const top = this.visibleTop();
    return top === undefined ? undefined : lineForTop(top.anchors, top.top);
  }

  /** 見えている先頭の位置（上端の帯があればその下端）を、整数に切り捨てない元の行番号にして返す。描く前は `undefined` */
  currentPosition(): number | undefined {
    const top = this.visibleTop();
    return top === undefined
      ? undefined
      : fractionalLineForTop(top.anchors, top.top);
  }

  /** 行の印と、見えている先頭の位置（上端の帯があればその下端）を返す。描く前は `undefined` */
  private visibleTop(): { anchors: Anchor[]; top: number } | undefined {
    // 描く前は元の行番号の印が無いため、返す位置も無い
    if (this.handle === undefined) {
      return undefined;
    }
    const element = scroller();
    return {
      anchors: collectAnchors({
        root: this.documentElement,
        scroller: element,
      }),
      top:
        element.scrollTop +
        topInset({ root: this.documentElement, scroller: element }),
    };
  }

  /** `selector` に当たる要素ごとの `InspectedElement` を返す（テストのときだけ呼ばれる） */
  inspect(selector: string): InspectedElement[] {
    return [...document.querySelectorAll(selector)].map((element) => {
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
      return inspected;
    });
  }

  /** `light`・`dark` のときだけ包む要素に配色の class を付け、`auto` のときは両方を外す */
  private applyTheme(theme: PreviewTheme): void {
    this.root.classList.toggle("mdmark-theme-light", theme === "light");
    this.root.classList.toggle("mdmark-theme-dark", theme === "dark");
  }

  /** 状態の表示を取り除き、描いた文書を出す */
  private clearStatus(): void {
    this.statusElement?.remove();
    this.statusElement = undefined;
    this.documentElement.hidden = false;
  }
}

/** 描く先を包む要素の `data-*` からパネルの始め方を読む */
function readBoot(root: HTMLElement): PreviewBoot {
  return {
    distJs: root.dataset.distJs,
    version: root.dataset.version,
    status:
      root.dataset.status === "versionUndecidable"
        ? "versionUndecidable"
        : undefined,
    configPath: root.dataset.configPath ?? "",
    test: root.dataset.test !== undefined,
  };
}

/** Webview の入口。配布物を読み、拡張機能のメッセージ・リンクの押下・スクロールを受ける。描く先を包む要素が無いページでは何もしない */
export function startPreview(): void {
  const root = document.getElementById("mdmark-preview");
  if (root === null) {
    return;
  }
  const boot = readBoot(root);
  const api = acquireVsCodeApi();
  const savedLine = savedLineFrom(api.getState?.());
  const view = new PreviewView(
    savedLine === undefined ? { root } : { root, savedLine },
  );
  /** 見えている先頭の位置を、作り直した Webview が読めるように保存する */
  const saveLine = (): void => {
    const line = view.currentPosition();
    if (line !== undefined) {
      api.setState?.({ line });
    }
  };
  /** 最初の `rendered` を送ったか、描けない理由を出したか */
  let settled = false;
  /** `import()` で読んだ mdmark の配布物 */
  let loaded: Mdmark | undefined;
  // 本文のリンクと状態の表示のボタンの押下。VS Code の Webview の外枠は `window` の `click` でもリンクを開くため、キャプチャで受けて伝播を止める
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : undefined;
      const action =
        target?.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "reload" || action === "openConfig") {
        api.postMessage({ type: action });
        return;
      }
      const link = target?.closest("a[href]");
      if (link === null || link === undefined) {
        return;
      }
      // 右側の目次のリンクは右側の目次へ届け、下のバブリングで止める
      if (link.closest(".mdmark-side-toc") !== null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        // ページの中のリンクは、この中で移る
        document
          .getElementById(decodeURIComponent(href.slice(1)))
          ?.scrollIntoView();
      } else {
        api.postMessage({ type: "openLink", href });
      }
    },
    true,
  );
  // 右側の目次のリンク: 右側の目次の操作が節を開いて移った後に、リンクの既定の動きと window への伝播を止める
  document.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest(".mdmark-side-toc a[href]") !== null
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
    const message = event.data;
    if (message.type === "render") {
      // 差分のパネルで、読んだ配布物が差分の色分けに対応しないときは、変更後の文書だけの表示を出さずに理由を出す
      if (
        message.previous !== undefined &&
        loaded !== undefined &&
        !supportsDiffBlocks(loaded)
      ) {
        settled = true;
        view.showStatus(
          boot.version === undefined
            ? { state: "diffUnsupported" }
            : { state: "diffUnsupported", version: boot.version },
        );
        api.postMessage({ type: "loadFailed", reason: "diffUnsupported" });
        return;
      }
      view.render(message);
      settled = true;
      api.postMessage({ type: "rendered" });
      saveLine();
    } else if (message.type === "scrollToLine") {
      view.scrollToLine(message.line);
    } else if (message.type === "configError") {
      view.showConfigError(message.line);
    } else if (message.type === "configOk") {
      view.clearConfigError();
    } else if (message.type === "inspect" && boot.test) {
      api.postMessage({
        type: "inspected",
        id: message.id,
        elements: view.inspect(message.selector),
      });
    }
  });
  // スクロールの知らせは、描画の 1 フレームごとに 1 回にまとめて送る
  let scrollQueued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) {
        return;
      }
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const line = view.takeScroll();
        if (line !== undefined) {
          api.postMessage({ type: "revealLine", line });
        }
        saveLine();
      });
    },
    { passive: true },
  );
  if (boot.status === "versionUndecidable" || boot.distJs === undefined) {
    view.showStatus({ state: "versionUndecidable" });
    return;
  }
  const distJs = boot.distJs;
  // 1 秒未満で描き終えるときに読み込み中が一瞬だけ出ないよう、待ってから出す
  setTimeout(() => {
    if (!settled) {
      view.showStatus({ state: "loading" });
    }
  }, LOADING_DELAY_MS);
  import(/* @vite-ignore */ distJs).then(
    (mdmark: Mdmark) => {
      loaded = mdmark;
      view.useMdmark(mdmark);
      api.postMessage({ type: "ready" });
    },
    async () => {
      const reason = await classifyLoadFailure({
        url: distJs,
        fetch: window.fetch.bind(window),
      });
      settled = true;
      view.showStatus(
        boot.version === undefined
          ? { state: reason }
          : { state: reason, version: boot.version },
      );
      api.postMessage({ type: "loadFailed", reason });
    },
  );
}

startPreview();
