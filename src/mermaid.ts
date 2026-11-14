import type { ResolvedConfig, TooltipPlacement } from "./config.ts";
import type { SyntaxImport } from "./highlight.ts";
import { attachDiagrams } from "./interact/diagrams.ts";
import {
  MERMAID_FIXED_THEME_VARIABLES,
  MERMAID_THEME_COLORS,
  mermaidKindName,
  splitMermaidTitle,
} from "./mermaid-source.ts";
import { MERMAID_ATTRIBUTE } from "./parts/code-block.ts";
import { renderDiagramFrame } from "./parts/diagram.ts";
import { renderEmbed } from "./parts/embed.ts";
import { bundledIconNode } from "./parts/icons.ts";
import { renderMermaidDiagram } from "./parts/mermaid.ts";
import { renderNotice } from "./parts/notice.ts";
import { renderSyntaxWarning } from "./parts/syntax-warning.ts";

/** `import()` で読み込んだ mermaid の ES モジュールが既定のエクスポートで持つ構造 */
export type MermaidModule = {
  /** ページの中で 1 つの mermaid の設定を置き換える */
  initialize: (config: Record<string, unknown>) => void;
  /** ソースを SVG の文字列にする。解釈できないソースは例外で拒否する */
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

/** ガントチャートを描く幅の下限（px）。目盛りの日付が重ならない幅 */
export const MERMAID_GANTT_MIN_WIDTH = 720;

/** mermaid の図を開いたときの倍率の下限。これより縮めると小さい文字が読み込めないため、収まらない分は枠の中で動かす */
export const MERMAID_MIN_FIT = 0.75;

/** 暗い配色とみなす地の色の明るさの上限（0〜1） */
const DARK_LUMINANCE = 0.5;

/** 明暗の class（`src/index.css` と同じ名前） */
const DARK_CLASS = "mdmark-theme-dark";
const LIGHT_CLASS = "mdmark-theme-light";

/** `setEmbeddedMermaid` が入れる、同じスクリプトにまとめた mermaid のモジュール。`undefined` なら `mermaid.url` から読み込む。ページの中の全ての `mount` に有効になる */
export let embeddedMermaid: { default?: unknown } | undefined;

/** 埋めた mermaid のモジュールを置き換える。`undefined` で `mermaid.url` から読み込む構造に戻す */
export const setEmbeddedMermaid = (
  module: { default?: unknown } | undefined,
): void => {
  embeddedMermaid = module;
};

/** `initialize` と `render` の組を 1 つずつ実行する鎖。mermaid の設定はページの中で 1 つのため、描画を重ねない */
let renderQueue: Promise<unknown> = Promise.resolve();

/** `render` に指定する id の通し番号 */
let drawCount = 0;

/** 既定の読み込み: 動的 `import()` */
const importByUrl: SyntaxImport = (url) => import(/* @vite-ignore */ url);

/** 既定のエクスポートが mermaid の構造か */
const isMermaidModule = (value: unknown): value is MermaidModule =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as MermaidModule).initialize === "function" &&
  typeof (value as MermaidModule).render === "function";

/** HTML の最初の要素を作る */
const elementFromHtml = (html: string): HTMLElement => {
  const template = document.createElement("template");
  template.innerHTML = html;
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error(`要素を作れません: ${html.slice(0, 40)}`);
  }
  return element;
};

/** 計算済みの色の rgb()・rgba() */
const RGB = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/;

/** 1×1 の canvas の描画の文脈（色の記載方法を sRGB に変える） */
let canvasContext: CanvasRenderingContext2D | null | undefined;

/** 色の値を canvas に塗って RGBA の並びにする */
const paintedChannels = (color: string): number[] => {
  if (canvasContext === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvasContext = canvas.getContext("2d", {
      colorSpace: "srgb",
      willReadFrequently: true,
    });
  }
  if (!canvasContext) {
    throw new Error("canvas の描画の文脈を作れません");
  }
  canvasContext.clearRect(0, 0, 1, 1);
  canvasContext.fillStyle = color;
  canvasContext.fillRect(0, 0, 1, 1);
  return [...canvasContext.getImageData(0, 0, 1, 1).data];
};

/** 0〜255 を 2 桁の 16 進にする */
const hex2 = (value: number): string =>
  Math.round(value).toString(16).padStart(2, "0");

/** `scope` の中に試しの要素を配置して CSS 変数の計算済みの色を読み込み、sRGB の hex にする。`rgb()`・`rgba()` は値を読み込み、ほかの記載方法は canvas で変換する */
export const cssColorToHex = (options: {
  scope: HTMLElement;
  name: string;
}): string => {
  const { scope, name } = options;
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  scope.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const rgb = RGB.exec(computed);
  const [r = 0, g = 0, b = 0, a = 255] = rgb
    ? [
        Number(rgb[1]),
        Number(rgb[2]),
        Number(rgb[3]),
        rgb[4] === undefined ? 255 : Number(rgb[4]) * 255,
      ]
    : paintedChannels(computed);
  const alpha = Math.round(a);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${alpha === 255 ? "" : hex2(alpha)}`;
};

/** テーマ `mdmark` なら描く先の CSS 変数から mermaid の `base` テーマの変数を作り、設定の `themeVariables` と固定の変数を重ねる */
export const mermaidThemeVariables = (options: {
  scope: HTMLElement;
  config: ResolvedConfig["mermaid"];
}): Record<string, string | boolean> => {
  const { scope, config } = options;
  const base: Record<string, string | boolean> = {};
  if (config.theme === "mdmark") {
    for (const [key, name] of Object.entries(MERMAID_THEME_COLORS)) {
      base[key] = cssColorToHex({ scope, name });
    }
    const style = getComputedStyle(scope);
    base.fontFamily = style.getPropertyValue("--mdmark-font-body").trim();
    base.fontSize = style.fontSize;
    // 円グラフの扇形を、凡例と同じ不透明な系列の色で塗る
    base.pieOpacity = "1";
  }
  return {
    ...base,
    ...config.themeVariables,
    ...MERMAID_FIXED_THEME_VARIABLES,
  };
};

/** 描く先の地の色が暗いか */
const isDark = (scope: HTMLElement): boolean => {
  const hex = cssColorToHex({ scope, name: "--mdmark-color-bg" });
  const [r, g, b] = [1, 3, 5].map((at) =>
    Number.parseInt(hex.slice(at, at + 2), 16),
  );
  const luminance =
    (0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0)) / 255;
  return luminance < DARK_LUMINANCE;
};

/** 同じタスクの中で描く先の明暗の class を明るい配色にしてテーマの変数を作り、元に戻す */
const lightThemeVariables = (
  scope: HTMLElement,
  config: ResolvedConfig["mermaid"],
): Record<string, string | boolean> => {
  const hadDark = scope.classList.contains(DARK_CLASS);
  const hadLight = scope.classList.contains(LIGHT_CLASS);
  scope.classList.remove(DARK_CLASS);
  scope.classList.add(LIGHT_CLASS);
  try {
    return mermaidThemeVariables({ scope, config });
  } finally {
    if (!hadLight) {
      scope.classList.remove(LIGHT_CLASS);
    }
    if (hadDark) {
      scope.classList.add(DARK_CLASS);
    }
  }
};

/** 描画の鎖につなぐ */
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = renderQueue.then(task, task);
  renderQueue = next.catch(() => undefined);
  return next;
};

/** 属性の数を読み込む（無ければ `undefined`） */
const numberAttribute = (
  element: Element,
  name: string,
): number | undefined => {
  const value = element.getAttribute(name);
  if (value === null) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/** 人の形のまとまりの、頭の円と手足の線を囲む枠（無ければ `undefined`） */
const actorBox = (
  group: Element,
): { left: number; top: number; width: number; height: number } | undefined => {
  const head = group.querySelector("circle");
  if (!head) {
    return undefined;
  }
  const cx = numberAttribute(head, "cx") ?? 0;
  const cy = numberAttribute(head, "cy") ?? 0;
  const r = numberAttribute(head, "r") ?? 0;
  const lines = [...group.querySelectorAll("line")];
  /** 線の座標の属性の値（無い属性を除く） */
  const valuesOf = (names: string[]): number[] =>
    lines.flatMap((line) =>
      names.flatMap((name) => numberAttribute(line, name) ?? []),
    );
  const xs = [cx - r, cx + r, ...valuesOf(["x1", "x2"])];
  const ys = [cy - r, cy + r, ...valuesOf(["y1", "y2"])];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
};

/** SVG の `g.actor-man` の棒人間を、子の属性から求めたノードの中央の lucide の `user` のアイコンに替える */
export const replaceMermaidActors = (svg: SVGSVGElement): void => {
  const node = bundledIconNode("user");
  if (!node) {
    throw new Error("lucide の user のアイコンをまとめていません");
  }
  const icon = node
    .map(([tag, attributes]) => {
      const attrs = Object.entries(attributes)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join("");
      return `<${tag}${attrs}></${tag}>`;
    })
    .join("");
  for (const group of svg.querySelectorAll("g.actor-man")) {
    const box = actorBox(group);
    if (!box) {
      continue;
    }
    const { left, top, width, height } = box;
    const size = Math.min(width, height);
    for (const child of [...group.children]) {
      if (child.tagName.toLowerCase() !== "text") {
        child.remove();
      }
    }
    group.insertAdjacentHTML(
      "afterbegin",
      `<svg class="mdmark-mermaid-actor" x="${left + (width - size) / 2}" y="${top}" width="${size}" height="${size}" viewBox="0 0 24 24">${icon}</svg>`,
    );
  }
};

/** mermaid が返却した SVG の文字を、actor のアイコンを替え、大きさを `viewBox` にそろえた SVG の文字にする */
const finishSvg = (
  svg: string,
): { svg: string; width: number; height: number } => {
  const holder = document.createElement("div");
  holder.innerHTML = svg;
  const element = holder.querySelector("svg");
  if (!element) {
    throw new Error("mermaid が SVG を返却しませんでした");
  }
  replaceMermaidActors(element);
  const box = element.viewBox.baseVal;
  const width = box?.width || numberAttribute(element, "width") || 0;
  const height = box?.height || numberAttribute(element, "height") || 0;
  element.setAttribute("width", String(width));
  element.setAttribute("height", String(height));
  element.removeAttribute("style");
  return { svg: element.outerHTML, width, height };
};

/** mermaid の例外の `message` の 1 行目 */
const firstLine = (error: unknown): string =>
  String(error instanceof Error ? error.message : error)
    .split("\n")[0]
    ?.trim() ?? "";

/** 1 つのソースを、今の配色と（暗い配色なら）明るい配色のテーマで描き、図の枠の HTML を返却する。解釈できなければ例外のメッセージの 1 行目を返却する */
export const drawMermaidDiagram = async (options: {
  mermaid: MermaidModule;
  source: string;
  root: HTMLElement;
  scope: HTMLElement;
  config: ResolvedConfig["mermaid"];
  id: string;
  frameId: string;
  /** 表示する枠の右下にリサイズハンドルを配置するか（既定 `true`） */
  resizable?: boolean;
}): Promise<{ html: string } | { error: string }> => {
  const { mermaid, source, root, scope, config, id, frameId } = options;
  const { title, body, kind } = splitMermaidTitle(source);
  const heading = title ?? mermaidKindName(kind);
  const variables = mermaidThemeVariables({ scope, config });
  const light = isDark(scope) ? lightThemeVariables(scope, config) : undefined;
  const theme = config.theme === "mdmark" ? "base" : config.theme;
  const useWidth = Math.max(root.clientWidth, MERMAID_GANTT_MIN_WIDTH);
  const renderWith = async (
    themeVariables: Record<string, string | boolean>,
    renderId: string,
  ): Promise<string> => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      themeVariables,
      gantt: { useWidth },
    });
    const { svg } = await mermaid.render(renderId, body);
    return svg;
  };
  try {
    const [screen, print] = await enqueue(async () => [
      await renderWith(variables, id),
      light === undefined ? undefined : await renderWith(light, `${id}-print`),
    ]);
    const drawn = finishSvg(screen);
    const printed = print === undefined ? undefined : finishSvg(print);
    const part = renderMermaidDiagram({
      svg: drawn.svg,
      printSvg: printed?.svg,
      width: drawn.width,
      height: drawn.height,
    });
    const html = renderDiagramFrame(
      {
        kind: "mermaid",
        title: heading,
        legend: [],
        fitMin: MERMAID_MIN_FIT,
        resizable: options.resizable ?? true,
        id: frameId,
      },
      part,
    );
    return { html };
  } catch (error) {
    // mermaid が文書に残すエラーの図を削除する
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(`d${id}-print`)?.remove();
    return { error: firstLine(error) };
  }
};

/** 描く対象の 1 つ: 元のコードブロック・ソース・今その場所に配置している要素 */
type MermaidTarget = {
  block: HTMLElement;
  source: string;
  current: HTMLElement;
};

/** `root` の中の mermaid のコードブロックを読み込み中のブロックに替えて mermaid を読み込み、図の枠に置き換えて図の操作を付ける。配色の明暗が変わったら再描画する */
export const attachMermaid = (options: {
  root: HTMLElement;
  scope: HTMLElement;
  config: ResolvedConfig;
  mountId: number;
  isCurrent: () => boolean;
  modules: Map<string, Promise<{ default?: unknown }>>;
  placement: TooltipPlacement;
  importModule?: SyntaxImport;
}): { ready: Promise<void>; detach: () => void } => {
  const {
    root,
    scope,
    config,
    mountId,
    isCurrent,
    modules,
    placement,
    importModule = importByUrl,
  } = options;
  const blocks = [
    ...root.querySelectorAll<HTMLElement>(`[${MERMAID_ATTRIBUTE}]`),
  ];
  if (blocks.length === 0) {
    return { ready: Promise.resolve(), detach: () => {} };
  }
  const targets: MermaidTarget[] = blocks.map((block) => {
    const source =
      block.querySelector("code")?.textContent ?? block.textContent ?? "";
    const loading = elementFromHtml(renderEmbed({ name: "mermaid" }));
    block.before(loading);
    block.hidden = true;
    return { block, source, current: loading };
  });
  let detached = false;
  let generation = 0;
  let detachDiagrams = (): void => {};
  let detachWatch = (): void => {};
  const live = (): boolean => !detached && isCurrent();

  /** mermaid のモジュールを決める。読み込めなければ `undefined` */
  const loadMermaid = async (): Promise<MermaidModule | undefined> => {
    if (embeddedMermaid !== undefined) {
      const embedded = embeddedMermaid.default;
      return isMermaidModule(embedded) ? embedded : undefined;
    }
    const url = new URL(config.mermaid.url, document.baseURI).href;
    let pending = modules.get(url);
    if (!pending) {
      pending = importModule(url);
      modules.set(url, pending);
    }
    try {
      const loaded = (await pending).default;
      if (isMermaidModule(loaded)) {
        return loaded;
      }
      console.error(
        "mermaid を読み込めません:",
        url,
        new Error("既定のエクスポートが initialize と render を持ちません"),
      );
    } catch (error) {
      console.error("mermaid を読み込めません:", url, error);
    }
    return undefined;
  };

  /** 全ての対象を描き、描けた図に操作を付ける */
  const drawAll = async (mermaid: MermaidModule): Promise<void> => {
    generation += 1;
    const mine = generation;
    const figures: HTMLElement[] = [];
    const placed: Array<{
      target: MermaidTarget;
      element: HTMLElement;
      ok: boolean;
    }> = [];
    for (const target of targets) {
      drawCount += 1;
      const result = await drawMermaidDiagram({
        mermaid,
        source: target.source,
        root,
        scope,
        config: config.mermaid,
        id: `mdmark-mermaid-${mountId}-${drawCount}`,
        frameId: `mdmark-mermaid-frame-${mountId}-${drawCount}`,
        resizable: config.features["diagram-resize"] !== false,
      });
      if (!live() || mine !== generation) {
        return;
      }
      placed.push(
        "html" in result
          ? { target, element: elementFromHtml(result.html), ok: true }
          : {
              target,
              element: elementFromHtml(
                renderSyntaxWarning({
                  message: `mermaid の図を描けません（${result.error}）。コードブロックのまま表示しています。`,
                }),
              ),
              ok: false,
            },
      );
    }
    detachDiagrams();
    for (const { target, element, ok } of placed) {
      target.current.replaceWith(element);
      target.current = element;
      if (ok) {
        target.block.remove();
        figures.push(element);
      } else {
        element.after(target.block);
        target.block.hidden = false;
      }
    }
    detachDiagrams =
      figures.length > 0
        ? attachDiagrams({ root, placement, figures })
        : () => {};
  };

  /** 配色の明暗の変化を確認して、テーマの変数が変わったら再描画する */
  const watch = (mermaid: MermaidModule): void => {
    let last = JSON.stringify(
      mermaidThemeVariables({ scope, config: config.mermaid }),
    );
    const onChange = (): void => {
      if (!live()) {
        return;
      }
      const next = JSON.stringify(
        mermaidThemeVariables({ scope, config: config.mermaid }),
      );
      if (next === last) {
        return;
      }
      last = next;
      void drawAll(mermaid);
    };
    const observer = new MutationObserver(onChange);
    for (
      let ancestor = scope.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onChange);
    detachWatch = () => {
      observer.disconnect();
      media.removeEventListener("change", onChange);
    };
  };

  const ready = (async () => {
    const mermaid = await loadMermaid();
    if (!live()) {
      return;
    }
    if (!mermaid) {
      for (const target of targets) {
        const notice = elementFromHtml(
          renderNotice({ name: "mermaid", figure: true }),
        );
        target.current.replaceWith(notice);
        target.current = notice;
        target.block.hidden = false;
      }
      return;
    }
    await drawAll(mermaid);
    if (live()) {
      watch(mermaid);
    }
  })();

  return {
    ready,
    detach: () => {
      detached = true;
      detachWatch();
      detachDiagrams();
    },
  };
};
