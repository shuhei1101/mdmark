import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 種類の文字・枠の class の末尾・題の文字
const KINDS = [
  { kind: "NOTE", suffix: "note", title: "補足" },
  { kind: "TIP", suffix: "tip", title: "ヒント" },
  { kind: "IMPORTANT", suffix: "important", title: "重要" },
  { kind: "WARNING", suffix: "warning", title: "警告" },
  { kind: "CAUTION", suffix: "caution", title: "注意" },
];

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 5 種の引用を、種類ごとの題・アイコンを持つ注意書きの枠に描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: KINDS.map(({ kind }) => `> [!${kind}]\n> ${kind} の本文\n`).join(
      "\n",
    ),
  });
  // 検証
  const alerts = page.locator("#doc .markdown-alert");
  await expect(alerts).toHaveCount(5);
  for (const [index, { kind, suffix, title }] of KINDS.entries()) {
    const alert = alerts.nth(index);
    await expect(alert).toHaveClass(
      new RegExp(`markdown-alert markdown-alert-${suffix}`),
    );
    const heading = alert.locator(".markdown-alert-title");
    await expect(heading).toHaveText(title);
    const icon = await heading.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return (
        style.getPropertyValue("mask-image") ||
        style.getPropertyValue("-webkit-mask-image")
      );
    });
    expect(icon, `${kind} のアイコン`).not.toBe("none");
    await expect(
      alert.locator("p", { hasText: `${kind} の本文` }),
    ).toBeVisible();
  }
  await expect(page.locator("#doc")).not.toContainText("[!");
});

// 種類の末尾に `-` を付けた注意書きは、閉じた折り畳みで描き、題を押すと開く（正常シナリオ（閉じた注意書き））
test("test_normal_when_collapsed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: "> [!WARNING]-\n> 折り畳みの本文\n" });
  const alert = page.locator("#doc details.markdown-alert");
  // 検証: 描いた直後
  await expect(alert).not.toHaveAttribute("open", "");
  await expect(alert.locator("summary")).toHaveText("警告");
  await expect(page.getByText("折り畳みの本文")).toBeHidden();
  // 実行
  await alert.locator("summary").click();
  // 検証
  await expect(page.getByText("折り畳みの本文")).toBeVisible();
});

// 知らない種類は NOTE の枠で描き、中身は読める（正常シナリオ（知らない種類））
test("test_normal_when_unknown_kind", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "> [!FAQ]\n> よくある質問の本文\n" });
  // 検証
  const alert = page.locator("#doc .markdown-alert-note");
  await expect(alert).toHaveCount(1);
  await expect(
    alert.locator("p", { hasText: "よくある質問の本文" }),
  ).toBeVisible();
});
