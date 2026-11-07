// mermaid を CSS 変数のテーマで描き、結果を window.__poc に入れる
export const PAIRS = [
  ["background", "--mdmark-color-bg"],
  ["primaryColor", "--mdmark-color-surface"],
  ["primaryTextColor", "--mdmark-color-text"],
  ["primaryBorderColor", "--mdmark-color-border"],
  ["lineColor", "--mdmark-color-diagram-line"],
  ["textColor", "--mdmark-color-text"],
  ["noteBkgColor", "--mdmark-color-border-muted"],
  // 透明度を持つ色の確認: #rrggbbaa を mermaid の派生色の計算に通す
  ["tertiaryColor", "--mdmark-color-scroll-shadow"],
];

const canvas = document.createElement("canvas");
canvas.width = 1;
canvas.height = 1;
const ctx = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });

/** CSS の色の値を sRGB の [r, g, b, a] にする */
export function toRgba(value) {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data];
}

const hex2 = (n) => n.toString(16).padStart(2, "0");

/** CSS 変数を、試しの要素の color で解決して hex にする */
export function resolveHex(root, name) {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  root.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const [r, g, b, a] = toRgba(computed);
  const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}${a === 255 ? "" : hex2(a)}`;
  return { computed, hex };
}

const near = (x, y) => x.every((v, i) => Math.abs(v - y[i]) <= 2);

export async function run(mermaid) {
  const result = { errors: [], svgs: 0, variables: {}, checks: [], font: {} };
  try {
    const root = document.querySelector(".mdmark");
    const themeVariables = {};
    for (const [key, name] of PAIRS) {
      const { computed, hex } = resolveHex(root, name);
      result.variables[key] = { name, computed, hex };
      themeVariables[key] = hex;
    }
    const font = getComputedStyle(root).getPropertyValue("--mdmark-font-body").trim();
    themeVariables.fontFamily = font;
    // mermaid 12 の base テーマは枠線を primaryBorderColor から派生色へのグラデーションにするため止める
    themeVariables.useGradient = false;
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables });
    const blocks = [...document.querySelectorAll("pre.poc-mermaid")];
    for (const [index, block] of blocks.entries()) {
      const kind = block.dataset.kind;
      try {
        const { svg } = await mermaid.render(`poc-${index}`, block.textContent);
        const holder = document.createElement("div");
        holder.className = "poc-figure";
        holder.dataset.kind = kind;
        holder.innerHTML = svg;
        block.replaceWith(holder);
        if (holder.querySelector("svg") && !holder.querySelector(".error-icon")) {
          result.svgs += 1;
        } else {
          result.errors.push(`${kind}: エラー表示`);
        }
      } catch (error) {
        result.errors.push(`${kind}: ${String(error?.message ?? error)}`);
      }
    }
    const check = (variable, kind, selector, property) => {
      const el = document.querySelector(`.poc-figure[data-kind="${kind}"] ${selector}`);
      if (!el) {
        result.checks.push({ variable, selector: `${kind} ${selector}`, found: false });
        return;
      }
      const actual = getComputedStyle(el)[property];
      const expected = result.variables[variable].hex;
      result.checks.push({
        variable,
        selector: `${kind} ${selector}`,
        property,
        actual,
        expected,
        match: near(toRgba(actual), toRgba(expected)),
      });
    };
    check("primaryColor", "flowchart", ".node rect", "fill");
    check("primaryBorderColor", "flowchart", ".node rect", "stroke");
    check("primaryTextColor", "flowchart", ".node .nodeLabel", "color");
    check("lineColor", "flowchart", ".flowchart-link", "stroke");
    check("textColor", "sequence", ".messageText", "fill");
    check("noteBkgColor", "sequence", "rect.note", "fill");
    const text = document.querySelector('.poc-figure[data-kind="flowchart"] .nodeLabel');
    const norm = (v) => v.replace(/["'\s]/g, "");
    result.font = {
      expected: font,
      actual: text ? getComputedStyle(text).fontFamily : null,
      match: text ? norm(getComputedStyle(text).fontFamily) === norm(font) : false,
    };
  } catch (error) {
    result.errors.push(`run: ${String(error?.message ?? error)}`);
  }
  window.__poc = result;
}
