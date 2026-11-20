// map の図（HTML のノード + SVG の線）を、外部の資源を持たない 1 枚の SVG と 2 倍の PNG にする
// 方式 foreign: 図の DOM を複製し、計算したスタイルを style 属性に書き写して foreignObject に入れる
// 方式 replaced: ノードの面・枠線を rect、文字を行ごとの text、アイコンと線を SVG の要素へ置き換える

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** 書き出しに含めない要素（操作の当たり判定・データの印・ツールチップ） */
const SKIP = ".map-wire-hits, .map-packets, .mdmark-diagram-tip, .mdmark-hint-tip";

function stageOf(frame) {
  return frame.querySelector(".mdmark-diagram-stage");
}

/** 等倍の図の大きさ（今の倍率で割る） */
function stageSize(stage) {
  const rect = stage.getBoundingClientRect();
  const scale = rect.width / stage.offsetWidth || 1;
  return { width: Math.ceil(stage.offsetWidth), height: Math.ceil(stage.offsetHeight), scale, rect };
}

function isHidden(el) {
  const cs = getComputedStyle(el);
  return cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0;
}

/** 計算した値を style に書き写した後に、var() を値に持つ属性（SVG の表示の属性）を外す */
function dropVarAttributes(root) {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      if (attr.value.includes("var(")) el.removeAttribute(attr.name);
    }
  }
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 計算したスタイルを全て style 属性へ書き写す（計算した値は var() を含まない） */
function inlineAll(src, dst) {
  const cs = getComputedStyle(src);
  let style = "";
  for (let i = 0; i < cs.length; i += 1) {
    const name = cs[i];
    const value = cs.getPropertyValue(name);
    if (value.includes("url(")) continue;
    style += `${name}:${value};`;
  }
  dst.setAttribute("style", style);
  dst.removeAttribute("class");
  const dstChildren = [...dst.children];
  [...src.children].forEach((child, i) => inlineAll(child, dstChildren[i]));
}

export function exportForeign(frame) {
  const stage = stageOf(frame);
  const { width, height } = stageSize(stage);
  const clone = stage.cloneNode(true);
  // 書き写す前に、元の要素と複製の要素の対応で外す要素を決める
  const originals = [...stage.querySelectorAll("*")];
  const copies = [...clone.querySelectorAll("*")];
  inlineAll(stage, clone);
  originals.forEach((el, i) => {
    if (el.matches(SKIP) || isHidden(el)) copies[i].remove();
  });
  clone.style.transform = "none";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  dropVarAttributes(clone);
  clone.setAttribute("xmlns", XHTML_NS);
  const body = new XMLSerializer().serializeToString(clone);
  const bg = getComputedStyle(document.body).backgroundColor;
  const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${bg}"/><foreignObject x="0" y="0" width="${width}" height="${height}">${body}</foreignObject></svg>`;
  return { svg, width, height };
}

/** SVG の要素の見た目に効くプロパティ */
const SVG_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "marker-start", "marker-end"];

function inlineSvg(src, dst) {
  const cs = getComputedStyle(src);
  let style = "";
  for (const name of SVG_PROPS) {
    const value = cs.getPropertyValue(name);
    if (!value) continue;
    // url() は同じ SVG の中の #id を指すものだけを残す
    if (value.startsWith("url(")) {
      const id = value.match(/#([^")]+)/);
      if (id) style += `${name}:url(#${id[1]});`;
      continue;
    }
    style += `${name}:${value};`;
  }
  dst.setAttribute("style", style);
  dst.removeAttribute("class");
  [...src.children].forEach((child, i) => inlineSvg(child, dst.children[i]));
}

function rectOf(el, origin, scale) {
  const r = el.getBoundingClientRect();
  return { x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale };
}

function isTransparent(color) {
  return !color || color === "transparent" || /rgba\(.*,\s*0\)$/.test(color);
}

/** 文字のノードを文字ごとの矩形で行に分け、行ごとの位置と文字を返す */
function textLines(node, origin, scale) {
  const lines = [];
  const range = document.createRange();
  const text = node.textContent;
  let current = null;
  for (let i = 0; i < text.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (!current || Math.abs(current.top - r.top) > 2) {
      current = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, text: "" };
      lines.push(current);
    }
    current.text += text[i];
    current.right = Math.max(current.right, r.right);
    current.bottom = Math.max(current.bottom, r.bottom);
  }
  return lines
    .filter((l) => l.text.trim() !== "")
    .map((l) => ({ text: l.text.trim(), x: (l.left - origin.left) / scale, cy: ((l.top + l.bottom) / 2 - origin.top) / scale, w: (l.right - l.left) / scale }));
}

export function exportReplaced(frame) {
  const stage = stageOf(frame);
  const { width, height, scale, rect: origin } = stageSize(stage);
  const parts = [];
  const bg = getComputedStyle(document.body).backgroundColor;
  parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);

  const visit = (el) => {
    if (el.matches(SKIP) || isHidden(el)) return;
    if (el instanceof SVGSVGElement) {
      const box = rectOf(el, origin, scale);
      const copy = el.cloneNode(true);
      inlineSvg(el, copy);
      copy.setAttribute("x", box.x);
      copy.setAttribute("y", box.y);
      copy.setAttribute("width", box.w);
      copy.setAttribute("height", box.h);
      copy.removeAttribute("aria-hidden");
      dropVarAttributes(copy);
      parts.push(new XMLSerializer().serializeToString(copy));
      return;
    }
    const cs = getComputedStyle(el);
    const box = rectOf(el, origin, scale);
    const fill = isTransparent(cs.backgroundColor) ? "none" : cs.backgroundColor;
    const borderWidth = Number.parseFloat(cs.borderTopWidth) || 0;
    const stroke = borderWidth > 0 && !isTransparent(cs.borderTopColor) ? cs.borderTopColor : "none";
    if (fill !== "none" || stroke !== "none") {
      const rx = Number.parseFloat(cs.borderTopLeftRadius) || 0;
      const dash = cs.borderTopStyle === "dashed" ? ` stroke-dasharray="6 4"` : cs.borderTopStyle === "dotted" ? ` stroke-dasharray="2 3"` : "";
      const inset = borderWidth / 2;
      parts.push(`<rect x="${box.x + inset}" y="${box.y + inset}" width="${Math.max(box.w - borderWidth, 0)}" height="${Math.max(box.h - borderWidth, 0)}" rx="${Math.min(rx, box.h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${borderWidth}"${dash}/>`);
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== "") {
        for (const line of textLines(child, origin, scale)) {
          parts.push(`<text x="${line.x}" y="${line.cy}" dominant-baseline="central" textLength="${line.w}" lengthAdjust="spacingAndGlyphs" font-family="${escapeXml(cs.fontFamily)}" font-size="${cs.fontSize}" font-weight="${cs.fontWeight}" fill="${cs.color}">${escapeXml(line.text)}</text>`);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child);
      }
    }
  };
  for (const child of stage.children) visit(child);
  const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
  return { svg, width, height };
}

/** SVG を img に読み込み、幅・高さ 2 倍の canvas に描いて PNG にする。汚染されたら ok: false を返す */
export async function toPng(svg, width, height) {
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("img の読み込みに失敗"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, width, height);
  try {
    const dataUrl = canvas.toDataURL("image/png");
    return { ok: true, dataUrl, width: canvas.width, height: canvas.height };
  } catch (error) {
    return { ok: false, error: `${error.name}: ${error.message}` };
  }
}

/** 文字の行ごとの矩形の中心（図の左上から、等倍）。複数行の文字は行ごとに分けて測る */
export function textCenters(root, origin, scale = 1) {
  const centers = {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    if (node.parentElement?.closest(SKIP)) continue;
    for (const line of textLines(node, origin, scale)) {
      if (centers[line.text]) continue;
      centers[line.text] = { x: line.x + line.w / 2, y: line.cy };
    }
  }
  return centers;
}

window.pocExport = { exportForeign, exportReplaced, toPng, textCenters, stageSize, stageOf };
