/** ノードの面・枠線・文字の色 */
export type MermaidNodeStyle = {
  fill?: string;
  stroke?: string;
  color?: string;
};

/** 線と線のラベルの文字の色 */
export type MermaidWireStyle = { stroke?: string; color?: string };

/** readMermaidStyles の戻り値 */
export type MermaidStyles = {
  /** ノードの ID から色 */
  nodes: Record<string, MermaidNodeStyle>;
  /** 線の記載順の番号（0 から）から色 */
  wires: Record<number, MermaidWireStyle>;
  /** `linkStyle default` の色 */
  defaultWire: MermaidWireStyle | undefined;
};

/** 色として読み取る属性 */
const COLOR_KEYS = ["fill", "stroke", "color"] as const;

/** `classDef {クラス,…} {属性}` */
const CLASS_DEF_RE = /^classDef\s+([^\s]+)\s+(.+)$/;
/** `style {ID} {属性}` */
const STYLE_RE = /^style\s+([^\s]+)\s+(.+)$/;
/** `linkStyle {番号,…|default} {属性}` */
const LINK_STYLE_RE = /^linkStyle\s+([^\s]+)\s+(.+)$/;
/** `class {ID,…} {クラス}` */
const CLASS_RE = /^class\s+(.+?)\s+([\w-]+)$/;
/** `cssClass "{ID,…}" {クラス}` */
const CSS_CLASS_RE = /^cssClass\s+"([^"]+)"\s+([\w-]+)$/;
/** 行の中の `{ID}:::{クラス}`（ID は引用符・括弧・空白の前まで） */
const SHORTHAND_RE =
  /([^\s"'[\](){}<>|:;,&-]+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})*:::([\w-]+)/g;

/** `fill:#f9f,stroke:#c3c` から色の属性だけを取り出す */
const readColors = (text: string): MermaidNodeStyle => {
  const out: MermaidNodeStyle = {};
  for (const part of text.replace(/;\s*$/, "").split(",")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if ((COLOR_KEYS as readonly string[]).includes(key) && value !== "")
      out[key as (typeof COLOR_KEYS)[number]] = value;
  }
  return out;
};

const ids = (text: string): string[] =>
  text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");

/** 読み取りの途中の色 */
type StyleReading = {
  classDefs: Record<string, MermaidNodeStyle>;
  applied: Array<{ id: string; className: string }>;
  styled: Record<string, MermaidNodeStyle>;
  wires: Record<number, MermaidWireStyle>;
  defaultWire: MermaidWireStyle | undefined;
  /** 図に出た ID（`classDef default` を当てる） */
  seen: Set<string>;
};

/** `classDef` の行（読んだら true） */
const readClassDef = (reading: StyleReading, text: string): boolean => {
  const match = CLASS_DEF_RE.exec(text);
  if (!match?.[1] || !match[2]) return false;
  for (const name of ids(match[1]))
    reading.classDefs[name] = {
      ...reading.classDefs[name],
      ...readColors(match[2]),
    };
  return true;
};

/** `style` の行（読んだら true） */
const readStyle = (reading: StyleReading, text: string): boolean => {
  const match = STYLE_RE.exec(text);
  if (!match?.[1] || !match[2]) return false;
  reading.styled[match[1]] = {
    ...reading.styled[match[1]],
    ...readColors(match[2]),
  };
  reading.seen.add(match[1]);
  return true;
};

/** `linkStyle` の行（読んだら true） */
const readLinkStyle = (reading: StyleReading, text: string): boolean => {
  const match = LINK_STYLE_RE.exec(text);
  if (!match?.[1] || !match[2]) return false;
  const { stroke, color } = readColors(match[2]);
  const wire: MermaidWireStyle = {
    ...(stroke ? { stroke } : {}),
    ...(color ? { color } : {}),
  };
  for (const index of ids(match[1])) {
    if (index === "default")
      reading.defaultWire = { ...reading.defaultWire, ...wire };
    else if (/^\d+$/.test(index))
      reading.wires[Number(index)] = {
        ...reading.wires[Number(index)],
        ...wire,
      };
  }
  return true;
};

/** `class`・`cssClass` の行のクラスを当てる（`class` の行なら true） */
const readClassLine = (
  reading: StyleReading,
  text: string,
  classTarget: "class" | "cssClass",
): boolean => {
  const match =
    classTarget === "cssClass" ? CSS_CLASS_RE.exec(text) : CLASS_RE.exec(text);
  if (!match?.[1] || !match[2]) return false;
  for (const id of ids(match[1])) {
    reading.applied.push({ id, className: match[2] });
    reading.seen.add(id);
  }
  return classTarget === "class";
};

/** 行の中の `{ID}:::{クラス}` と、ノードと線の文の ID を拾う */
const readShorthand = (reading: StyleReading, text: string): void => {
  for (const match of text.matchAll(SHORTHAND_RE)) {
    if (match[1] && match[2]) {
      reading.applied.push({ id: match[1], className: match[2] });
      reading.seen.add(match[1]);
    }
  }
  for (const id of nodeIdsOf(text)) reading.seen.add(id);
};

/** 読み取った色を、`classDef default`・クラス・`style` の順に重ねたノードの色にする */
const nodeStylesOf = (
  reading: StyleReading,
): Record<string, MermaidNodeStyle> => {
  const nodes: Record<string, MermaidNodeStyle> = {};
  const base = reading.classDefs.default;
  if (base) for (const id of reading.seen) nodes[id] = { ...base };
  for (const { id, className } of reading.applied) {
    const def = reading.classDefs[className];
    if (def) nodes[id] = { ...nodes[id], ...def };
  }
  for (const [id, colors] of Object.entries(reading.styled))
    nodes[id] = { ...nodes[id], ...colors };
  for (const [id, colors] of Object.entries(nodes))
    if (Object.keys(colors).length === 0) delete nodes[id];
  return nodes;
};

/** Mermaid の行から、外観を指定する行を読み取ってノードと線の色を返却する */
export const readMermaidStyles = (options: {
  lines: string[];
  classTarget: "class" | "cssClass";
}): MermaidStyles => {
  const reading: StyleReading = {
    classDefs: {},
    applied: [],
    styled: {},
    wires: {},
    defaultWire: undefined,
    seen: new Set(),
  };
  for (const raw of options.lines) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (
      text === "" ||
      readClassDef(reading, text) ||
      readStyle(reading, text) ||
      readLinkStyle(reading, text) ||
      readClassLine(reading, text, options.classTarget)
    )
      continue;
    readShorthand(reading, text);
  }
  return {
    nodes: nodeStylesOf(reading),
    wires: reading.wires,
    defaultWire: reading.defaultWire,
  };
};

/** `classDef default` を当てるため、線とノードの文の ID を拾う */
const nodeIdsOf = (text: string): string[] => {
  if (
    /^(classDef|class|style|linkStyle|cssClass|click|subgraph|end|direction)\b/.test(
      text,
    )
  )
    return [];
  return [
    ...text.matchAll(
      /(?:^|[\s&>|-])([A-Za-z0-9_\u0080-￿]+)(?=[\s[({>]|:::|$|-|&)/g,
    ),
  ]
    .map((match) => match[1] ?? "")
    .filter((id) => id !== "" && !/^(o|x)$/.test(id));
};

/** CSS の色の名前から `#rrggbb` */
const NAMED_COLORS: Record<string, string> = Object.fromEntries(
  "aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32"
    .split(" ")
    .map((pair) => {
      const [name, hex] = pair.split(":");
      return [name ?? "", `#${hex ?? ""}`];
    }),
);

/** 色の文字を 0〜255 の RGB にする（読み取れなければ undefined） */
const rgbOf = (color: string): [number, number, number] | undefined => {
  const value = color.trim().toLowerCase();
  const hex = NAMED_COLORS[value] ?? value;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/.exec(hex);
  if (short) {
    return [short[1], short[2], short[3]].map((digit) =>
      Number.parseInt(`${digit}${digit}`, 16),
    ) as [number, number, number];
  }
  const long =
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/.exec(hex);
  if (long) {
    return [long[1], long[2], long[3]].map((pair) =>
      Number.parseInt(pair ?? "0", 16),
    ) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return undefined;
};

/** WCAG 2 の相対輝度 */
const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lr ?? 0) + 0.7152 * (lg ?? 0) + 0.0722 * (lb ?? 0);
};

/** 面の色に対して WCAG 2 のコントラスト比が高い方の `#000000` か `#ffffff` を返却する（読み取れない色は undefined） */
export const textColorOn = (
  fill: string,
): "#000000" | "#ffffff" | undefined => {
  const rgb = rgbOf(fill);
  if (rgb === undefined) return undefined;
  const l = relativeLuminance(rgb);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
};
