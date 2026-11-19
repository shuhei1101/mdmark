// PoC: render の HTML から chart・param・埋め込んだ HTML を、ブラウザ・DOM のライブラリなしで自己完結した SVG のファイルにする
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import render from "dom-serializer";
import type { AnyNode, Element } from "domhandler";
import { isTag, isText } from "domhandler";
import { parseDocument } from "htmlparser2";
import postcss, { type AtRule, type ChildNode, type Rule } from "postcss";
import { resolveConfig } from "../../src/config.ts";
import { renderDocument } from "../../src/render/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(here, "samples");
const outDir = join(here, "out");

/** sanitize が小文字にした SVG の属性の名前を、XML の大文字小文字に戻す表 */
const SVG_ATTRIBUTES = Object.fromEntries(
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

/** 図の枠から書き出さない要素の class（パネル・高さのハンドル・ツールチップ） */
const DROP_CLASSES = ["mdmark-diagram-tools", "mdmark-diagram-resize", "mdmark-diagram-tip"];

// ---------- CSS: index.css を平らにし、断片で使う規則だけを残す ----------

type FlatRule = { selectors: string[]; decls: string };

/** 入れ子の規則を平らな規則の並びにする（screen 以外の @media・@keyframes・@container は落とす） */
const flatten = (nodes: ChildNode[], parents: string[], out: FlatRule[]): void => {
  for (const node of nodes) {
    if (node.type === "atrule") {
      const at = node as AtRule;
      const descend = at.name === "layer" || at.name === "supports" || (at.name === "media" && at.params.trim() === "screen");
      if (descend) flatten(at.nodes ?? [], parents, out);
      continue;
    }
    if (node.type !== "rule") continue;
    const rule = node as Rule;
    const selectors =
      parents.length === 0
        ? rule.selectors
        : rule.selectors.flatMap((child) =>
            parents.map((parent) => (child.includes("&") ? child.replaceAll("&", parent) : `${parent} ${child}`)),
          );
    const decls = (rule.nodes ?? [])
      .filter((child) => child.type === "decl")
      .map((child) => child.toString())
      .join(";");
    if (decls !== "") out.push({ selectors, decls });
    flatten((rule.nodes ?? []).filter((child) => child.type !== "decl"), selectors, out);
  }
};

/** 括弧の中（:is・:not・:where・:has の引数）と属性の選択子を除いた選択子 */
const stripParens = (selector: string): string => {
  let depth = 0;
  let out = "";
  for (const char of selector) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (depth === 0) out += char;
  }
  return out.replace(/\[[^\]]*\]/g, "");
};

/** 選択子の class と要素名が全て断片にあるか */
const selectorApplies = (options: { selector: string; classes: Set<string>; tags: Set<string> }): boolean => {
  if (options.selector === ":root") return true;
  // 配色のテーマの切り替え（ライト以外の配色・別のテーマ）は書き出さない
  if (/mdmark-theme-|data-mdmark-color-theme|vscode-|^:root:/.test(options.selector)) return false;
  const bare = stripParens(options.selector);
  for (const match of bare.matchAll(/\.([\w-]+)/g)) {
    if (!options.classes.has(match[1] as string)) return false;
  }
  for (const match of bare.matchAll(/(?:^|[\s>+~])([a-z][a-z0-9-]*)/g)) {
    if (!options.tags.has(match[1] as string)) return false;
  }
  return true;
};

const flatRules: FlatRule[] = [];
flatten(postcss.parse(readFileSync(join(here, "../../src/index.css"), "utf8")).nodes, [], flatRules);

/** 断片で使う規則と、その規則が参照する変数の定義だけの CSS */
const pruneCss = (options: { classes: Set<string>; tags: Set<string> }): string => {
  const kept: string[] = [];
  const rootDecls = new Map<string, string>();
  for (const rule of flatRules) {
    const selectors = rule.selectors.filter((selector) => selectorApplies({ selector: selector.trim(), ...options }));
    if (selectors.length === 0) continue;
    if (selectors.length === 1 && selectors[0]?.trim() === ":root") {
      for (const decl of rule.decls.split(/;(?![^(]*\))/)) {
        const name = decl.slice(0, decl.indexOf(":")).trim();
        if (name.startsWith("--")) rootDecls.set(name, decl);
      }
      continue;
    }
    kept.push(`${selectors.join(",")}{${rule.decls}}`);
  }
  // 残した規則が参照する変数を、:root の定義からたどって入れる
  const used = new Set<string>();
  const queue = [...kept.join("").matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string);
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (used.has(name)) continue;
    used.add(name);
    const decl = rootDecls.get(name);
    if (decl !== undefined) for (const m of decl.matchAll(/var\((--[\w-]+)/g)) queue.push(m[1] as string);
  }
  const vars = [...used].flatMap((name) => rootDecls.get(name) ?? []).join(";");
  // 描く先の要素の余白・幅の上限・角丸は画像の中では要らないため打ち消す
  return `:root{${vars}}${kept.join("")}.mdmark{padding:0!important;max-width:none!important;border-radius:0!important}`;
};

// ---------- HTML の木 ----------

const classesOf = (element: Element): string[] => (element.attribs.class ?? "").split(/\s+/).filter(Boolean);

const walk = (node: AnyNode, visit: (element: Element) => void): void => {
  if (isTag(node)) visit(node);
  if ("children" in node) for (const child of (node as Element).children) walk(child, visit);
};

const findAll = (root: AnyNode, test: (element: Element) => boolean): Element[] => {
  const found: Element[] = [];
  walk(root, (element) => {
    if (test(element)) found.push(element);
  });
  return found;
};

const textOf = (node: AnyNode): string => {
  if (isText(node)) return node.data;
  if ("children" in node) return (node as Element).children.map(textOf).join("");
  return "";
};

const removeNode = (node: AnyNode): void => {
  const parent = node.parent as Element | null;
  if (parent !== null) parent.children = parent.children.filter((child) => child !== node);
};

/** 断片の class と要素名の集合 */
const inventory = (root: AnyNode): { classes: Set<string>; tags: Set<string> } => {
  const classes = new Set<string>(["mdmark"]);
  const tags = new Set<string>(["svg", "div"]);
  walk(root, (element) => {
    tags.add(element.name);
    for (const name of classesOf(element)) classes.add(name);
  });
  return { classes, tags };
};

/** XML として直列化する（SVG の属性の大文字小文字を戻す） */
const toXml = (node: AnyNode): string => {
  walk(node, (element) => {
    // foreignObject の中の XHTML から SVG に戻る要素には、SVG の名前空間を明示する
    if (element.name === "svg") element.attribs.xmlns = "http://www.w3.org/2000/svg";
    for (const [lower, name] of Object.entries(SVG_ATTRIBUTES)) {
      if (lower in element.attribs) {
        element.attribs[name] = element.attribs[lower] as string;
        delete element.attribs[lower];
      }
    }
  });
  return render(node, { xmlMode: true, selfClosingTags: true, decodeEntities: true });
};

// ---------- 大きさの見積もり ----------

const FONT = 14;
const LINE = FONT * 1.8;
const WIDTH = 760;

type Size = { w: number; h: number };

/** 文字の幅（全角 1em・半角 0.6em） */
const textWidth = (text: string): number => {
  let width = 0;
  for (const char of text.replace(/\s+/g, " ")) width += /[\u0000-ÿ]/.test(char) ? FONT * 0.6 : FONT;
  return width;
};

const pngSize = (file: string): Size => {
  const buffer = readFileSync(file);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
};

const INLINE_TAGS = ["span", "b", "strong", "em", "code", "a", "img", "br"];

const estimateTable = (table: Element): Size => {
  const rows = findAll(table, (e) => e.name === "tr");
  const columns: number[] = [];
  for (const row of rows) {
    row.children.filter(isTag).forEach((cell, index) => {
      const bold = cell.name === "th" ? 1.05 : 1;
      const width = Math.max(FONT * 6, textWidth(textOf(cell).trim()) * bold) + FONT * 1.8 + 1;
      columns[index] = Math.max(columns[index] ?? 0, width);
    });
  }
  return { w: columns.reduce((a, b) => a + b, 0) + 2, h: rows.length * (LINE + FONT * 0.9 + 1) + 1 };
};

/** 範囲の CSS の class ごとの宣言（htmlToSvg が範囲ごとに入れ替える） */
let scopedDecls = new Map<string, Record<string, string>>();

const parseDecls = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(";")
      .map((decl) => decl.split(":").map((part) => part.trim()))
      .filter((pair) => pair.length === 2 && pair[0] !== "")
      .map(([name, value]) => [name as string, value as string]),
  );

/** 範囲の CSS から、最後が class 1 つの選択子の宣言を class ごとに集める */
const collectScoped = (css: string): Map<string, Record<string, string>> => {
  const map = new Map<string, Record<string, string>>();
  postcss.parse(css).walkRules((rule) => {
    const decls = parseDecls(rule.nodes.map((node) => node.toString()).join(";"));
    for (const selector of rule.selectors) {
      const last = /\.([\w-]+)\s*$/.exec(selector);
      if (last !== null) map.set(last[1] as string, { ...map.get(last[1] as string), ...decls });
    }
  });
  return map;
};

/** 値の先頭の px（四辺の省略形は先頭の値を四辺に当てる） */
const px = (value: string | undefined): number => {
  const match = /(-?[\d.]+)px/.exec(value ?? "");
  return match === null ? 0 : Number(match[1]);
};

/** 要素の内側の余白と枠線の太さ（左右・上下の合計）と外側の余白（上下の合計） */
const boxOf = (element: Element): { x: number; y: number; margin: number } => {
  const decls: Record<string, string> = {};
  for (const name of classesOf(element)) Object.assign(decls, scopedDecls.get(name));
  Object.assign(decls, parseDecls(element.attribs.style ?? ""));
  const padding = px(decls.padding);
  const border = px(decls.border ?? decls["border-width"]);
  return { x: (padding + border) * 2, y: (padding + border) * 2, margin: px(decls.margin) * 2 };
};

/** 範囲の中のグラフの枠: 上下の余白・タイトル・タイトルとの間・グラフ・凡例 */
const estimateDiagram = (figure: Element, maxWidth: number): Size => {
  const wires = findAll(figure, (e) => e.name === "svg" && classesOf(e).includes("mdmark-diagram-wires"))[0];
  const legend = findAll(figure, (e) => e.name === "li").length > 0 ? LINE + FONT * 0.8 : 0;
  return { w: maxWidth, h: FONT * 2 + LINE + FONT * 0.6 + Number(wires?.attribs.height ?? 0) + legend };
};

const estimate = (node: AnyNode, maxWidth: number): Size => {
  if (isText(node)) {
    const w = textWidth(node.data.trim());
    return w === 0 ? { w: 0, h: 0 } : { w: Math.min(w, maxWidth), h: Math.ceil(w / maxWidth) * LINE };
  }
  if (!isTag(node)) return { w: 0, h: 0 };
  if (node.name === "table") return estimateTable(node);
  if (node.name === "img") return { w: Number(node.attribs["data-w"] ?? 0), h: Number(node.attribs["data-h"] ?? 0) + FONT * 0.6 };
  if (node.name === "figure" && classesOf(node).includes("mdmark-diagram")) return estimateDiagram(node, maxWidth);
  const box = boxOf(node);
  const inner = maxWidth - box.x;
  // ブロック: 子をインラインの並びとブロックの積み重ねに分けて足す
  let w = 0;
  let h = 0;
  let inline = 0;
  let inlineH = 0;
  const flush = () => {
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
    const size = estimate(child, inner);
    if (isTag(child) && !INLINE_TAGS.includes(child.name)) {
      flush();
      w = Math.max(w, size.w);
      h += size.h;
    } else {
      inline += size.w + (isTag(child) && child.name === "img" ? FONT * 0.3 : 0);
      inlineH = Math.max(inlineH, size.h);
    }
  }
  flush();
  return { w: w + box.x, h: h + box.y + box.margin };
};

// ---------- SVG の組み立て ----------

type Warning = { sample: string; message: string };
const warnings: Warning[] = [];

const svgFile = (options: { width: number; height: number; css: string; body: string }): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}"><style>${options.css}</style><rect width="100%" height="100%" fill="#ffffff"/>${options.body}</svg>`;

/** グラフの枠から、グラフの SVG と、Markdown に出すタイトル・凡例を取り出す */
const chartToSvg = (figure: Element): { svg: string; title: string; legend: string[] } => {
  const title = textOf(findAll(figure, (e) => classesOf(e).includes("mdmark-diagram-title"))[0] as Element).trim();
  const legend = findAll(figure, (e) => e.name === "li").map((li) => textOf(li).trim());
  const wires = findAll(figure, (e) => e.name === "svg" && classesOf(e).includes("mdmark-diagram-wires"))[0] as Element;
  const { classes, tags } = inventory(wires);
  classes.add("mdmark-diagram");
  tags.add("figure");
  const width = Number(wires.attribs.width);
  const height = Number(wires.attribs.height);
  const body = `<g class="mdmark"><g class="mdmark-diagram" data-diagram="chart">${toXml(wires)}</g></g>`;
  return { svg: svgFile({ width, height, css: pruneCss({ classes, tags }), body }), title, legend };
};

/** 範囲のスクリプト・パネル・ハンドル・ツールチップを除き、画像をデータ URL にする */
const prepareHtml = (sample: string, root: Element): void => {
  for (const template of findAll(root, (e) => e.name === "template")) {
    warnings.push({ sample, message: "範囲のスクリプトは書き出しで動かないため、スクリプトを除いた HTML を書き出しました" });
    removeNode(template);
  }
  for (const element of findAll(root, (e) => DROP_CLASSES.some((name) => classesOf(e).includes(name)))) removeNode(element);
  for (const img of findAll(root, (e) => e.name === "img")) {
    const src = img.attribs.src ?? "";
    if (/^https?:/.test(src)) {
      warnings.push({ sample, message: `外部の画像 ${src} は書き出せないため取り除きました` });
      removeNode(img);
      continue;
    }
    const file = resolve(samplesDir, src);
    const size = pngSize(file);
    const mime = extname(file) === ".png" ? "image/png" : "application/octet-stream";
    img.attribs.src = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
    img.attribs.width = String(size.w);
    img.attribs.height = String(size.h);
    img.attribs["data-w"] = String(size.w);
    img.attribs["data-h"] = String(size.h);
  }
};

/** 埋め込んだ HTML の範囲を foreignObject に包む */
const htmlToSvg = (sample: string, root: Element): string => {
  prepareHtml(sample, root);
  // 範囲の CSS は範囲の data-html-scope の選択子で当たるため、そのまま SVG の style へ移す
  const styles = findAll(root, (e) => e.name === "style");
  const scoped = styles.map((e) => textOf(e)).join("");
  for (const style of styles) removeNode(style);
  scopedDecls = collectScoped(scoped);
  const size = estimate(root, WIDTH);
  const width = Math.ceil(size.w);
  const height = Math.ceil(size.h);
  const css = pruneCss(inventory(root)) + scoped;
  const body = `<foreignObject width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="mdmark" style="width:${width}px">${toXml(root)}</div></foreignObject>`;
  return svgFile({ width, height, css, body });
};

// ---------- 実行 ----------

const markdown = readFileSync(join(samplesDir, "samples.md"), "utf8");
const rendered = renderDocument({ markdown, config: resolveConfig({}) });
const document = parseDocument(rendered.html);
mkdirSync(outDir, { recursive: true });

const chartLines = (sample: string, chart: { title: string; legend: string[] }): string[] => [
  `**${chart.title}**`,
  "",
  `![${chart.title}](./${sample}.svg)`,
  "",
  ...chart.legend.map((name) => `- ${name}`),
];

const report: string[] = ["# PoC の書き出し", ""];
const headings = findAll(document, (e) => e.name === "h2");
for (const [index, heading] of headings.entries()) {
  const sample = `sample-${index + 1}`;
  // 見出しの次の節の本文の、最初の要素が見本
  const siblings = (heading.parent as Element | null)?.children ?? document.children;
  const body = siblings.slice(siblings.indexOf(heading) + 1).find(isTag) as Element;
  const next = body.children.find(isTag) as Element;
  const lines: string[] = [`## 見本 ${index + 1}`, ""];
  let svg: string;
  if (next.name === "figure" || classesOf(next).includes("mdmark-param")) {
    const figure = next.name === "figure" ? next : (findAll(next, (e) => e.name === "figure")[0] as Element);
    const chart = chartToSvg(figure);
    svg = chart.svg;
    lines.push(...chartLines(sample, chart));
  } else {
    svg = htmlToSvg(sample, next);
    lines.push(`![見本 ${index + 1}](./${sample}.svg)`);
  }
  writeFileSync(join(outDir, `${sample}.svg`), svg);
  report.push(...lines, "");
}
writeFileSync(join(outDir, "README.md"), `${report.join("\n")}\n`);
console.log(JSON.stringify({ warnings, files: headings.length }, null, 2));
