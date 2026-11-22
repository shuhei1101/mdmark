/** データの印の形状 */
export type PacketShape = "circle" | "square" | "diamond" | "triangle";
/** データの印の塗り方（random は線ごとにほかの 5 つから選ぶ） */
export type PacketFill = "solid" | "ring" | "tinted" | "glow" | "shine" | "random";
/** データの印の色合い */
export type PacketPalette = "accent" | "vivid" | "pastel" | "muted" | "cool";
/** 設定の map.packets */
export type PacketStyle = {
    fill: PacketFill;
    palette: PacketPalette;
};
/** 塗り方の値の一覧 */
export declare const PACKET_FILLS: readonly ["solid", "ring", "tinted", "glow", "shine", "random"];
/** 色合いの値の一覧 */
export declare const PACKET_PALETTES: readonly ["accent", "vivid", "pastel", "muted", "cool"];
/** 設定を省いたときの map.packets */
export declare const DEFAULT_PACKET_STYLE: PacketStyle;
/** 印が線の上を進む既定の速さ（px / 秒） */
export declare const PACKET_SPEED = 60;
/** 外側の輪郭・光を含めた印の大きさ（px。丸は半径、四角は 1 辺、ひし形は中心から頂点まで、三角は高さと幅） */
export declare const PACKET_SIZE: {
    readonly circle: 5.6;
    readonly square: 9.6;
    readonly diamond: 6.4;
    readonly triangle: 11.2;
};
/** 線の番号を 4 で割った余りで選ぶ形状 */
export declare const PACKET_SHAPES: readonly ["circle", "square", "diamond", "triangle"];
/** 色を指定したノードのある図で、色の無いノードから出る印の色（利用側の変数を先に参照する） */
export declare const PACKET_GRAY = "var(--mdmark-map-packet-gray, var(--mdmark-color-accent-gray-text))";
/** 色合いの n 番目の色（利用側の変数を先に参照し、無ければ印の層の色合いの値） */
export declare const paletteColor: (n: number) => string;
/** 文字列の 32 ビットの FNV-1a のハッシュ */
export declare const packetHash: (text: string) => number;
/** 線ごとの印の見た目 */
export type PacketMark = {
    shape: PacketShape;
    color: string;
    fill: Exclude<PacketFill, "random">;
    speed: number;
    offset: number;
};
/** 線の番号・線の ID・設定・補足の packet・色を指定したノードの有無から、印の見た目を決める */
export declare const resolvePacketMark: (options: {
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
}) => PacketMark;
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
export declare const renderPackets: (paths: PacketPath[]) => string;
