import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 帯の幅が 30rem 以上のとき、タイトルと本文の右にボタンを横に並べる
const WIDE_VIEWPORT = { width: 800, height: 360 };

/** 本文とボタンの位置 */
async function readLayout(page: Awaited<ReturnType<typeof holder.openStory>>) {
  return page.evaluate(() => {
    const band = document.querySelector(".mdmark-config-band") as HTMLElement;
    const text = band.querySelector(
      '[data-slot="alert-description"]',
    ) as HTMLElement;
    const button = band.querySelector("button") as HTMLElement;
    const code = band.querySelector("p code") as HTMLElement;
    const bandBox = band.getBoundingClientRect();
    const textBox = text.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    return {
      buttonBelow: buttonBox.top >= textBox.bottom - 1,
      buttonRight: buttonBox.left >= textBox.right - 1,
      codeOutside: [...code.getClientRects()].some(
        (box) => box.right > bandBox.right || box.left < bandBox.left,
      ),
      position: getComputedStyle(band).position,
    };
  });
}

// 設定ファイルを読み込めない行を通知し、「設定ファイルを開く」を横に並べる（Default）
test("test_default", async () => {
  // 準備
  const page = await holder.openStory("vscode-configband--default");
  // 実行
  await page.setViewportSize(WIDE_VIEWPORT);
  // 検証
  const band = page.locator(".mdmark-config-band");
  await expect(band.getAttribute("role")).resolves.toBe("status");
  await expect(band.locator("h2").innerText()).resolves.toBe(
    "設定ファイルを読み込めません",
  );
  await expect(band.locator("p").innerText()).resolves.toBe(
    "mdmark.config.yaml の 4 行目を YAML として読み込めないため、この設定ファイルを重ねずに表示しています。",
  );
  await expect(band.locator("p code").allInnerTexts()).resolves.toEqual([
    "mdmark.config.yaml",
  ]);
  await expect(
    band.locator('button[data-action="openConfig"]').innerText(),
  ).resolves.toBe("設定ファイルを開く");
  const layout = await readLayout(page);
  expect(layout.buttonRight).toBe(true);
  expect(layout.buttonBelow).toBe(false);
  // 固定せず、スクロールで流れる
  expect(layout.position).toBe("static");
});

// 「設定ファイルを開く」は Tab で届き、Enter で押せる（Default）
test("test_default_when_keyboard", async () => {
  // 準備
  const page = await holder.openStory("vscode-configband--default");
  await page.evaluate(() => {
    const target = window as unknown as { __clicks: number };
    target.__clicks = 0;
    document
      .querySelector('[data-action="openConfig"]')
      ?.addEventListener("click", () => {
        target.__clicks += 1;
      });
  });
  // 実行
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  // 検証
  const result = await page.evaluate(() => ({
    action: (document.activeElement as HTMLElement).dataset.action,
    outline: getComputedStyle(document.activeElement as Element).outlineStyle,
    clicks: (window as unknown as { __clicks: number }).__clicks,
  }));
  expect(result.action).toBe("openConfig");
  expect(result.outline).not.toBe("none");
  expect(result.clicks).toBe(1);
});

// 帯の幅が 30rem 未満でパスが長いとき、ボタンが文の下へ回り、パスが帯の中で折り返す（NarrowLongPath）
test("test_narrow_long_path", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-configband--narrow-long-path");
  // 検証
  const band = page.locator(".mdmark-config-band");
  await expect(band.locator("p").innerText()).resolves.toBe(
    "docs/settings/mdmark/mdmark.config.workspace-shared.yaml の 12 行目を YAML として読み込めないため、この設定ファイルを重ねずに表示しています。",
  );
  const layout = await readLayout(page);
  expect(layout.buttonBelow).toBe(true);
  expect(layout.codeOutside).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 端末の設定を読み込めない行を、ホームを ~ にしたパスで通知する（SettingsUnreadable）
test("test_settings_unreadable", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-configband--settings-unreadable");
  // 検証
  await expect(page.locator(".mdmark-config-band p").innerText()).resolves.toBe(
    "~/.config/mdmark/settings.yaml の 3 行目を YAML として読み込めないため、この設定ファイルを重ねずに表示しています。",
  );
});

// 近いフォルダの設定を読み込めない行を、ワークスペースからのパスで通知する（NestedConfigUnreadable）
test("test_nested_config_unreadable", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "vscode-configband--nested-config-unreadable",
  );
  // 検証
  await expect(page.locator(".mdmark-config-band p").innerText()).resolves.toBe(
    "docs/mdmark.config.yaml の 7 行目を YAML として読み込めないため、この設定ファイルを重ねずに表示しています。",
  );
});

// 端末の設定が構造に合わないキーを通知し、行を出さない（SettingsInvalid）
test("test_settings_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-configband--settings-invalid");
  // 検証
  const band = page.locator(".mdmark-config-band");
  await expect(band.locator("p").innerText()).resolves.toBe(
    "~/.config/mdmark/settings.yaml の features.callout が設定の構造に合わないため、この設定ファイルを重ねずに表示しています。",
  );
  await expect(band.locator("p code").allInnerTexts()).resolves.toEqual([
    "~/.config/mdmark/settings.yaml",
    "features.callout",
  ]);
});

// 帯の地と文字はエディタの地と文字、帯と「設定ファイルを開く」の線と警告のアイコンは警告の線の色のトークンで変えられる（Default）
test("test_default_when_color_overridden", async () => {
  // 準備
  const page = await holder.openStory("vscode-configband--default");
  await page.addStyleTag({
    content:
      ":root { --background: rgb(1, 2, 3); --warning-border: rgb(4, 5, 6); --foreground: rgb(7, 8, 9); }",
  });
  // 実行
  const colors = await page.evaluate(() => {
    const band = getComputedStyle(
      document.querySelector(".mdmark-config-band") as Element,
    );
    const button = getComputedStyle(
      document.querySelector('[data-action="openConfig"]') as Element,
    );
    const icon = getComputedStyle(
      document.querySelector(".mdmark-config-band svg") as Element,
    );
    return {
      icon: icon.color,
      background: band.backgroundColor,
      text: band.color,
      bandBorder: band.borderTopColor,
      buttonBorder: button.borderTopColor,
    };
  });
  // 検証
  expect(colors).toEqual({
    icon: "rgb(4, 5, 6)",
    background: "rgb(1, 2, 3)",
    text: "rgb(7, 8, 9)",
    bandBorder: "rgb(4, 5, 6)",
    buttonBorder: "rgb(4, 5, 6)",
  });
});
