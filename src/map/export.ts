/** 書き出す図の形式 */
export type MapExportFormat = "svg" | "png";

/** 書き出した SVG と等倍の大きさ */
export type MapExportImage = { svg: string; width: number; height: number };

/** ファイル名に使用できない文字 */
const FORBIDDEN_CHARS_RE = /[\\/:*?"<>|]/g;

/** PNG にするときの倍率 */
const PNG_SCALE = 2;

/** PNG にできないときに「SVG」「PNG」の要素に出す文 */
const PNG_UNAVAILABLE_MESSAGE =
  "この大きさの図は PNG にできません。SVG で書き出してください。";

/** 複製から除く要素（パネル・リサイズハンドル・ツールチップとそのマーカー・記載の警告・当たり判定・データの印） */
const EXCLUDED_SELECTOR = [
  ".mdmark-diagram-tools",
  ".mdmark-diagram-export",
  ".mdmark-diagram-resize",
  ".mdmark-diagram-tip",
  ".mdmark-diagram-info",
  ".mdmark-hint-mark",
  ".mdmark-syntax-warning",
  ".map-wire-hit",
  ".map-wire-hits",
  ".map-lifeline-hit",
  ".mdmark-diagram-node-hit",
  ".map-packets",
].join(",");

/** 選択の強調を表す class（書き出しの間だけ元の要素から除外する） */
const SELECTION_CLASSES = ["is-selected", "map-dim"];

/** 書き出しの間、元の図の遷移とアニメーションを止める class */
const CAPTURING_CLASS = "mdmark-map-exporting";

/** 継承するプロパティ（`font-`・`text-`（装飾を除く）・`stroke`・`fill` で始まるものを含む） */
const INHERITED_PROPERTIES = new Set([
  "color",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "white-space",
  "word-break",
  "overflow-wrap",
  "visibility",
  "cursor",
  "direction",
  "writing-mode",
  "hyphens",
  "tab-size",
  "list-style-type",
  "list-style-position",
  "list-style-image",
  "quotes",
  "caret-color",
  "paint-order",
  "dominant-baseline",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "-webkit-text-stroke-width",
]);

/** プロパティが継承するか */
const isInherited = (name: string): boolean =>
  INHERITED_PROPERTIES.has(name) ||
  name.startsWith("font-") ||
  (name.startsWith("text-") && !name.startsWith("text-decoration")) ||
  name.startsWith("stroke") ||
  name.startsWith("fill");

/** 図の枠のタイトル（無ければ `図 {番号}`）に拡張子を付け、使用できない文字を `_` にしたファイル名を返却する */
export const mapExportFileName = (options: {
  title: string | undefined;
  index: number;
  format: MapExportFormat;
}): string => {
  const { title, index, format } = options;
  const base =
    title === undefined || title.trim() === "" ? `図 ${index}` : title;
  return `${base.replace(FORBIDDEN_CHARS_RE, "_")}.${format}`;
};

/** ページの CSS が当たらない文書での、要素名ごとの既定の計算したスタイル */
type DefaultStyles = {
  of: (element: Element) => CSSStyleDeclaration;
  dispose: () => void;
};

/** 画面に出さない `iframe` を配置し、要素名ごとの既定の計算したスタイルを 1 度だけ求める */
const createDefaultStyles = (): DefaultStyles => {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:10px;height:10px;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentDocument as Document;
  const view = frame.contentWindow as Window;
  const svgRoot = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  doc.body.append(svgRoot);
  const cache = new Map<string, CSSStyleDeclaration>();
  const of = (element: Element) => {
    const key = `${element.namespaceURI}|${element.localName}`;
    const known = cache.get(key);
    if (known !== undefined) return known;
    const sample = doc.createElementNS(element.namespaceURI, element.localName);
    (element.namespaceURI === svgRoot.namespaceURI ? svgRoot : doc.body).append(
      sample,
    );
    const style = view.getComputedStyle(sample);
    cache.set(key, style);
    return style;
  };
  return { of, dispose: () => frame.remove() };
};

/** 計算した値の `url()` を、図の中の `#` を指すものは `url('#…')`（属性の中で逃がされない引用符）に戻し、外を指すものがあれば undefined にする */
const localUrls = (value: string): string | undefined => {
  if (!value.includes("url(")) return value;
  let external = false;
  const out = value.replace(
    /url\(\s*(["']?)([^"')]*)\1\s*\)/g,
    (_all, _quote, target: string) => {
      const hash = target.indexOf("#");
      if (target.startsWith("data:")) return `url('${target}')`;
      if (hash < 0) {
        external = true;
        return "";
      }
      return `url('${target.slice(hash)}')`;
    },
  );
  return external ? undefined : out;
};

/** 元の計算したスタイルのうち、比べる値と異なるものを `style` 属性の文字にする（外を指す `url()` を持つプロパティは書き写さない） */
const differingStyle = (
  style: CSSStyleDeclaration,
  compare: (name: string) => string,
): string => {
  const out: string[] = [];
  for (let i = 0; i < style.length; i += 1) {
    const name = style.item(i);
    if (name.startsWith("--")) continue;
    const value = style.getPropertyValue(name);
    if (value === compare(name)) continue;
    const local = localUrls(value);
    if (local !== undefined) out.push(`${name}:${local}`);
  }
  return out.join(";");
};

/** 疑似要素の計算したスタイルを書き写した `span`（`content` が無ければ undefined） */
const pseudoSpan = (
  original: Element,
  pseudo: "::before" | "::after",
  context: { parent: CSSStyleDeclaration; defaults: DefaultStyles },
): HTMLSpanElement | undefined => {
  const style = getComputedStyle(original, pseudo);
  const content = style.getPropertyValue("content");
  if (content === "none" || content === "normal" || content === "") {
    return undefined;
  }
  const span = document.createElement("span");
  const text = /^"(.*)"$/s.exec(content)?.[1] ?? "";
  span.textContent = text.replace(/\\"/g, '"');
  const base = context.defaults.of(span);
  span.setAttribute(
    "style",
    differingStyle(style, (name) =>
      name === "content"
        ? content
        : isInherited(name)
          ? context.parent.getPropertyValue(name)
          : base.getPropertyValue(name),
    ),
  );
  return span;
};

/** 元の要素と複製の要素の組を、親から順に計算したスタイルで書き写す */
const copyStyles = (
  pair: { original: Element; copy: Element; root: boolean },
  defaults: DefaultStyles,
): void => {
  const { original, copy, root } = pair;
  const style = getComputedStyle(original);
  const base = defaults.of(original);
  const parent =
    root || original.parentElement === null
      ? base
      : getComputedStyle(original.parentElement);
  copy.setAttribute(
    "style",
    differingStyle(style, (name) =>
      isInherited(name) && !root
        ? parent.getPropertyValue(name)
        : base.getPropertyValue(name),
    ),
  );
  const context = { parent: style, defaults };
  const before = pseudoSpan(original, "::before", context);
  const after = pseudoSpan(original, "::after", context);
  const originals = [...original.children];
  const copies = [...copy.children];
  originals.forEach((child, index) => {
    const target = copies[index];
    if (target !== undefined)
      copyStyles({ original: child, copy: target, root: false }, defaults);
  });
  if (before !== undefined) copy.prepend(before);
  if (after !== undefined) copy.append(after);
};

/** 書き出さない要素か（除く要素・`display: none`） */
const isExcluded = (element: Element): boolean =>
  element.matches(EXCLUDED_SELECTOR) ||
  getComputedStyle(element).display === "none";

/** 除く要素に除外の目印を付けた複製を作る（元の要素は触らない） */
const prunedClone = (stage: HTMLElement): { copy: HTMLElement } => {
  const copy = stage.cloneNode(true) as HTMLElement;
  const walk = (original: Element, target: Element) => {
    const originals = [...original.children];
    const copies = [...target.children];
    originals.forEach((child, index) => {
      const twin = copies[index];
      if (twin === undefined) return;
      if (isExcluded(child)) twin.setAttribute("data-mdmark-export-drop", "");
      else walk(child, twin);
    });
  };
  walk(stage, copy);
  return { copy };
};

/** 書き出す SVG に残さない属性の名前 */
const DROPPED_ATTRIBUTES = new Set(["class", "role", "tabindex", "title"]);

/** 資源を指す属性の名前 */
const RESOURCE_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);

/** 複製から除く属性か（目印・読み上げの属性、値に `var(` を持つ属性、図の中の `#` と `data:` のほかを指す資源の属性） */
const isDroppedAttribute = (attribute: Attr): boolean => {
  const { name, value } = attribute;
  if (DROPPED_ATTRIBUTES.has(name) || value.includes("var(")) return true;
  if (name.startsWith("data-") || name.startsWith("aria-")) return true;
  return (
    RESOURCE_ATTRIBUTES.has(name) &&
    !value.startsWith("#") &&
    !value.startsWith("data:")
  );
};

/** 複製から、除外の目印の要素と除く属性を除く */
const cleanUp = (copy: Element): void => {
  for (const element of copy.querySelectorAll("[data-mdmark-export-drop]"))
    element.remove();
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes])
      if (isDroppedAttribute(attribute))
        element.removeAttribute(attribute.name);
  }
};

/** 選択の強調を書き出しの間だけ元の要素から除外し、戻す関数を返却する */
const suspendSelection = (stage: HTMLElement): (() => void) => {
  const selected = [...stage.querySelectorAll("[data-selected]")];
  for (const element of selected) element.removeAttribute("data-selected");
  const classed = SELECTION_CLASSES.flatMap((name) =>
    [...stage.getElementsByClassName(name)].map(
      (element) => [element, name] as const,
    ),
  );
  for (const [element, name] of classed) element.classList.remove(name);
  stage.classList.add(CAPTURING_CLASS);
  return () => {
    stage.classList.remove(CAPTURING_CLASS);
    for (const element of selected) element.setAttribute("data-selected", "");
    for (const [element, name] of classed) element.classList.add(name);
  };
};

/** 図の枠の背景の色（透明なら白） */
const backgroundOf = (stage: HTMLElement): string => {
  let element: HTMLElement | null = stage;
  while (element !== null) {
    const color = getComputedStyle(element).backgroundColor;
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
    element = element.parentElement;
  }
  return "#fff";
};

/** 表示する枠の中の図を、計算したスタイルを書き写した DOM を `foreignObject` に入れた、外部の資源を持たない SVG の文字にする */
export const exportMapSvg = (stage: HTMLElement): MapExportImage => {
  const width = stage.offsetWidth;
  const height = stage.offsetHeight;
  const restore = suspendSelection(stage);
  const defaults = createDefaultStyles();
  let copy: HTMLElement;
  try {
    copy = prunedClone(stage).copy;
    copyStyles({ original: stage, copy, root: true }, defaults);
  } finally {
    defaults.dispose();
    restore();
  }
  cleanUp(copy);
  copy.style.transform = "none";
  copy.style.position = "relative";
  copy.style.left = "0";
  copy.style.top = "0";
  copy.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const body = new XMLSerializer().serializeToString(copy);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${backgroundOf(stage)}"/><foreignObject x="0" y="0" width="${width}" height="${height}">${body}</foreignObject></svg>`;
  return { svg, width, height };
};

/** SVG の文字を画像として読み込む */
const loadImage = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG を画像として読み込めません"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

/** SVG を幅・高さが 2 倍の PNG の Blob にする（作れなければ null） */
export const exportMapPng = async (
  image: MapExportImage,
): Promise<Blob | null> => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width * PNG_SCALE;
  canvas.height = image.height * PNG_SCALE;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  try {
    const loaded = await loadImage(image.svg);
    context.drawImage(loaded, 0, 0, canvas.width, canvas.height);
  } catch {
    // 読み込みか描画ができない大きさ・内容の図は PNG にしない
    return null;
  }
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
};

/** Blob をファイル名でブラウザに保存させる */
const save = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

/** 範囲の図の枠の書き出すボタンに、「SVG」「PNG」の要素の開閉と保存を付け、片付ける関数を返却する */
export const attachMapExport = (
  range: HTMLElement,
  options: { index: number; title: () => string | undefined },
): (() => void) => {
  const button = () =>
    range.querySelector<HTMLButtonElement>('[data-tool="export"]');
  const panel = () =>
    range.querySelector<HTMLElement>(".mdmark-diagram-export");
  const status = () =>
    panel()?.querySelector<HTMLElement>('[role="status"]') ?? null;
  const setOpen = (open: boolean) => {
    const element = panel();
    if (element === null) return;
    element.hidden = !open;
    button()?.setAttribute("aria-expanded", String(open));
    if (!open) {
      const message = status();
      if (message !== null) message.textContent = "";
    }
  };
  const isOpen = () => panel()?.hidden === false;
  const fileName = (format: MapExportFormat) =>
    mapExportFileName({ title: options.title(), index: options.index, format });
  const stage = () => range.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const exportAs = async (format: MapExportFormat) => {
    const element = stage();
    if (element === null) return;
    const image = exportMapSvg(element);
    if (format === "svg") {
      save(new Blob([image.svg], { type: "image/svg+xml" }), fileName("svg"));
      setOpen(false);
      return;
    }
    const blob = await exportMapPng(image);
    if (blob === null) {
      const message = status();
      if (message !== null) message.textContent = PNG_UNAVAILABLE_MESSAGE;
      return;
    }
    save(blob, fileName("png"));
    setOpen(false);
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-tool="export"]') !== null) {
      setOpen(!isOpen());
      return;
    }
    const item = target.closest<HTMLElement>("[data-export]");
    const format = item?.dataset.export;
    if (format === "svg" || format === "png") void exportAs(format);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    button()?.focus();
  };
  const onPointer = (event: PointerEvent) => {
    if (!isOpen()) return;
    const target = event.target as Node;
    if (panel()?.contains(target) || button()?.contains(target)) return;
    setOpen(false);
  };
  range.addEventListener("click", onClick);
  range.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onPointer);
  return () => {
    range.removeEventListener("click", onClick);
    range.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onPointer);
  };
};
