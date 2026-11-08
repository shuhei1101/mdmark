import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** カードのストーリーを開き、カードの中身を返す */
async function open(id: string) {
  const page = await holder.openStory(`parts-card--${id}`);
  return { page, card: await readCard(page) };
}

/** カードの種類・文字・アイコンの形 */
function readCard(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector("a.mdmark-card") as HTMLElement;
    const icon = card.querySelector(".mdmark-card-icon") as HTMLElement;
    const text = (selector: string) =>
      card.querySelector(selector)?.textContent ?? null;
    return {
      cards: document.querySelectorAll(".mdmark a").length,
      kind: card.dataset.card ?? null,
      fileKind: card.dataset.fileKind ?? null,
      href: card.getAttribute("href"),
      title: text(".mdmark-card-title"),
      domain: text(".mdmark-card-domain"),
      url: text(".mdmark-card-url"),
      iconHidden: icon.getAttribute("aria-hidden"),
      icon: getComputedStyle(icon).getPropertyValue("--mdmark-icon"),
      // 読み上げの順（タイトル・ドメイン・URL）
      order: [
        ...card.querySelectorAll(
          ".mdmark-card-title, .mdmark-card-domain, .mdmark-card-url",
        ),
      ].map((element) => element.className),
    };
  });
}

// リンクのカードは、書いた文字・ドメイン・URL を出す（Link）
test("test_link", async () => {
  // 準備・実行
  const { card } = await open("link");
  // 検証
  expect(card.cards).toBe(1);
  expect(card.kind).toBe("link");
  expect(card.href).toBe("https://github.com/shuhei1101/mdmark");
  expect(card.title).toBe("mdmark のリポジトリ");
  expect(card.domain).toBe("github.com");
  expect(card.url).toBe("https://github.com/shuhei1101/mdmark");
  expect(card.iconHidden).toBe("true");
  expect(card.icon).toContain("data:image/svg+xml");
  expect(card.order).toEqual([
    "mdmark-card-title",
    "mdmark-card-domain",
    "mdmark-card-url",
  ]);
});

// URL をそのまま書いたリンクのカードは、タイトルにスキームを除いた URL を出す（BareUrl）
test("test_bare_url", async () => {
  // 準備・実行
  const { card } = await open("bare-url");
  // 検証
  expect(card.title).toBe("www.jsdelivr.com/package/gh/shuhei1101/mdmark");
  expect(card.domain).toBe("www.jsdelivr.com");
  expect(card.url).toBe(
    "https://www.jsdelivr.com/package/gh/shuhei1101/mdmark",
  );
});

// 長い URL と長いタイトルは、省略せずカードの中で折り返す（Long）
test("test_long", async () => {
  // 準備・実行
  const { page } = await open("long");
  // 検証
  const layout = await page.evaluate(() => {
    const card = document.querySelector("a.mdmark-card") as HTMLElement;
    const title = card.querySelector(".mdmark-card-title") as HTMLElement;
    const url = card.querySelector(".mdmark-card-url") as HTMLElement;
    const cardBox = card.getBoundingClientRect();
    const lines = (element: HTMLElement) =>
      element.getBoundingClientRect().height /
      Number.parseFloat(getComputedStyle(element).lineHeight);
    return {
      titleLines: lines(title),
      urlLines: lines(url),
      titleOutside: title.getBoundingClientRect().right > cardBox.right,
      urlOutside: url.getBoundingClientRect().right > cardBox.right,
      ellipsis: getComputedStyle(url).textOverflow,
      urlText: url.textContent,
    };
  });
  expect(layout.titleLines).toBeGreaterThan(1.5);
  expect(layout.urlLines).toBeGreaterThan(1.5);
  expect(layout.titleOutside).toBe(false);
  expect(layout.urlOutside).toBe(false);
  expect(layout.ellipsis).not.toBe("ellipsis");
  expect(layout.urlText).toContain(
    "%E6%96%87%E6%9B%B8%E3%82%92%E6%8F%8F%E3%81%8F.yaml",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// PDF の添付のカードは、種類のアイコンと `PDF`・ファイル名を出す（FilePdf）
test("test_file_pdf", async () => {
  // 準備
  const link = await open("link");
  // 実行
  const { card } = await open("file-pdf");
  // 検証
  expect(card.kind).toBe("file");
  expect(card.fileKind).toBe("pdf");
  expect(card.title).toBe("設計の資料");
  expect(card.domain).toBe("PDF");
  expect(card.url).toBe("design.pdf");
  expect(card.icon).not.toBe(link.card.icon);
});

// 表計算の添付のカードは、表計算のアイコンと拡張子を出す（FileSheet）
test("test_file_sheet", async () => {
  // 準備
  const pdf = await open("file-pdf");
  // 実行
  const { card } = await open("file-sheet");
  // 検証
  expect(card.fileKind).toBe("sheet");
  expect(card.title).toBe("見積もり");
  expect(card.domain).toBe("XLSX");
  expect(card.url).toBe("estimate.xlsx");
  expect(card.icon).not.toBe(pdf.card.icon);
});

// 圧縮ファイルの添付のカードは、圧縮ファイルのアイコンと拡張子を出す（FileArchive）
test("test_file_archive", async () => {
  // 準備
  const pdf = await open("file-pdf");
  // 実行
  const { card } = await open("file-archive");
  // 検証
  expect(card.fileKind).toBe("archive");
  expect(card.title).toBe("samples.zip");
  expect(card.domain).toBe("ZIP");
  expect(card.url).toBe("samples.zip");
  expect(card.icon).not.toBe(pdf.card.icon);
});

// スライドの添付のカードは、拡張子とファイル名を出す（FileSlide）
test("test_file_slide", async () => {
  // 準備・実行
  const { card } = await open("file-slide");
  // 検証
  expect(card.fileKind).toBe("slide");
  expect(card.title).toBe("発表の原稿");
  expect(card.domain).toBe("KEY");
  expect(card.url).toBe("notes.key");
  expect(card.icon).toContain("data:image/svg+xml");
});

// 印刷では、リンク先の URL を文字で出す（Print）
test("test_print", async () => {
  // 準備
  const { page } = await open("print");
  // 実行
  await page.emulateMedia({ media: "print" });
  // 検証
  const after = await page.locator("a.mdmark-card").evaluate((element) => ({
    content: getComputedStyle(element, "::after").content,
    display: getComputedStyle(element, "::after").display,
    href: element.getAttribute("href"),
  }));
  // ブラウザは attr() を解決せずに返すため、href を出す content と href の値を見る
  expect(after.content).toMatch(/attr\(href\)|https:\/\/github\.com/);
  expect(after.display).not.toBe("none");
  expect(after.href).toBe("https://github.com/shuhei1101/mdmark");
});
