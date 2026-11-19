import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import serialize from "dom-serializer";
import type { AnyNode, Element } from "domhandler";
import { isTag, isText } from "domhandler";
import { parseDocument } from "htmlparser2";
import postcss, { type AtRule, type ChildNode, type Rule } from "postcss";
import type { MdmarkFigure } from "../markdown/pure-markdown.ts";

/** sanitize が小文字にした SVG の属性の名前を、XML の大文字小文字に戻す表 */
const SVG_ATTRIBUTES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "viewBox",
    "patternUnits",
    "patternContentUnits",
    "patternTransform",
    "preserveAspectRatio",
    "gradientUnits",
    "gradientTransform",
    "markerWidth",
    "markerHeight",
    "markerUnits",
    "refX",
    "refY",
    "textLength",
    "lengthAdjust",
    "stdDeviation",
    "clipPathUnits",
  ].map((name) => [name.toLowerCase(), name]),
);

/** 図から書き出さない要素の class（パネル・高さのハンドル・ツールチップ） */
const DROP_CLASSES = [
  "mdmark-diagram-tools",
  "mdmark-diagram-resize",
  "mdmark-diagram-tip",
];

/** 画像の拡張子から MIME の種類 */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** 大きさの見積もりの文字の大きさ（px） */
const FONT = 14;

/** 大きさの見積もりの行の高さ（px） */
const LINE = FONT * 1.8;

/** 埋め込んだ HTML の幅の上限（px） */
const MAX_WIDTH = 760;

/** 半角の文字の幅の、全角の文字の幅に対する割合 */
const HALF_WIDTH_RATIO = 0.6;

/** 半角として幅を見積もる文字の符号位置の上限（Latin-1 の終わり） */
const LATIN1_LAST = 0xff;

/** 行内として横に並べる要素の名前 */
const INLINE_TAGS = new Set([
  "span",
  "b",
  "strong",
  "em",
  "code",
  "a",
  "img",
  "br",
]);

/** 背景の色（ライトの配色の本文の背景） */
const BACKGROUND = "#ffffff";

/** 平らにした CSS の規則 1 つ */
type FlatRule = { selectors: string[]; decls: string };

/** 大きさ（px） */
type Size = { w: number; h: number };

/** 範囲の CSS の class ごとの宣言 */
type ScopedDecls = Map<string, Record<string, string>>;

/** 入れ子の規則の選択子を、親の選択子に展開する */
function expandSelectors(rule: Rule, parents: string[]): string[] {
  if (parents.length === 0) {
    return rule.selectors;
  }
  return rule.selectors.flatMap((child) =>
    parents.map((parent) =>
      child.includes("&")
        ? child.replaceAll("&", parent)
        : `${parent} ${child}`,
    ),
  );
}

/** `@layer`・`@supports`・`@media screen` の中だけをたどる */
function descends(at: AtRule): boolean {
  return (
    at.name === "layer" ||
    at.name === "supports" ||
    (at.name === "media" && at.params.trim() === "screen")
  );
}

/** 入れ子の規則を平らな規則の並びにする（screen 以外の `@media`・`@keyframes`・`@container` は除く） */
function flatten(nodes: ChildNode[], parents: string[], out: FlatRule[]): void {
  for (const node of nodes) {
    if (node.type === "atrule") {
      if (descends(node)) {
        flatten(node.nodes ?? [], parents, out);
      }
      continue;
    }
    if (node.type !== "rule") {
      continue;
    }
    const selectors = expandSelectors(node, parents);
    const children = node.nodes ?? [];
    const decls = children
      .filter((child) => child.type === "decl")
      .map((child) => child.toString())
      .join(";");
    if (decls !== "") {
      out.push({ selectors, decls });
    }
    flatten(
      children.filter((child) => child.type !== "decl"),
      selectors,
      out,
    );
  }
}

/** 括弧の中（`:is`・`:not`・`:where`・`:has` の引数）と属性の選択子を除いた選択子 */
function stripParens(selector: string): string {
  let depth = 0;
  let out = "";
  for (const char of selector) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (depth === 0) {
      out += char;
    }
  }
  return out.replace(/\[[^\]]*\]/g, "");
}

/** 選択子の class と要素名が全て図にあるか。ライト以外の配色・別のテーマ・VS Code の選択子は適用しない */
function selectorApplies(options: {
  selector: string;
  classes: Set<string>;
  tags: Set<string>;
}): boolean {
  const { selector, classes, tags } = options;
  if (selector === ":root") {
    return true;
  }
  if (/mdmark-theme-|data-mdmark-color-theme|vscode-|^:root:/.test(selector)) {
    return false;
  }
  const bare = stripParens(selector);
  const classOk = [...bare.matchAll(/\.([\w-]+)/g)].every((match) =>
    classes.has(match[1] ?? ""),
  );
  const tagOk = [...bare.matchAll(/(?:^|[\s>+~])([a-z][a-z0-9-]*)/g)].every(
    (match) => tags.has(match[1] ?? ""),
  );
  return classOk && tagOk;
}

/** `:root` の宣言から CSS 変数の宣言を集める */
function collectRootVars(decls: string, into: Map<string, string>): void {
  for (const decl of decls.split(/;(?![^(]*\))/)) {
    const name = decl.slice(0, decl.indexOf(":")).trim();
    if (name.startsWith("--")) {
      into.set(name, decl);
    }
  }
}

/** 残した規則が参照する変数を、`:root` の定義からたどって集める */
function usedVars(kept: string, rootVars: Map<string, string>): string[] {
  const used = new Set<string>();
  const queue = [...kept.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] ?? "");
  while (queue.length > 0) {
    const name = queue.pop() ?? "";
    if (used.has(name)) {
      continue;
    }
    used.add(name);
    for (const m of (rootVars.get(name) ?? "").matchAll(/var\((--[\w-]+)/g)) {
      queue.push(m[1] ?? "");
    }
  }
  return [...used].flatMap((name) => rootVars.get(name) ?? []);
}

/** 配布物の CSS から、図の中にあるクラスとタグに該当する規則と、その規則が参照する明るい配色の CSS 変数だけを残す */
export function pruneCss(options: {
  /** 配布物の CSS */
  css: string;
  /** 図の中のクラス */
  classes: Set<string>;
  /** 図の中のタグ */
  tags: Set<string>;
}): string {
  const { css, classes, tags } = options;
  const rules: FlatRule[] = [];
  flatten(postcss.parse(css).nodes, [], rules);
  const kept: string[] = [];
  const rootVars = new Map<string, string>();
  for (const rule of rules) {
    const selectors = rule.selectors.filter((selector) =>
      selectorApplies({ selector: selector.trim(), classes, tags }),
    );
    if (selectors.length === 1 && selectors[0]?.trim() === ":root") {
      collectRootVars(rule.decls, rootVars);
    } else if (selectors.length > 0) {
      kept.push(`${selectors.join(",")}{${rule.decls}}`);
    }
  }
  const vars = usedVars(kept.join(""), rootVars).join(";");
  // 描く先の要素の余白・幅の上限・角丸は画像の中では要らないため打ち消す
  return `:root{${vars}}${kept.join("\n")}\n.mdmark{padding:0!important;max-width:none!important;border-radius:0!important}`;
}

/** 要素の class の並び */
function classesOf(element: Element): string[] {
  return (element.attribs.class ?? "").split(/\s+/).filter(Boolean);
}

/** 木の要素を順にたどる */
function walk(node: AnyNode, visit: (element: Element) => void): void {
  if (isTag(node)) {
    visit(node);
  }
  if ("children" in node) {
    for (const child of node.children) {
      walk(child, visit);
    }
  }
}

/** 条件に当たる要素を並べる */
function findAll(
  root: AnyNode,
  test: (element: Element) => boolean,
): Element[] {
  const found: Element[] = [];
  walk(root, (element) => {
    if (test(element)) {
      found.push(element);
    }
  });
  return found;
}

/** 要素の中の文字 */
function textOf(node: AnyNode): string {
  if (isText(node)) {
    return node.data;
  }
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** 要素を親から除く */
function removeNode(node: AnyNode): void {
  const parent = node.parent;
  if (parent !== null && "children" in parent) {
    parent.children = parent.children.filter((child) => child !== node);
  }
}

/** 図の中の class と要素名 */
function inventory(root: AnyNode): { classes: Set<string>; tags: Set<string> } {
  const classes = new Set<string>(["mdmark"]);
  const tags = new Set<string>(["svg", "div"]);
  walk(root, (element) => {
    tags.add(element.name);
    for (const name of classesOf(element)) {
      classes.add(name);
    }
  });
  return { classes, tags };
}

/** XML として直列化する。SVG の属性の大文字小文字を戻し、`svg` に名前空間を付ける */
function toXml(node: AnyNode): string {
  walk(node, (element) => {
    if (element.name === "svg") {
      element.attribs.xmlns = "http://www.w3.org/2000/svg";
    }
    for (const [lower, name] of Object.entries(SVG_ATTRIBUTES)) {
      const value = element.attribs[lower];
      if (value !== undefined) {
        delete element.attribs[lower];
        element.attribs[name] = value;
      }
    }
  });
  return serialize(node, {
    xmlMode: true,
    selfClosingTags: true,
    decodeEntities: true,
  });
}

/** 背景の矩形と style 要素を持つ SVG の文字列 */
function svgFile(options: {
  width: number;
  height: number;
  css: string;
  body: string;
}): string {
  const { width, height, css, body } = options;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>${css}</style><rect width="100%" height="100%" fill="${BACKGROUND}"/>${body}</svg>`;
}

/** グラフの svg の幅と高さ。属性が無ければ `viewBox` から参照する */
function svgSize(svg: Element): Size {
  const box = (svg.attribs.viewbox ?? svg.attribs.viewBox ?? "")
    .split(/[\s,]+/)
    .map(Number);
  const w = Number(svg.attribs.width ?? box[2] ?? 0);
  const h = Number(svg.attribs.height ?? box[3] ?? 0);
  return { w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
}

/** `chart`・`param` の図から、グラフの svg を取り出して SVG にする */
function chartToSvg(root: AnyNode, css: string): string {
  const svgs = findAll(root, (e) => e.name === "svg");
  const wires =
    svgs.find((e) => classesOf(e).includes("mdmark-diagram-wires")) ?? svgs[0];
  if (wires === undefined) {
    return svgFile({ width: 0, height: 0, css: "", body: "" });
  }
  const { classes, tags } = inventory(wires);
  classes.add("mdmark-diagram");
  tags.add("figure");
  const { w, h } = svgSize(wires);
  const body = `<g class="mdmark"><g class="mdmark-diagram" data-diagram="chart">${toXml(wires)}</g></g>`;
  return svgFile({
    width: w,
    height: h,
    css: pruneCss({ css, classes, tags }),
    body,
  });
}

/** PNG の幅と高さ。PNG でなければ `undefined` */
function pngSize(buffer: Buffer): Size | undefined {
  const signature = buffer.subarray(1, 4).toString("ascii");
  return signature === "PNG" && buffer.length >= 24
    ? { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) }
    : undefined;
}

/** 画像 1 つを `data:` の URL にする。外部の画像・文書のフォルダの外部の画像・読み込めない画像は除いて警告を返却する */
async function embedImage(img: Element, baseDir: string): Promise<string[]> {
  const src = img.attribs.src ?? "";
  if (src.startsWith("data:")) {
    return [];
  }
  const file = resolve(baseDir, decodeURI(src));
  const type = IMAGE_TYPES[extname(file).toLowerCase()];
  const inside = !relative(baseDir, file).startsWith("..");
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || !inside || type === undefined) {
    removeNode(img);
    return [`外部の画像 ${src} は書き出せないため取り除きました`];
  }
  const buffer = await readFile(file).catch(() => undefined);
  if (buffer === undefined) {
    removeNode(img);
    return [`画像 ${src} を読み込めないため取り除きました`];
  }
  img.attribs.src = `data:${type};base64,${buffer.toString("base64")}`;
  const size = pngSize(buffer);
  if (size !== undefined) {
    img.attribs.width ??= String(size.w);
    img.attribs.height ??= String(size.h);
  }
  return [];
}

/** 範囲のスクリプト・パネル・ハンドル・ツールチップを除き、画像を `data:` の URL にする */
async function prepareHtml(root: AnyNode, baseDir: string): Promise<string[]> {
  for (const element of findAll(
    root,
    (e) =>
      e.name === "template" ||
      e.name === "script" ||
      DROP_CLASSES.some((name) => classesOf(e).includes(name)),
  )) {
    removeNode(element);
  }
  const warnings: string[] = [];
  for (const img of findAll(root, (e) => e.name === "img")) {
    warnings.push(...(await embedImage(img, baseDir)));
  }
  return warnings;
}

/** 文字の幅（全角 1em・半角 0.6em） */
function textWidth(text: string): number {
  let width = 0;
  for (const char of text.replace(/\s+/g, " ")) {
    width +=
      (char.codePointAt(0) ?? 0) <= LATIN1_LAST
        ? FONT * HALF_WIDTH_RATIO
        : FONT;
  }
  return width;
}

/** 表の大きさ */
function estimateTable(table: Element): Size {
  const rows = findAll(table, (e) => e.name === "tr");
  const columns: number[] = [];
  for (const row of rows) {
    row.children.filter(isTag).forEach((cell, index) => {
      const bold = cell.name === "th" ? 1.05 : 1;
      const width =
        Math.max(FONT * 6, textWidth(textOf(cell).trim()) * bold) +
        FONT * 1.8 +
        1;
      columns[index] = Math.max(columns[index] ?? 0, width);
    });
  }
  return {
    w: columns.reduce((a, b) => a + b, 0) + 2,
    h: rows.length * (LINE + FONT * 0.9 + 1) + 1,
  };
}

/** CSS の宣言の並びを、名前から値の表にする */
function parseDecls(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(";")
      .map((decl) => decl.split(":").map((part) => part.trim()))
      .filter((pair) => pair.length === 2 && pair[0] !== "")
      .map(([name = "", value = ""]) => [name, value]),
  );
}

/** 範囲の CSS から、最後が class 1 つの選択子の宣言を class ごとに集める */
function collectScoped(css: string): ScopedDecls {
  const map: ScopedDecls = new Map();
  postcss.parse(css).walkRules((rule) => {
    const decls = parseDecls(
      rule.nodes.map((node) => node.toString()).join(";"),
    );
    for (const selector of rule.selectors) {
      const last = /\.([\w-]+)\s*$/.exec(selector)?.[1];
      if (last !== undefined) {
        map.set(last, { ...map.get(last), ...decls });
      }
    }
  });
  return map;
}

/** 値の先頭の px */
function px(value: string | undefined): number {
  const match = /(-?[\d.]+)px/.exec(value ?? "");
  return match === null ? 0 : Number(match[1]);
}

/** 要素の内側の余白と枠線の太さ（左右・上下の合計）と外側の余白（上下の合計） */
function boxOf(
  element: Element,
  scoped: ScopedDecls,
): { x: number; y: number; margin: number } {
  const decls: Record<string, string> = {};
  for (const name of classesOf(element)) {
    Object.assign(decls, scoped.get(name));
  }
  Object.assign(decls, parseDecls(element.attribs.style ?? ""));
  const edge =
    (px(decls.padding) + px(decls.border ?? decls["border-width"])) * 2;
  return { x: edge, y: edge, margin: px(decls.margin) * 2 };
}

/** 範囲の中のグラフの図: 上下の余白・タイトル・タイトルとの間・グラフ・凡例 */
function estimateDiagram(figure: Element, maxWidth: number): Size {
  const wires = findAll(
    figure,
    (e) => e.name === "svg" && classesOf(e).includes("mdmark-diagram-wires"),
  )[0];
  const legend =
    findAll(figure, (e) => e.name === "li").length > 0 ? LINE + FONT * 0.8 : 0;
  return {
    w: maxWidth,
    h:
      FONT * 2 +
      LINE +
      FONT * 0.6 +
      Number(wires?.attribs.height ?? 0) +
      legend,
  };
}

/** 要素でない・決まった大きさの要素の大きさ。ブロックの積み重ねで大きさが決定する要素は `undefined` */
function leafSize(node: AnyNode, maxWidth: number): Size | undefined {
  if (isText(node)) {
    const w = textWidth(node.data.trim());
    return w === 0
      ? { w: 0, h: 0 }
      : { w: Math.min(w, maxWidth), h: Math.ceil(w / maxWidth) * LINE };
  }
  if (!isTag(node)) {
    return { w: 0, h: 0 };
  }
  if (node.name === "table") {
    return estimateTable(node);
  }
  if (node.name === "img") {
    return {
      w: Number(node.attribs.width ?? 0),
      h: Number(node.attribs.height ?? 0) + FONT * 0.6,
    };
  }
  if (node.name === "figure" && classesOf(node).includes("mdmark-diagram")) {
    return estimateDiagram(node, maxWidth);
  }
  return undefined;
}

/** 子を、行内の並びとブロックの積み重ねに分けて合計した大きさ */
function stackSize(node: Element, inner: number, scoped: ScopedDecls): Size {
  let w = 0;
  let h = 0;
  let inline = 0;
  let inlineH = 0;
  const flush = (): void => {
    if (inline > 0) {
      // 1 行に収まる見積もりの行は、表示する側のフォントの幅の違いで折り返して切れないよう、折り返さず 1 文字の幅を余らせる
      if (inline + FONT <= inner) {
        node.attribs.style = `${node.attribs.style ?? ""};white-space:nowrap`;
        inline += FONT;
      }
      w = Math.max(w, Math.min(inline, inner));
      h += Math.max(Math.ceil(inline / inner) * LINE, inlineH);
    }
    inline = 0;
    inlineH = 0;
  };
  for (const child of node.children) {
    const size = estimate(child, inner, scoped);
    if (isTag(child) && !INLINE_TAGS.has(child.name)) {
      flush();
      w = Math.max(w, size.w);
      h += size.h;
    } else {
      inline +=
        size.w + (isTag(child) && child.name === "img" ? FONT * 0.3 : 0);
      inlineH = Math.max(inlineH, size.h);
    }
  }
  flush();
  return { w, h };
}

/** 要素の大きさを、文字の幅と範囲の CSS の余白から見積もる */
function estimate(node: AnyNode, maxWidth: number, scoped: ScopedDecls): Size {
  const leaf = leafSize(node, maxWidth);
  if (leaf !== undefined || !isTag(node)) {
    return leaf ?? { w: 0, h: 0 };
  }
  const box = boxOf(node, scoped);
  const { w, h } = stackSize(node, maxWidth - box.x, scoped);
  return { w: w + box.x, h: h + box.y + box.margin };
}

/** 埋め込んだ HTML を `foreignObject` に包んだ SVG にする */
async function htmlToSvg(options: {
  root: AnyNode;
  css: string;
  baseDir: string;
}): Promise<{ svg: string; warnings: string[] }> {
  const { root, css, baseDir } = options;
  const warnings = await prepareHtml(root, baseDir);
  // 範囲の CSS は範囲の data-html-scope の選択子で当たるため、そのまま SVG の style へ移す
  const styles = findAll(root, (e) => e.name === "style");
  const scopedCss = styles.map((e) => textOf(e)).join("");
  for (const style of styles) {
    removeNode(style);
  }
  const size = estimate(root, MAX_WIDTH, collectScoped(scopedCss));
  const width = Math.ceil(size.w);
  const height = Math.ceil(size.h);
  const body = `<foreignObject width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="mdmark" style="width:${width}px">${toXml(root)}</div></foreignObject>`;
  return {
    svg: svgFile({
      width,
      height,
      css: pruneCss({ css, ...inventory(root) }) + scopedCss,
      body,
    }),
    warnings,
  };
}

/** `render` が返却する図の HTML を、ほかのファイル・URL を参照しない 1 つの SVG にする */
export async function figureToSvg(options: {
  /** 図 */
  figure: MdmarkFigure;
  /** 配布物の CSS */
  css: string;
  /** 文書のフォルダ（相対パスの画像の基準） */
  baseDir: string;
}): Promise<{ svg: string; warnings: string[] }> {
  const { figure, css, baseDir } = options;
  const document = parseDocument(figure.html);
  if (figure.kind === "html") {
    return htmlToSvg({ root: document, css, baseDir });
  }
  for (const element of findAll(document, (e) =>
    DROP_CLASSES.some((name) => classesOf(e).includes(name)),
  )) {
    removeNode(element);
  }
  return { svg: chartToSvg(document, css), warnings: [] };
}
