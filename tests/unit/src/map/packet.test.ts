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
  expect(marks.map((mark) => mark.color)).toEqual([
    "var(--mdmark-map-packet-1)",
    "var(--mdmark-map-packet-2)",
    "var(--mdmark-map-packet-5)",
    "var(--mdmark-map-packet-1)",
  ]);
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
  expect(withoutColor.color).toBe("var(--mdmark-map-packet-gray)");
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

// 塗り方ごとの大きさ（正常系）
test("test_render_packets_when_fill", async () => {
  // 準備
  const { renderPackets } = await loadPacket();
  const fills = ["solid", "ring", "tinted", "glow", "shine"] as const;
  // 実行
  const svgs = fills.map((fill) =>
    renderPackets([
      {
        owner: 'data-wire="a->b"',
        d: "M0 0L100 0",
        length: 100,
        mark: {
          shape: "circle",
          color: "var(--mdmark-map-packet-1)",
          fill,
          speed: 1,
          offset: 0,
        },
        direction: "forward",
      },
    ]),
  );
  // 検証: 最も外の円の半径と輪郭の太さの半分の和が 5.6 以下
  svgs.forEach((svg, index) => {
    const group = groupsOf(svg)[0] ?? "";
    expect(attrOf(group, "data-fill")).toBe(fills[index]);
    const radii = [...svg.matchAll(/<circle [^>]*>/g)].map((match) => {
      const tag = match[0];
      const r = Number(attrOf(tag, "r") ?? "0");
      const stroke = Number(/stroke-width:\s*([\d.]+)/.exec(tag)?.[1] ?? "0");
      return r + stroke / 2;
    });
    expect(radii.length).toBeGreaterThan(0);
    expect(Math.max(...radii)).toBeLessThanOrEqual(5.6 + 1e-9);
  });
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
  // 検証: polygon の点の幅と高さが 11.2
  const points = attrOf(/<polygon [^>]*>/.exec(svg)?.[0] ?? "", "points") ?? "";
  const pairs = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(11.2, 5);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(11.2, 5);
  expect(attrOf(groupsOf(svg)[0] ?? "", "data-shape")).toBe("triangle");
});
