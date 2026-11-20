import { expect, test } from "vitest";
import { ARCH } from "../../helpers/map.ts";

/** architecture-beta の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadArch = () => import("../../../../src/map/architecture.ts");

// モックのアーキテクチャ図（正常系）
test("test_parse_architecture", async () => {
  // 準備
  const { parseArchitecture } = await loadArch();
  // 実行
  const diagram = parseArchitecture(ARCH);
  // 検証
  expect(diagram.groups).toHaveLength(2);
  expect(diagram.groups.find((item) => item.id === "app")?.parent).toBe(
    "cloud",
  );
  expect(diagram.services.filter((item) => !item.junction)).toHaveLength(6);
  expect(diagram.services.filter((item) => item.junction)).toHaveLength(1);
  expect(diagram.edges.map((item) => item.id)).toEqual([
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
  ]);
  const edge = (id: string) => diagram.edges.find((item) => item.id === id);
  expect(edge("r1")?.head).toBe("end");
  expect([edge("r3")?.fromSide, edge("r3")?.toSide]).toEqual(["bottom", "top"]);
  expect(edge("r4")?.fromGroup).toBe(true);
  expect(diagram.problems).toEqual([]);
});

// 読めない行（異常系）
test("test_parse_architecture_when_unreadable", async () => {
  // 準備
  const { parseArchitecture } = await loadArch();
  // 実行
  const diagram = parseArchitecture(
    "architecture-beta\n  service web(internet)[ブラウザ]\n  service cdn(cloud)[配信網]\n  web:X --> L:cdn\n",
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
  expect(diagram.problems[0]?.line).toBe(3);
});

// 段と並び（正常系）
test("test_architecture_to_flowchart", async () => {
  // 準備
  const { parseArchitecture, architectureToFlowchart } = await loadArch();
  // 実行
  const { chart, overrides } = architectureToFlowchart(parseArchitecture(ARCH));
  // 検証
  expect(overrides.r3?.rankless).toBe(true);
  expect(overrides.worker?.align).toBe("api");
  expect(overrides.worker?.order ?? 0).toBeGreaterThan(
    overrides.api?.order ?? 0,
  );
  expect(chart.edges.find((item) => item.id === "r1")?.from).toBe("web");
  expect(overrides.hub?.size).toEqual({ w: 16, h: 16 });
});

// mermaid の公式の記法の例の align と接頭辞のアイコンを読み取る（正常系）
test("test_parse_architecture_when_mermaid_syntax", async () => {
  // 準備
  const { parseArchitecture } = await loadArch();
  const source = [
    "architecture-beta",
    "  group api(logos:aws-lambda)[API]",
    "  service db(logos:aws-aurora)[Database] in api",
    "  service s1(server)[S1]",
    "  align row db s1",
  ].join("\n");
  // 実行
  const diagram = parseArchitecture(source);
  const db = diagram.services.find((service) => service.id === "db");
  // 検証
  expect(diagram.problems).toEqual([]);
  expect(db).toMatchObject({ parent: "api", icon: undefined });
  expect(diagram.aligns).toContainEqual({ axis: "row", ids: ["db", "s1"] });
});
