/** データの印の形状 */
export type PacketShape = "circle" | "square" | "diamond" | "triangle";

/** データの印の塗り方（random は線ごとにほかの 5 つから選ぶ） */
export type PacketFill =
  | "solid"
  | "ring"
  | "tinted"
  | "glow"
  | "shine"
  | "random";

/** データの印の色合い */
export type PacketPalette = "accent" | "vivid" | "pastel" | "muted" | "cool";

/** 設定の map.packets */
export type PacketStyle = { fill: PacketFill; palette: PacketPalette };

/** 塗り方の値の一覧 */
export const PACKET_FILLS = [
  "solid",
  "ring",
  "tinted",
  "glow",
  "shine",
  "random",
] as const satisfies readonly PacketFill[];

/** 色合いの値の一覧 */
export const PACKET_PALETTES = [
  "accent",
  "vivid",
  "pastel",
  "muted",
  "cool",
] as const satisfies readonly PacketPalette[];

/** 設定を省いたときの map.packets */
export const DEFAULT_PACKET_STYLE: PacketStyle = {
  fill: "tinted",
  palette: "accent",
};

/** 印が線の上を進む既定の速さ（px / 秒） */
export const PACKET_SPEED = 60;
/** 印の間隔（px）と、1 本の線に流す印の数の上限 */
const PACKET_GAP = 100;
const PACKET_MAX = 4;

/** 外側の輪郭・光を含めた印の大きさ（px。丸は半径、四角は 1 辺、ひし形は中心から頂点まで、三角は高さと幅） */
export const PACKET_SIZE = {
  circle: 5.6,
  square: 9.6,
  diamond: 6.4,
  triangle: 11.2,
} as const satisfies Record<PacketShape, number>;

/** 線の番号を 4 で割った余りで選ぶ形状 */
export const PACKET_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
] as const satisfies readonly PacketShape[];

/** random で選ぶ塗り方 */
const SOLID_FILLS = ["solid", "ring", "tinted", "glow", "shine"] as const;

/** 縁と輪郭の太さ（px） */
const EDGE_WIDTH = 1.5;
/** ring・glow の中の塗りの大きさの割合 */
const CORE_RATIO = 0.6;
/** 速さの倍率の範囲 */
const SPEED_MIN = 0.9;
const SPEED_SPAN = 0.2;

/** 色を指定したノードのある図で、色の無いノードから出る印の色（利用側の変数を先に参照する） */
export const PACKET_GRAY =
  "var(--mdmark-map-packet-gray, var(--mdmark-color-accent-gray-text))";

/** 色合いの n 番目の色（利用側の変数を先に参照し、無ければ印の層の色合いの値） */
export const paletteColor = (n: number): string =>
  `var(--mdmark-map-packet-${n}, var(--mdmark-map-packet-palette-${n}))`;

/** 文字列の 32 ビットの FNV-1a のハッシュ */
export const packetHash = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/** 線ごとの印の見た目 */
export type PacketMark = {
  shape: PacketShape;
  color: string;
  fill: Exclude<PacketFill, "random">;
  speed: number;
  offset: number;
};

/** 線の番号・線の ID・設定・補足の packet・色を指定したノードの有無から、印の見た目を決める */
export const resolvePacketMark = (options: {
  index: number;
  wire: string;
  style: PacketStyle;
  override?: {
    color?: string | undefined;
    shape?: PacketShape | undefined;
    fill?: PacketFill | undefined;
  };
  sourceColor?: string | undefined;
  colored: boolean;
}): PacketMark => {
  const { index, wire, style, override, sourceColor, colored } = options;
  const shape =
    override?.shape ??
    (PACKET_SHAPES[index % PACKET_SHAPES.length] as PacketShape);
  const color =
    override?.color ??
    (colored
      ? (sourceColor ?? PACKET_GRAY)
      : paletteColor((index % 5) + 1));
  const chosen = override?.fill ?? style.fill;
  const fill =
    chosen === "random"
      ? (SOLID_FILLS[
          packetHash(`${wire}:fill`) % SOLID_FILLS.length
        ] as PacketMark["fill"])
      : chosen;
  const hash = packetHash(wire);
  return {
    shape,
    color,
    fill,
    speed: SPEED_MIN + (SPEED_SPAN * (hash % 1001)) / 1000,
    offset: (hash % 997) / 997,
  };
};

/** 形状の大きさの割合と縁・輪郭の太さから描く形状の要素。縁は角を丸めて、縁の外側を印の大きさに収める */
const shapeSvg = (
  shape: PacketShape,
  options: { ratio: number; stroke: number; style: string },
): string => {
  const { ratio, stroke } = options;
  const inset = stroke / 2;
  const style =
    stroke > 0 ? `${options.style};stroke-linejoin:round` : options.style;
  if (shape === "circle") {
    const r = PACKET_SIZE.circle * ratio - inset;
    return `<circle r="${r}" style="${style}"></circle>`;
  }
  if (shape === "square") {
    const half = (PACKET_SIZE.square / 2) * ratio - inset;
    const corner = 1.6 * ratio;
    return `<rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" rx="${corner}" style="${style}"></rect>`;
  }
  if (shape === "diamond") {
    const half = PACKET_SIZE.diamond * ratio - inset;
    return `<polygon points="0,${-half} ${half},0 0,${half} ${-half},0" style="${style}"></polygon>`;
  }
  const half = (PACKET_SIZE.triangle / 2) * ratio - inset;
  return `<polygon points="0,${-half} ${half},${half} ${-half},${half}" style="${style}"></polygon>`;
};

/** 塗り方ごとの印の要素 */
const packetBody = (mark: PacketMark): string => {
  const { shape } = mark;
  const color = "var(--packet-color)";
  const edge = `stroke:var(--mdmark-color-bg-opaque);stroke-width:${EDGE_WIDTH}`;
  switch (mark.fill) {
    case "solid":
      return shapeSvg(shape, {
        ratio: 1,
        stroke: EDGE_WIDTH,
        style: `fill:${color};${edge}`,
      });
    case "shine":
      return `${shapeSvg(shape, {
        ratio: 1,
        stroke: EDGE_WIDTH,
        style: `fill:${color};${edge}`,
      })}<circle r="1.6" cx="-1.8" cy="-1.8" style="fill:#ffffff;opacity:0.8"></circle>`;
    case "tinted":
      return shapeSvg(shape, {
        ratio: 1,
        stroke: EDGE_WIDTH,
        style: `fill:color-mix(in srgb, ${color} 30%, var(--mdmark-color-bg-opaque));stroke:${color};stroke-width:${EDGE_WIDTH}`,
      });
    case "ring":
      return `${shapeSvg(shape, {
        ratio: 1,
        stroke: 1,
        style: `fill:none;stroke:${color};stroke-width:1;opacity:0.6`,
      })}${shapeSvg(shape, {
        ratio: CORE_RATIO,
        stroke: 0,
        style: `fill:${color}`,
      })}`;
    case "glow":
      return `${shapeSvg(shape, {
        ratio: 1,
        stroke: 0,
        style: `fill:${color};opacity:0.3`,
      })}${shapeSvg(shape, {
        ratio: CORE_RATIO,
        stroke: 0,
        style: `fill:${color}`,
      })}`;
    default: {
      const never: never = mark.fill;
      throw new Error(`知らない塗り方: ${String(never)}`);
    }
  }
};

/** 印を描く 1 本の経路 */
export type PacketPath = {
  /** 印の要素に付ける属性（`data-wire="…"` か `data-message="…"`） */
  owner: string;
  d: string;
  length: number;
  mark: PacketMark;
  direction: "forward" | "backward" | "both";
};

/** 経路の上を元から先へ繰り返し流れる印の SVG。線ごとの速さで動かし、長い線ほど印を多く流す */
export const renderPackets = (paths: PacketPath[]): string =>
  paths
    .flatMap((path) => {
      const { mark } = path;
      const seconds = Math.max(0.6, path.length / (PACKET_SPEED * mark.speed));
      const count = Math.max(
        1,
        Math.min(PACKET_MAX, Math.floor(path.length / PACKET_GAP)),
      );
      const ways =
        path.direction === "both"
          ? [false, true]
          : [path.direction === "backward"];
      const body = packetBody(mark);
      return ways.flatMap((backward) =>
        Array.from({ length: count }, (_item, index) => {
          const begin = -(seconds * (index / count + mark.offset));
          const motion = `<animateMotion dur="${seconds}s" begin="${begin}s" repeatCount="indefinite" path="${path.d}"${backward ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ""}></animateMotion>`;
          return `<g class="map-packet" data-shape="${mark.shape}" data-fill="${mark.fill}" aria-hidden="true" style="--packet-color:${mark.color}" ${path.owner}>${body}${motion}</g>`;
        }),
      );
    })
    .join("");
