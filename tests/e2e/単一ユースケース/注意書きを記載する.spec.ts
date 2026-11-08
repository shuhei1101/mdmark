import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 種類の文字・枠の class の末尾・タイトルの文字
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

// 5 種の引用を、種類ごとのタイトル・アイコンを持つ注意書きの枠に描く（正常シナリオ）
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

// 種類の末尾に `-` を付けた注意書きは、閉じた折り畳みで描き、タイトルを押すと開く（正常シナリオ（閉じた注意書き））
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

// 知らない種類は NOTE の枠で描き、中身は読み込める（正常シナリオ（知らない種類））
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

// 種類の後ろの文字をタイトルにし、スクリーンリーダーでは種類も分かる（正常シナリオ（タイトルを付けた注意書き））
test("test_normal_when_titled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "> [!TIP] 設定を先に確認する\n> タイトルを付けた本文\n",
  });
  // 検証
  const alert = page.locator("#doc .markdown-alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveClass(/markdown-alert-tip/);
  const heading = alert.locator(".markdown-alert-title");
  await expect(heading).toHaveText("ヒント: 設定を先に確認する");
  await expect(heading.locator(".mdmark-visually-hidden")).toHaveText(
    "ヒント: ",
  );
  await expect(heading.locator(".mdmark-visually-hidden")).not.toBeInViewport({
    ratio: 0.5,
  });
  const icon = await heading.evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    return (
      style.getPropertyValue("mask-image") ||
      style.getPropertyValue("-webkit-mask-image")
    );
  });
  expect(icon, "TIP のアイコン").not.toBe("none");
  await expect(
    alert.locator("p", { hasText: "タイトルを付けた本文" }),
  ).toBeVisible();
  await expect(page.locator("#doc")).not.toContainText("[!TIP]");
  await expect(
    alert.locator("p:not(.markdown-alert-title)", {
      hasText: "設定を先に確認する",
    }),
  ).toHaveCount(0);
});

// 種類の末尾に `+` を付けた注意書きは、開いた折り畳みで描き、タイトルを押すと閉じる（正常シナリオ（開いた折りたたみの注意書き））
test("test_normal_when_expanded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: "> [!NOTE]+ 詳細\n> 開いて描く本文\n",
  });
  const alert = page.locator("#doc details.markdown-alert");
  // 検証: 描いた直後
  await expect(alert).toHaveAttribute("open", "");
  await expect(alert.locator("summary")).toContainText("詳細");
  await expect(page.getByText("開いて描く本文")).toBeVisible();
  // 実行
  await alert.locator("summary").click();
  // 検証
  await expect(page.getByText("開いて描く本文")).toBeHidden();
});

// 引用の入れ子ごとに種類を読み込み、WARNING の枠の中に TIP の枠を描く（正常シナリオ（入れ子の注意書き））
test("test_normal_when_nested", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "> [!WARNING]",
      "> 外側の本文",
      ">",
      "> > [!TIP]",
      "> > 内側の本文",
      "",
    ].join("\n"),
  });
  // 検証
  const outer = page.locator("#doc .markdown-alert-warning");
  await expect(outer).toHaveCount(1);
  const inner = outer.locator(".markdown-alert-tip");
  await expect(inner).toHaveCount(1);
  await expect(outer.locator("> p", { hasText: "外側の本文" })).toBeVisible();
  await expect(inner.locator("p", { hasText: "内側の本文" })).toBeVisible();
  await expect(page.locator("#doc")).not.toContainText("[!WARNING]");
  await expect(page.locator("#doc")).not.toContainText("[!TIP]");
});
