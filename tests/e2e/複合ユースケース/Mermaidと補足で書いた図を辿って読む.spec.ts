import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  expect,
  linesOf,
  openStandalone,
  runCli,
  test,
  writeFiles,
} from "../cli.ts";
import {
  BOTH_RANGES,
  bandButton,
  bandCount,
  isDimmed,
  isSelected,
  MAP_CONFIG_YAML,
  MAP_DATA_VALUE,
  MAP_FLOW,
  mapFigure,
  mapNode,
  mapRange,
  mapTool,
  mapWire,
  NODE_NOTE,
  openMap,
  overlaps,
  packetOwners,
  resolveColor,
} from "../map.ts";
import { MERMAID_ENTRY, routeMermaid } from "../mermaid.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** 文書 1 つを記載した索引 */
const INDEX = [
  "schema: 2",
  "docs:",
  "  - id: map",
  "    path: map.md",
  "    title: 構成",
  "",
].join("\n");

/** 雛形を配置し、設定に map の種類と線を足し、文書と索引を記載したフォルダを作る */
async function createMapDir(
  builtRoot: string,
  tempDir: () => Promise<string>,
  doc: string,
): Promise<string> {
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config.trimEnd()}\n${MAP_CONFIG_YAML.join("\n")}\n`,
    "index.yaml": INDEX,
    "map.md": doc,
  });
  return dir;
}

/** 構成図とシーケンス図の文書 */
const DOC = `# 構成\n\n${BOTH_RANGES}`;

// 点検してから、構成図を入る・閉じる・巡回し、シーケンスを構成図の上で再生して参加者を選ぶ（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備・実行: 点検する
  const dir = await createMapDir(builtRoot, tempDir, DOC);
  const check = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(check.code).toBe(0);
  expect(linesOf(check.stdout)).toEqual(["ずれ 0 件"]);
  // 実行: 描く
  const requests = await routeMermaid(page);
  await openMap(page, builtRoot, { markdown: DOC });
  const flow = mapFigure(page, 0);
  const seq = mapFigure(page, 1);
  await expect(seq).toBeVisible();
  // 検証: 入れ子のグループを重ならずに配置し、設定の種類で描く
  const nodes = await flow
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  }
  await expect(mapNode(flow, "index")).toHaveAttribute("data-shape", "rect");
  await expect(
    mapNode(flow, "index").locator(".mdmark-diagram-node-kind"),
  ).toHaveText("保存先");
  expect(
    await flow
      .locator('.map-group[data-group="read"]')
      .evaluate((group) => getComputedStyle(group).backgroundColor),
  ).toBe(await resolveColor(page, "var(--mdmark-color-accent-blue-bg)"));
  const arcs = await flow
    .locator("path.mdmark-diagram-wire")
    .evaluateAll(
      (paths) =>
        paths.filter((path) =>
          / A[\d.]+,[\d.]+ /.test(path.getAttribute("d") ?? ""),
        ).length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  // 実行・検証: グループの中へ入り、戻る
  await flow.locator('[data-group-enter="lib"]').click();
  await expect(mapNode(flow, "user")).toHaveClass(/map-faded/);
  await mapTool(flow, "back").click();
  await expect(flow.locator(".map-group-title.is-current")).toHaveCount(0);
  // 実行・検証: グループを閉じると、同じ相手への線を 1 本にまとめる
  await flow.locator('[data-group-toggle="read"]').click();
  await expect(mapWire(flow, "read->layout")).toHaveCount(1);
  await flow.locator('[data-group-toggle="read"]').click();
  // 実行・検証: 補足の説明を持つノードのツールチップ
  await mapNode(flow, "layout").locator(".mdmark-diagram-info").focus();
  await expect(
    page.locator('[role="tooltip"]', { hasText: NODE_NOTE }),
  ).toBeVisible();
  // 実行・検証: 巡回の次へ・前へ
  await bandButton(flow, "next").click();
  await expect(flow.locator(".map-band-title")).toHaveText("mount に渡す");
  await bandButton(flow, "next").click();
  await bandButton(flow, "next").click();
  await expect(flow.locator(".map-group-title.is-current")).toHaveText("配置");
  await bandButton(flow, "prev").click();
  await expect(bandCount(flow)).toHaveText("2/3");
  await bandButton(flow, "stop").click();
  // 実行・検証: シーケンスを再生すると、両方の図の線に印が流れ続ける
  await page.clock.install();
  await bandButton(seq, "auto").click();
  await expect(bandCount(seq)).toHaveText("1/4");
  expect(await packetOwners(flow)).toEqual(["user->mount"]);
  expect(await packetOwners(seq)).toEqual(["0"]);
  await page.clock.runFor(2_000);
  await expect(bandCount(seq)).toHaveText("2/4");
  await bandButton(seq, "stop").click();
  // 実行・検証: 参加者を選ぶと、その参加者のメッセージとライフラインを強調する
  await mapNode(seq, "marker").click({ position: { x: 6, y: 6 } });
  expect(await isSelected(mapNode(seq, "marker"))).toBe(true);
  expect(
    await isDimmed(seq.locator('path.mdmark-diagram-wire[data-message="1"]')),
  ).toBe(false);
  expect(
    await isDimmed(seq.locator('path.mdmark-diagram-wire[data-message="0"]')),
  ).toBe(true);
  expect(
    await isDimmed(
      seq.locator('.mdmark-diagram-lifeline[data-lifeline="marker"]'),
    ),
  ).toBe(false);
  // 検証: mermaid のライブラリを読み込まない
  expect(requests().filter((file) => file === MERMAID_ENTRY)).toEqual([]);
});

// 書き出した HTML を外へ要求せずに開き、構成図を辿ってシーケンスを再生する（正常シナリオ（書き出した HTML で辿る））
test("test_normal_when_exported", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await createMapDir(builtRoot, tempDir, DOC);
  // 実行
  const result = await runCli(builtRoot, ["export", "map.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "map.html"),
  });
  const flow = mapFigure(page, 0, "body");
  const seq = mapFigure(page, 1, "body");
  await expect(seq).toBeVisible({ timeout: 10_000 });
  await expect(flow.locator('.map-group[data-group="read"]')).toBeVisible();
  // 実行・検証: グループの中へ入り、戻る
  await flow.locator('[data-group-enter="lib"]').click();
  await expect(flow.locator(".map-group-title.is-current")).toHaveText(
    "mdmark",
  );
  await mapTool(flow, "back").click();
  await expect(flow.locator(".map-group-title.is-current")).toHaveCount(0);
  // 実行・検証: シーケンスを再生すると、構成図の線に印が流れる
  await bandButton(seq, "next").click();
  expect(await packetOwners(flow)).toEqual(["user->mount"]);
  expect(opened.externalRequests()).toEqual([]);
  expect(opened.pageErrors()).toEqual([]);
});

// 補足のずれを点検で見つけ、直した後はずれ 0 件で描く（異常シナリオ（補足にずれがある））
test("test_error_when_map_data_drift", async ({ builtRoot, tempDir, page }) => {
  // 準備: Mermaid に無い ID を指す notes・知らないキー・-- を含む案内の文
  const drifted = mapRange({
    args: '{"title": "全体の構成"}',
    mermaid: MAP_FLOW,
    data: JSON.stringify({
      ...MAP_DATA_VALUE,
      notes: { ...MAP_DATA_VALUE.notes, ghost: { text: "無い" } },
      layuot: {},
      walkthroughs: [
        { ...MAP_DATA_VALUE.walkthroughs[0], text: "a -- b" },
        ...MAP_DATA_VALUE.walkthroughs.slice(1),
      ],
    }),
  });
  const dir = await createMapDir(builtRoot, tempDir, `# 構成\n\n${drifted}`);
  const before = await readFile(join(dir, "map.md"), "utf8");
  // 実行: 1 回目の点検
  const first = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(first.code).not.toBe(0);
  const lines = linesOf(first.stdout);
  const ofDoc = lines.filter((line) => line.startsWith("map.md:"));
  expect(ofDoc).toHaveLength(3);
  expect(
    ofDoc.some(
      (line) => line.includes("map_unknown_ref") && line.includes("ghost"),
    ),
  ).toBe(true);
  expect(
    ofDoc.some(
      (line) => line.includes("map_unknown_key") && line.includes("layuot"),
    ),
  ).toBe(true);
  expect(ofDoc.some((line) => line.includes("--"))).toBe(true);
  expect(await readFile(join(dir, "map.md"), "utf8")).toBe(before);
  // 実行: 3 つのずれを手で直して、2 回目の点検
  await writeFiles(dir, {
    "map.md": `# 構成\n\n${mapRange({ args: '{"title": "全体の構成"}', mermaid: MAP_FLOW, data: JSON.stringify(MAP_DATA_VALUE) })}`,
  });
  const fixed = await readFile(join(dir, "map.md"), "utf8");
  const second = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(second.code).toBe(0);
  expect(linesOf(second.stdout)).toEqual(["ずれ 0 件"]);
  expect(await readFile(join(dir, "map.md"), "utf8")).toBe(fixed);
  // 実行・検証: 描くと書き方の警告が無く、構成図を描く
  await openMap(page, builtRoot, { markdown: fixed });
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  await expect(mapNode(mapFigure(page), "mount")).toBeVisible();
});
