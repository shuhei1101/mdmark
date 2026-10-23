import { join } from "node:path";
import { expect, openStandalone, runCli, test, writeFiles } from "../cli.ts";
import {
  CARD_MARKDOWN,
  CARD_SOURCE,
  flowMarkdown,
  HOST_CSS,
  registerCard,
  routeCard,
} from "../diagram.ts";
import { mountDocument, openPage } from "../dist-page.ts";

// 固有の CSS が変える前の、フロー図の LLM の色（既定の明るい配色）
const DEFAULT_LLM_COLOR = "rgb(109, 40, 217)";
// 固有の CSS が変えた、フロー図の LLM の色と固有の部品の文字の色
const HOST_LLM_COLOR = "rgb(255, 0, 0)";
const HOST_CARD_COLOR = "rgb(0, 0, 255)";

/** 固有の部品の定義・フロー図の定義・段落を持つ文書 */
async function documentMarkdown(): Promise<string> {
  return `${CARD_MARKDOWN}\n${await flowMarkdown()}\n本文の段落\n`;
}

// 固有の部品と CSS を読んだページに、固有の部品が描かれ、固有の CSS の色がフロー図と固有の部品に当たる（正常シナリオ）
test("test_normal", async ({ page, builtRoot }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  const requests = await routeCard(page);
  await registerCard(page);
  // 実行
  await mountDocument(page, { markdown: await documentMarkdown() });
  // 検証: 固有の部品の場所に、定義の題が描かれる
  const card = page.locator("#doc .host-card");
  await expect(card).toHaveText("固有の題");
  expect(requests()).toBe(1);
  // 固有の CSS が変えた色が、固有の部品とフロー図の計算値に出ている
  await expect(card).toHaveCSS("color", HOST_CARD_COLOR);
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    HOST_LLM_COLOR,
  );
  // フロー図と本文は共通の部品と同じように描かれる
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-diagram-lane")).toHaveCount(3);
  await expect(page.locator("#doc > p")).toHaveText("本文の段落");
});

// 固有の CSS と部品を指す設定で書き出した HTML を file:// で開くと、固有の部品が描かれ固有の CSS が当たり、外への要求が 0 件（正常シナリオ（書き出す））
test("test_normal_when_export", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "theme: theme.css",
      "extensions: [extensions/card.js]",
      "",
    ].join("\n"),
    "theme.css": `${HOST_CSS}\n`,
    "extensions/card.js": CARD_SOURCE,
    "doc.md": await documentMarkdown(),
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "doc.md", "--out", "out/doc.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "doc.html"),
  });
  const card = page.locator("article.mdmark .host-card");
  await expect(card).toHaveText("固有の題");
  await expect(card).toHaveCSS("color", HOST_CARD_COLOR);
  await expect(page.locator('article.mdmark [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    HOST_LLM_COLOR,
  );
  expect(opened.externalRequests()).toEqual([]);
});

// 固有の部品を読まないページでは、印を知らない印として取り除き、フロー図の色は既定のまま本文を描く（正常シナリオ（別の場所の文書））
test("test_normal_when_other_place", async ({ page, builtRoot }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: await documentMarkdown() });
  // 検証
  await expect(page.locator("#doc [data-mdmark-slot]")).toHaveCount(0);
  await expect(page.locator("#doc .host-card")).toHaveCount(0);
  expect(await page.locator("#doc").innerHTML()).not.toContain("固有の題");
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    DEFAULT_LLM_COLOR,
  );
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
  await expect(page.locator("#doc > p")).toHaveText("本文の段落");
});
