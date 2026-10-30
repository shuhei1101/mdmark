import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** ファイルツリーのストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-filetree--${id}`);
}

/** 項目の名前の `::before`（アイコン）の `mask-image` と色を、名前の文字ごとに返す */
function iconsOf(
  page: Page,
): Promise<Record<string, { mask: string; color: string }>> {
  return page.locator(".mdmark-tree-name").evaluateAll((names) =>
    Object.fromEntries(
      names.map((name) => {
        const style = getComputedStyle(name, "::before");
        return [
          name.textContent?.trim() ?? "",
          { mask: style.maskImage, color: style.color },
        ];
      }),
    ),
  );
}

/** 開閉のボタンの `aria-expanded` を、並んだ順に返す */
function expandedStates(page: Page): Promise<Array<string | null>> {
  return page
    .locator("button.mdmark-tree-toggle")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-expanded")),
    );
}

/** 名前の文字の項目が見えているか */
function nameVisible(page: Page, text: string): Promise<boolean> {
  return page
    .locator(".mdmark-tree-name", { hasText: text })
    .first()
    .isVisible();
}

// フォルダとファイルに、種類ごとのアイコンを付け、全ての項目を開いて並べる。帯と開閉のボタンは持たない（Basic）
test("test_basic", async () => {
  // 準備・実行
  const page = await open("basic");
  // 検証
  const list = page.locator("div.mdmark-tree > ul.mdmark-tree-list");
  await expect(list.getAttribute("aria-label")).resolves.toBe("ファイルツリー");
  await expect(list.locator("li.mdmark-tree-folder").count()).resolves.toBe(2);
  await expect(list.locator("li.mdmark-tree-file").count()).resolves.toBe(2);
  await expect(page.locator(".mdmark-tree-bar").count()).resolves.toBe(0);
  await expect(page.locator("#storybook-root button").count()).resolves.toBe(0);
  await expect(nameVisible(page, "index.ts")).resolves.toBe(true);
  const icons = await iconsOf(page);
  expect(icons["mdmark/"]?.mask).toContain("data:image/svg+xml");
  expect(icons["package.json"]?.mask).toContain("data:image/svg+xml");
  expect(icons["mdmark/"]?.mask).not.toBe(icons["package.json"]?.mask);
});

// 指定の無い開き方で、ルートだけを開き、src/ は閉じたアイコンで中身を隠す。上に種類 tree とコピーの帯がある（Interactive）
test("test_interactive", async () => {
  // 準備・実行
  const page = await open("interactive");
  // 検証
  await expect(page.locator(".mdmark-tree-kind").innerText()).resolves.toBe(
    "tree",
  );
  await expect(
    page.locator("button.mdmark-tree-copy").innerText(),
  ).resolves.toBe("コピー");
  await expect(expandedStates(page)).resolves.toEqual(["true", "false"]);
  await expect(nameVisible(page, "src/")).resolves.toBe(true);
  await expect(nameVisible(page, "index.ts")).resolves.toBe(false);
  const icons = await iconsOf(page);
  expect(icons["mdmark/"]?.mask).not.toBe(icons["src/"]?.mask);
});

// open=all で、全てのフォルダが開いたアイコンで開いている（OpenAll）
test("test_open_all", async () => {
  // 準備・実行
  const page = await open("open-all");
  // 検証
  await expect(expandedStates(page)).resolves.toEqual(["true", "true", "true"]);
  await expect(nameVisible(page, "tree.ts")).resolves.toBe(true);
  const icons = await iconsOf(page);
  expect(icons["app/"]?.mask).toBe(icons["parts/"]?.mask);
});

// open=2 で、app/ と src/ が開き、parts/ が閉じている（OpenLevels）
test("test_open_levels", async () => {
  // 準備・実行
  const page = await open("open-levels");
  // 検証
  await expect(expandedStates(page)).resolves.toEqual([
    "true",
    "true",
    "false",
  ]);
  await expect(nameVisible(page, "parts/")).resolves.toBe(true);
  await expect(nameVisible(page, "tree.ts")).resolves.toBe(false);
});

// 注釈が全ての行で同じ位置の列に揃い、名前から注釈まで点線でつながり、# を出さない。注釈の中のコード・太字・バッジを描く（Notes）
test("test_notes", async () => {
  // 準備・実行
  const page = await open("notes");
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLElement>(".mdmark-tree")
      ?.style.getPropertyValue("--mdmark-tree-note-start"),
  );
  // 検証
  const lefts = await page
    .locator(".mdmark-tree-note")
    .evaluateAll((notes) =>
      notes.map((note) => Math.round(note.getBoundingClientRect().left)),
    );
  expect(lefts).toHaveLength(3);
  expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
  const dotted = await page
    .locator(".mdmark-tree-row:has(.mdmark-tree-note) > :first-child")
    .first()
    .evaluate((head) => getComputedStyle(head, "::after").borderBottomStyle);
  expect(dotted).toBe("dotted");
  await expect(page.locator(".mdmark-tree").innerText()).resolves.not.toContain(
    "#",
  );
  await expect(
    page.locator(".mdmark-tree-note code").innerText(),
  ).resolves.toBe("mount");
  await expect(
    page.locator(".mdmark-tree-note strong").innerText(),
  ).resolves.toBe("必読");
  await expect(
    page.locator(".mdmark-tree-note .mdmark-badge").innerText(),
  ).resolves.toBe("新規");
});

// 拡張子ごとのアイコンを、種類ごとの形と色で出し、知らない拡張子を汎用のアイコンで出す（FileIcons）
test("test_file_icons", async () => {
  // 準備・実行
  const page = await open("file-icons");
  // 検証
  const icons = await iconsOf(page);
  const files = [
    "README.md",
    "index.ts",
    "package.json",
    "photo.PNG",
    "data.csv",
    "dist.zip",
    "Dockerfile",
    "font.woff2",
  ];
  const masks = new Set(files.map((name) => icons[name]?.mask));
  const colors = new Set(files.map((name) => icons[name]?.color));
  expect(masks.size).toBe(files.length);
  expect(colors.size).toBe(files.length);
  const kinds = await page
    .locator("li.mdmark-tree-file")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-file-icon")),
    );
  expect(kinds).toEqual([
    "file-text",
    "file-code",
    "file-json",
    "file-image",
    "file-spreadsheet",
    "file-archive",
    "file-terminal",
    "file",
  ]);
});

// 名前が ... の項目を、省略のアイコンと読み上げの文で出す（More）
test("test_more", async () => {
  // 準備・実行
  const page = await open("more");
  // 検証
  const more = page.locator("li.mdmark-tree-more");
  await expect(more.count()).resolves.toBe(1);
  await expect(
    more.locator(".mdmark-visually-hidden").textContent(),
  ).resolves.toBe("ほかにもあります");
  const icons = await iconsOf(page);
  const mask = await more
    .locator(".mdmark-tree-name")
    .evaluate((name) => getComputedStyle(name, "::before").maskImage);
  expect(mask).toContain("data:image/svg+xml");
  expect(mask).not.toBe(icons["index.ts"]?.mask);
});

// 5 段の深い入れ子を全て開き、段ごとに字下げして並べる（Deep）
test("test_deep", async () => {
  // 準備・実行
  const page = await open("deep");
  // 検証
  await expect(
    page.locator("ul.mdmark-tree-list ul ul ul ul").count(),
  ).resolves.toBe(1);
  const lefts = await page
    .locator(".mdmark-tree-name")
    .evaluateAll((names) =>
      names.map((name) => name.getBoundingClientRect().left),
    );
  for (let i = 1; i < lefts.length; i++) {
    expect(lefts[i] as number).toBeGreaterThan(lefts[i - 1] as number);
  }
});

// 名前と注釈が長く幅を超えても、折り返さずにツリーの中で横にスクロールし、ページは横にスクロールしない（LongName）
test("test_long_name", async () => {
  // 準備・実行
  const page = await open("long-name");
  // 検証
  const scrolls = await page
    .locator("ul.mdmark-tree-list")
    .evaluate((list) => ({
      overflow: getComputedStyle(list).overflowX,
      wide: list.scrollWidth > list.clientWidth,
    }));
  expect(scrolls).toEqual({ overflow: "auto", wide: true });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// コピーした。ボタンが check のアイコンと「コピーしました」になる（Copied）
test("test_copied", async () => {
  // 準備・実行
  const page = await open("copied");
  // 検証
  const button = page.locator("button.mdmark-tree-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("copied");
  await expect(button.innerText()).resolves.toBe("コピーしました");
  await expect(button.locator("svg").count()).resolves.toBe(1);
});

// クリップボードにコピーできなかった。ツリーの下に元の罫線のテキストを入れたパネルを出す（CopyFailed）
test("test_copy_failed", async () => {
  // 準備・実行
  const page = await open("copy-failed");
  // 検証
  const panel = page.locator("div.mdmark-tree > .mdmark-copy-panel");
  await expect(panel.isVisible()).resolves.toBe(true);
  await expect(panel.innerText()).resolves.toContain(
    "ツリーのテキストを選択しています。",
  );
  await expect(panel.locator("textarea").inputValue()).resolves.toBe(
    "src/\n└── index.ts",
  );
  const order = await page.evaluate(() => {
    const list = document.querySelector(".mdmark-tree-list");
    return list?.nextElementSibling?.className;
  });
  expect(order).toBe("mdmark-copy-panel");
});
