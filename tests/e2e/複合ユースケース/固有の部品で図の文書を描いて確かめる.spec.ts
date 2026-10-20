import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  CARD_MARKDOWN,
  CARD_SOURCE,
  flowMarkdown,
  HOST_CSS,
  placeDeclarations,
  registerCard,
  routeCard,
  runTsc,
  sampleBlock,
  stubClipboard,
  TERM_INDEX,
  tabToViewport,
  wrapDirective,
  writtenTexts,
  zoomPercent,
} from "../diagram.ts";
import { mountDocument, openPage } from "../dist-page.ts";

// 固有の部品の文字の色と、フロー図の LLM の色（固有の CSS が変える）
const HOST_CARD_COLOR = "rgb(0, 0, 255)";
const HOST_LLM_COLOR = "rgb(255, 0, 0)";

/** 雛形（JavaScript）を置き、配布物の型定義を置いたフォルダを作る */
async function prepare(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init", "--js"], dir);
  expect(init.code).toBe(0);
  await placeDeclarations(builtRoot, dir);
  return dir;
}

// 雛形に固有の部品と CSS を足して型で点検し、共通の図の部品と固有の部品で文書を描き、読む人が図のツールチップと拡大・縮小・移動で確かめる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備: 雛形を置き、固有の部品を書き足して型で点検する
  const dir = await prepare(builtRoot, tempDir);
  await writeFiles(dir, { "extensions/card.js": CARD_SOURCE });
  const tsc = await runTsc(dir);
  expect(tsc.stdout).toBe("");
  expect(tsc.code).toBe(0);
  const theme = await readFile(join(dir, "theme.css"), "utf8");
  // 実行: 固有の部品と CSS を読むページで、見本の図の文書を描く
  await openPage(page, builtRoot, { hostCss: `${theme}\n${HOST_CSS}` });
  await routeCard(
    page,
    await readFile(join(dir, "extensions/card.js"), "utf8"),
  );
  await registerCard(page);
  await mountDocument(page, {
    markdown: `${CARD_MARKDOWN}\n${await flowMarkdown()}\n図の外の意思決定モデル。\n`,
    index: TERM_INDEX,
  });
  // 検証: フロー図が枠・3 層・題と凡例つきで描かれ、残った交差は line jump になる
  const figure = page.locator("#doc figure.mdmark-diagram");
  await expect(figure).toHaveCount(1);
  await expect(figure.locator(".mdmark-diagram-lane")).toHaveCount(3);
  await expect(figure.locator(".mdmark-diagram-frame")).toHaveCount(1);
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    "問い合わせへの自動返信の構成",
  );
  await expect(
    figure.locator('ul[aria-label="凡例"] li').first(),
  ).toBeVisible();
  const arcs = await figure
    .locator('.mdmark-diagram-wires > path[data-line="flow"]')
    .evaluateAll(
      (paths) =>
        paths.filter((path) => (path.getAttribute("d") ?? "").includes(" A"))
          .length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  // 固有の部品が、固有の CSS の見た目で描かれる
  const card = page.locator("#doc .host-card");
  await expect(card).toHaveText("固有の題");
  await expect(card).toHaveCSS("color", HOST_CARD_COLOR);
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    HOST_LLM_COLOR,
  );
  // 矢印のラベル・箱の印・箱の中の用語にフォーカスかポインターでツールチップが出て、Esc で消える
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  await label.focus();
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送り主のアドレス",
  });
  await expect(wireTip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(wireTip).toBeHidden();
  const info = page.getByRole("button", { name: "「分類」の入力・処理・出力" });
  await info.focus();
  const ioTip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: "返信の種類" });
  await expect(ioTip.first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ioTip.first()).toBeHidden();
  const term = page.locator("#doc .mdmark-diagram-node .mdmark-term").first();
  await term.hover();
  await expect(
    page.locator(`[id="${await term.getAttribute("aria-describedby")}"]`),
  ).toContainText("選択肢から選ぶだけの");
  await page.mouse.move(0, 0);
  // 図は全体が収まる倍率で開き、右上のボタンとキーの + - 0 で拡大・縮小でき、ドラッグと矢印キーで動かせる
  const fit = await zoomPercent(page);
  expect(fit).toBeLessThan(100);
  await page.getByRole("button", { name: "拡大" }).click();
  expect(await zoomPercent(page)).toBeGreaterThan(fit);
  await tabToViewport(page);
  await page.keyboard.press("-");
  expect(await zoomPercent(page)).toBe(fit);
  await page.keyboard.press("+");
  await page.getByRole("button", { name: "拡大" }).click();
  const viewport = page.locator(
    '#doc [role="group"][aria-roledescription="図"]',
  );
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(80);
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  const start = await viewport.evaluate((element) => element.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 50, box.y + 4, { steps: 5 });
  await page.mouse.up();
  expect(
    await viewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(start);
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
});

// 雛形に足した操作できる部品の文書を描き、スライダーでグラフが描き直され、今の値を写す（正常シナリオ（操作できる部品を置く））
test("test_normal_when_interactive", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: wrapDirective("param", await sampleBlock("strength")),
  });
  // 検証: スライダー・グラフ・今の値を写すボタンが描かれる
  const param = page.locator("#doc .mdmark-param");
  const slider = param.getByRole("slider", { name: "反応の強さ" });
  await expect(slider).toBeVisible();
  await expect(param.locator("svg[role=img]")).toHaveCount(1);
  await expect(
    param.getByRole("button", { name: "今の値を写す" }),
  ).toBeVisible();
  // スライダーを動かすと、グラフが新しい値で描き直される
  await slider.fill("8");
  await expect(param.locator("svg[role=img]")).toHaveAttribute(
    "aria-label",
    /今の値（8）/,
  );
  // 今の値を写すと、スライダーの今の値を JSON にした文字列がクリップボードに入る
  await param.getByRole("button", { name: "今の値を写す" }).click();
  await expect.poll(async () => (await writtenTexts(page)).length).toBe(1);
  expect(JSON.parse((await writtenTexts(page))[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
});

// 型を誤った固有の部品は 1 回目の点検でファイルと行を出して落ち、手で直すと 2 回目の点検が通り、その後の文書に固有の部品が描かれる（異常シナリオ（足した JavaScript の型が合わない））
test("test_error_when_type_mismatch", async ({ builtRoot, tempDir, page }) => {
  // 準備: 雛形を置き、型を誤った固有の部品を書き足す
  const dir = await prepare(builtRoot, tempDir);
  const file = join(dir, "extensions", "card.js");
  const broken = CARD_SOURCE.replace(
    "slot.textContent = definition.title;",
    "slot.textContent = definition.title.length;",
  );
  expect(broken).not.toBe(CARD_SOURCE);
  await writeFile(file, broken);
  // 実行・検証: 1 回目の点検は、誤りのファイルと行を出して終了コードが 0 以外
  const first = await runTsc(dir);
  expect(first.code).not.toBe(0);
  const line =
    broken
      .split("\n")
      .findIndex((text) => text.includes("definition.title.length")) + 1;
  expect(first.stdout).toContain(`extensions/card.js(${line},`);
  // 実行・検証: 手で直した後の 2 回目の点検は、誤り 0 件で終了コードが 0
  await writeFile(file, CARD_SOURCE);
  const second = await runTsc(dir);
  expect(second.stdout).toBe("");
  expect(second.code).toBe(0);
  // 検証: その後に描いた文書に、固有の部品が描かれる
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  await routeCard(page, await readFile(file, "utf8"));
  await registerCard(page);
  await mountDocument(page, { markdown: `${CARD_MARKDOWN}\n本文の段落\n` });
  await expect(page.locator("#doc .host-card")).toHaveText("固有の題");
  await expect(page.locator("#doc > p")).toHaveText("本文の段落");
});
