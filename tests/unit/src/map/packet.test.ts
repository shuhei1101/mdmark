import { expect, test } from "vitest";

/** データの印を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPacket = () => import("../../../../src/map/packet.ts");

/** 既定の設定の map.packets */
const STYLE = { fill: "tinted", palette: "accent" } as const;

/** renderPackets が描いた `g.map-packet` の開始タグ */
const groupsOf = (svg: string): string[] =>
  svg.match(/<g [^>]*class="map-packet"[^>]*>/g) ?? [];

/** 開始タグの属性の値 */
const attrOf = (tag: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

// 同じ文字列（正常系）
test("test_packet_hash_when_same_text", async () => {
  // 準備
  const { packetHash } = await loadPacket();
  // 実行
  const first = packetHash("a->b");
  const second = packetHash("a->b");
  // 検証
  expect(first).toBe(second);
});

// 既知の値（正常系）
test("test_packet_hash_when_known_value", async () => {
  // 準備
  const { packetHash } = await loadPacket();
  // 実行
  const value = packetHash("");
  // 検証: 32 ビットの FNV-1a の初期値
  expect(value).toBe(2166136261);
});

// 形状と色を順に使う（正常系）
test("test_resolve_packet_mark_when_rotating", async () => {
  // 準備
  const { resolvePacketMark } = await loadPacket();
  // 実行
  const marks = [0, 1, 4, 5].map((index) =>
    resolvePacketMark({
      index,
      wire: `w${index}`,
      style: STYLE,
      colored: false,
    }),
  );
  // 検証
  expect(marks.map((mark) => mark.shape)).toEqual([
    "circle",
    "square",
    "circle",
    "square",
  ]);
  // 利用側の変数を先に参照し、無ければ印の層の色合いの値
  expect(marks.map((mark) => mark.color)).toEqual(
    [1, 2, 5, 1].map(
      (n) =>
        `var(--mdmark-map-packet-${n}, var(--mdmark-map-packet-palette-${n}))`,
    ),
  );
});

// 色を指定したノードがある図（正常系）
test("test_resolve_packet_mark_when_colored", async () => {
  // 準備
  const { resolvePacketMark } = await loadPacket();
  // 実行
  const withColor = resolvePacketMark({
    index: 0,
    wire: "a->b",
    style: STYLE,
    sourceColor: "#ff0000",
    colored: true,
  });
  const withoutColor = resolvePacketMark({
    index: 1,
    wire: "c->d",
    style: STYLE,
    colored: true,
  });
  // 検証
  expect(withColor.color).toBe("#ff0000");
  expect(withoutColor.color).toBe(
    "var(--mdmark-map-packet-gray, var(--mdmark-color-accent-gray-text))",
  );
});

// 補足の packet が優先（正常系）
test("test_resolve_packet_mark_when_override", async () => {
  // 準備
  const { resolvePacketMark } = await loadPacket();
  // 実行
  const mark = resolvePacketMark({
    index: 0,
    wire: "a->b",
    style: { fill: "glow", palette: "accent" },
    override: { shape: "triangle", fill: "ring" },
    colored: false,
  });
  // 検証
  expect(mark.shape).toBe("triangle");
  expect(mark.fill).toBe("ring");
});

// random は描き直しても同じ（正常系）
test("test_resolve_packet_mark_when_random", async () => {
  // 準備
  const { resolvePacketMark } = await loadPacket();
  const options = {
    index: 2,
    wire: "mount->marker",
    style: { fill: "random", palette: "accent" },
    colored: false,
  } as const;
  // 実行
  const first = resolvePacketMark(options);
  const second = resolvePacketMark(options);
  // 検証
  expect(first.fill).toBe(second.fill);
  expect(["solid", "ring", "tinted", "glow", "shine"]).toContain(first.fill);
});

// 速さの範囲と固定（正常系）
test("test_resolve_packet_mark_when_speed", async () => {
  // 準備
  const { resolvePacketMark } = await loadPacket();
  const resolve = (wire: string) =>
    resolvePacketMark({ index: 0, wire, style: STYLE, colored: false });
  // 実行
  const speeds = ["hub->a", "hub->b", "hub->c"].map(
    (wire) => resolve(wire).speed,
  );
  // 検証
  for (const speed of speeds) {
    expect(speed).toBeGreaterThanOrEqual(0.9);
    expect(speed).toBeLessThanOrEqual(1.1);
  }
  expect(new Set(speeds).size).toBe(3);
  expect(resolve("hub->a").speed).toBe(speeds[0]);
});

// 同じ長さの線でもずれる（正常系）
test("test_render_packets_when_same_length", async () => {
  // 準備
  const { renderPackets, resolvePacketMark } = await loadPacket();
  const wires = ["hub->a", "hub->b", "hub->c"];
  const paths = wires.map((wire, index) => ({
    owner: `data-wire="${wire}"`,
    d: "M0 0L290 0",
    length: 290,
    mark: resolvePacketMark({ index, wire, style: STYLE, colored: false }),
    direction: "forward" as const,
  }));
  // 実行
  const svg = renderPackets(paths);
  // 検証: 線ごとの最初の印の dur と begin が互いに違う
  const firsts = wires.map((wire) => {
    const start = svg.indexOf(`data-wire="${wire}"`);
    const motion = /<animateMotion [^>]*>/.exec(svg.slice(start))?.[0] ?? "";
    return { dur: attrOf(motion, "dur"), begin: attrOf(motion, "begin") };
  });
  expect(new Set(firsts.map((first) => first.dur)).size).toBe(3);
  expect(new Set(firsts.map((first) => first.begin)).size).toBe(3);
});

/** 描いた印の要素ごとの、縁の外側を含めた中心からの最大の広がり（x・y の大きい方） */
const extentOf = (svg: string): number => {
  const tags = [...svg.matchAll(/<(circle|rect|polygon) [^>]*>/g)];
  const extents = tags.map(([tag, name]) => {
    const half = Number(/stroke-width:\s*([\d.]+)/.exec(tag)?.[1] ?? "0") / 2;
    if (name === "circle") return Number(attrOf(tag, "r") ?? "0") + half;
    if (name === "rect")
      return Math.abs(Number(attrOf(tag, "x") ?? "0")) + half;
    const values = (attrOf(tag, "points") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map((value) => Math.abs(Number(value)));
    return Math.max(...values) + half;
  });
  return Math.max(...extents);
};

/** 形状ごとの、中心から外側の線までの許される広がり（三角は高さと幅の半分） */
const SIZE_LIMIT = {
  circle: 5.6,
  square: 9.6 / 2,
  diamond: 6.4,
  triangle: 11.2 / 2,
} as const;

// 塗り方ごとの大きさ（正常系）
test("test_render_packets_when_fill", async () => {
  // 準備
  const { renderPackets } = await loadPacket();
  const fills = ["solid", "ring", "tinted", "glow", "shine"] as const;
  const shapes = ["circle", "square", "diamond", "triangle"] as const;
  // 実行
  const cases = shapes.flatMap((shape) =>
    fills.map((fill) => ({
      shape,
      fill,
      svg: renderPackets([
        {
          owner: 'data-wire="a->b"',
          d: "M0 0L100 0",
          length: 100,
          mark: {
            shape,
            color: "var(--mdmark-map-packet-1)",
            fill,
            speed: 1,
            offset: 0,
          },
          direction: "forward",
        },
      ]),
    })),
  );
  // 検証: どの形状・塗り方も、縁と輪郭の外側が形状の大きさに収まる
  for (const { shape, fill, svg } of cases) {
    const group = groupsOf(svg)[0] ?? "";
    expect(attrOf(group, "data-fill")).toBe(fill);
    expect(extentOf(svg), `${shape} ${fill}`).toBeLessThanOrEqual(
      SIZE_LIMIT[shape] + 1e-9,
    );
  }
});

// 三角（正常系）
test("test_render_packets_when_triangle", async () => {
  // 準備
  const { renderPackets } = await loadPacket();
  // 実行
  const svg = renderPackets([
    {
      owner: 'data-wire="a->b"',
      d: "M0 0L100 0",
      length: 100,
      mark: {
        shape: "triangle",
        color: "var(--mdmark-map-packet-1)",
        fill: "solid",
        speed: 1,
        offset: 0,
      },
      direction: "forward",
    },
  ]);
  // 検証: polygon の点の幅と高さに縁の太さを足すと 11.2
  const polygon = /<polygon [^>]*>/.exec(svg)?.[0] ?? "";
  const stroke = Number(/stroke-width:\s*([\d.]+)/.exec(polygon)?.[1] ?? "0");
  const points = attrOf(polygon, "points") ?? "";
  const pairs = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  expect(Math.max(...xs) - Math.min(...xs) + stroke).toBeCloseTo(11.2, 5);
  expect(Math.max(...ys) - Math.min(...ys) + stroke).toBeCloseTo(11.2, 5);
  expect(attrOf(groupsOf(svg)[0] ?? "", "data-shape")).toBe("triangle");
});
