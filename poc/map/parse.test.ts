import { describe, expect, test } from "vitest";
import { checkMapLayout } from "./check-map.ts";
import { layoutMap } from "./layout.ts";
import { parseFlowchart, parseSequence } from "./parse.ts";
import { LONG_LABELS, SAMPLE_FLOW, SAMPLE_OVERRIDES, SAMPLE_SEQUENCE, UNREADABLE_LINE } from "./sample.ts";

describe("No 1 記法の読み取り", () => {
  const chart = parseFlowchart(SAMPLE_FLOW);
  const node = (id: string) => chart.nodes.find((item) => item.id === id);
  const edgesOf = (from: string, to: string) => chart.edges.filter((edge) => edge.from === from && edge.to === to);

  test("ノード 30・箱 6・線 40 を読み、書き方の警告は 0 件", () => {
    expect(chart.direction).toBe("LR");
    expect(chart.nodes).toHaveLength(30);
    expect(chart.boxes).toHaveLength(6);
    expect(chart.edges).toHaveLength(40);
    expect(chart.warnings).toEqual([]);
  });

  test("箱の入れ子 2 レイヤーと direction", () => {
    const boxes = Object.fromEntries(chart.boxes.map((box) => [box.id, box]));
    expect(boxes.fe).toMatchObject({ parent: "app", direction: "TB", title: "画面" });
    expect(boxes.be).toMatchObject({ parent: "app", direction: undefined });
    expect(boxes.app).toMatchObject({ parent: undefined, direction: "LR" });
    expect(boxes.db).toMatchObject({ parent: "data", direction: "LR" });
    expect(node("detail")?.parent).toBe("fe");
    expect(node("gw")?.parent).toBe("app");
    expect(node("user")?.parent).toBeUndefined();
  });

  test("ノードの形状 4 種以上とクラス", () => {
    expect(new Set(chart.nodes.map((item) => item.shape)).size).toBeGreaterThanOrEqual(4);
    expect(node("user")).toMatchObject({ shape: "stadium", classes: ["external"], label: "利用者" });
    expect(node("log")).toMatchObject({ shape: "cylinder", classes: ["data"] });
    expect(node("monitor")?.shape).toBe("diamond");
    expect(node("cron")?.shape).toBe("hexagon");
    expect(node("toast")?.shape).toBe("round");
    expect(node("api")?.classes).toEqual(["script"]);
  });

  test("30 文字のラベル", () => {
    for (const label of LONG_LABELS) {
      expect([...label]).toHaveLength(30);
    }
    expect(node("api")?.label).toBe(LONG_LABELS[0]);
  });

  test("矢印 3 種・ラベルの 2 つの書き方・線の ID", () => {
    expect(new Set(chart.edges.map((edge) => edge.line))).toEqual(new Set(["solid", "dotted", "thick"]));
    expect(edgesOf("gw", "api")[0]?.label).toBe("振り分け");
    expect(edgesOf("gw", "auth")[0]?.label).toBe("認証の確認");
    expect(edgesOf("form", "gw")[0]?.id).toBe("e1");
    expect(edgesOf("api", "cache")[0]?.line).toBe("thick");
    expect(edgesOf("queue", "render")[0]?.line).toBe("dotted");
  });

  test("連ね書きと & と、定義と別の行の線", () => {
    expect(edgesOf("page", "form")).toHaveLength(1);
    expect(edgesOf("form", "list")).toHaveLength(1);
    expect(edgesOf("users", "backup")).toHaveLength(1);
    expect(edgesOf("orders", "backup")).toHaveLength(1);
    expect(edgesOf("orders", "items")).toHaveLength(1);
  });

  test("階層をまたぐ線が 10 本以上", () => {
    const parentOf = (id: string) => node(id)?.parent;
    expect(chart.edges.filter((edge) => parentOf(edge.from) !== parentOf(edge.to)).length).toBeGreaterThanOrEqual(10);
  });

  test("読めない行は描画を止めずに、その行を指す警告 1 件", () => {
    const source = SAMPLE_FLOW.replace("  backup --> files\n", `  backup --> files\n${UNREADABLE_LINE}\n`);
    const broken = parseFlowchart(source);
    expect(broken.warnings).toHaveLength(1);
    expect(broken.warnings[0]?.text).toBe(UNREADABLE_LINE);
    expect(source.split("\n")[(broken.warnings[0]?.line ?? 0) - 1]).toBe(UNREADABLE_LINE);
    expect(broken.edges).toHaveLength(40);
    expect(() => layoutMap(broken)).not.toThrow();
  });

  test("sequenceDiagram の相手・メッセージ・繰り返し", () => {
    const sequence = parseSequence(SAMPLE_SEQUENCE);
    expect(sequence.warnings).toEqual([]);
    expect(sequence.participants).toEqual([
      { id: "U", label: "利用者", actor: true },
      { id: "P", label: "ページ", actor: false },
      { id: "A", label: "API", actor: false },
      { id: "D", label: "DB", actor: false },
    ]);
    expect(sequence.messages).toHaveLength(6);
    expect(sequence.messages.filter((message) => message.reply)).toHaveLength(3);
    expect(sequence.loops).toEqual([{ id: 0, label: "3 回まで" }]);
    expect(sequence.messages.filter((message) => message.loop === 0).map((message) => message.text)).toEqual(["書く", "結果"]);
  });
});

describe("No 4 上書き", () => {
  const layout = layoutMap(parseFlowchart(SAMPLE_FLOW), {}, SAMPLE_OVERRIDES);
  const leaf = (id: string) => layout.leaves.find((item) => item.id === id);

  test("上書きしても重なり・はみ出し・横切りが 0 件", () => {
    expect(checkMapLayout(layout)).toEqual([]);
  });

  test("align: cache が gw と同じ段（app は LR なので x の中心が同じ）", () => {
    const cache = leaf("cache");
    const gw = leaf("gw");
    expect((cache?.x ?? 0) + (cache?.w ?? 0) / 2).toBe((gw?.x ?? 0) + (gw?.w ?? 0) / 2);
  });

  test("order: audit が同じ段の users より先", () => {
    expect(leaf("audit")?.y ?? 0).toBeLessThan(leaf("users")?.y ?? 0);
  });

  test("座標の固定: monitor が指定の座標", () => {
    expect(leaf("monitor")).toMatchObject({ x: 24, y: 24 });
  });
});
