import type { Locator } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { iconSvg } from "../../../src/parts/icons.ts";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// タイトルと行番号を出し、2 行目だけを強調の地と左の線で分ける（TitleAndLineNumbers）
test("test_title_and_line_numbers", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-codeblock--title-and-line-numbers",
  );
  // 検証
  await expect(page.locator(".mdmark-code-title").innerText()).resolves.toBe(
    "ts\napp.ts",
  );
  const lines = page.locator(".mdmark-code-line");
  await expect(lines.count()).resolves.toBe(3);
  const numbers = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      line: element.getAttribute("data-line"),
      content: getComputedStyle(element, "::before").content,
      background: getComputedStyle(element).backgroundColor,
      borderColor: getComputedStyle(element).borderInlineStartColor,
    })),
  );
  expect(numbers.map((item) => item.line)).toEqual(["1", "2", "3"]);
  expect(numbers[0]?.content).toContain("1");
  expect(numbers[1]?.background).not.toBe(numbers[0]?.background);
  expect(numbers[1]?.borderColor).not.toBe(numbers[0]?.borderColor);
  // 行番号は文字を選んで写す中身に入らない
  const copied = await page.locator("#storybook-root pre").evaluate((pre) => {
    const selection = window.getSelection();
    selection?.selectAllChildren(pre);
    return selection?.toString() ?? "";
  });
  expect(copied).toBe(
    [
      'import { mount } from "mdmark";',
      'const doc = await fetch("/README.md");',
      'mount(document.querySelector("#doc"), await doc.text());',
    ].join("\n"),
  );
});

// 追加した行・削除した行・強調を色と行頭のマーカーで分け、マーカーの無い行も文字の頭の位置を合わせる（LineMarks）
test("test_line_marks", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--line-marks");
  // 検証
  const marks = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        kind: element.getAttribute("data-kind"),
        sign: getComputedStyle(element, "::after").content,
        background: getComputedStyle(element).backgroundColor,
        textLeft: element
          .querySelector(".mdmark-code-text")
          ?.getBoundingClientRect().left,
      })),
    );
  expect(marks.map((item) => item.kind)).toEqual([
    "del",
    "add",
    "highlight",
    null,
  ]);
  expect(marks[0]?.sign).toContain("-");
  expect(marks[1]?.sign).toContain("+");
  expect(new Set(marks.map((item) => item.background)).size).toBe(4);
  expect(new Set(marks.map((item) => item.textLeft)).size).toBe(1);
  await expect(page.locator(".mdmark-code-title").count()).resolves.toBe(0);
});

// タイトルだけなら行に分けず、今の pre のままタイトルの帯の下に配置する（TitleOnly）
test("test_title_only", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--title-only");
  // 検証
  await expect(page.locator(".mdmark-code-title").innerText()).resolves.toBe(
    "yaml\nmdmark.config.yaml",
  );
  await expect(page.locator(".mdmark-code-line").count()).resolves.toBe(0);
  await expect(
    page.locator("#storybook-root figure > pre").getAttribute("class"),
  ).resolves.toBe(null);
  await expect(
    page.locator("#storybook-root pre").getAttribute("aria-label"),
  ).resolves.toBe("コード: mdmark.config.yaml");
});

// 2 桁の行番号を統一し、空の行も 1 行の高さを取り、9〜10 行目を強調する（TwoDigits）
test("test_two_digits", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--two-digits");
  // 検証
  const lines = page.locator(".mdmark-code-line");
  await expect(lines.count()).resolves.toBe(13);
  await expect(
    page.locator("#storybook-root pre code").getAttribute("style"),
  ).resolves.toContain("--mdmark-code-digits: 2");
  const layout = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      kind: element.getAttribute("data-kind"),
      height: element.getBoundingClientRect().height,
      numberRight:
        element.getBoundingClientRect().left +
        Number.parseFloat(getComputedStyle(element, "::before").left) +
        Number.parseFloat(getComputedStyle(element, "::before").width),
    })),
  );
  expect(
    layout.flatMap((item, index) =>
      item.kind === "highlight" ? [index + 1] : [],
    ),
  ).toEqual([9, 10]);
  const emptyHeight = layout[1]?.height ?? 0;
  expect(emptyHeight).toBeGreaterThan(10);
  expect(emptyHeight).toBeCloseTo(layout[0]?.height ?? 0, 0);
  expect(new Set(layout.map((item) => Math.round(item.numberRight))).size).toBe(
    1,
  );
});

// lineStart が 10 の行番号を 10〜12 にし、11〜12 行目を強調して、桁の数の幅を 2 桁で取る（LineStart）
test("test_line_start", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--line-start");
  // 検証
  const lines = page.locator(".mdmark-code-line");
  const layout = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      line: element.getAttribute("data-line"),
      kind: element.getAttribute("data-kind"),
    })),
  );
  expect(layout.map((item) => item.line)).toEqual(["10", "11", "12"]);
  expect(
    layout.flatMap((item) => (item.kind === "highlight" ? [item.line] : [])),
  ).toEqual(["11", "12"]);
  await expect(
    page.locator("#storybook-root pre code").getAttribute("style"),
  ).resolves.toContain("--mdmark-code-digits: 2");
});

// 幅を超えるタイトルは帯の中で折り返し、行はブロックの中で横にスクロールして行の地を右端まで敷く（LongLineAndTitle）
test("test_long_line_and_title", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--long-line-and-title");
  // 検証
  const title = await page
    .locator(".mdmark-code-title")
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      fits: element.scrollWidth <= element.clientWidth,
    }));
  expect(title.height).toBeGreaterThan(title.lineHeight * 2);
  expect(title.fits).toBe(true);
  const scroll = await page
    .locator("#storybook-root pre")
    .evaluate((element) => ({
      scrolls: element.scrollWidth > element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
  expect(scroll.scrolls).toBe(true);
  expect(scroll.overflowX).toBe("auto");
  const widths = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().width),
      ),
    );
  expect(new Set(widths).size).toBe(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** ボタンの中の `svg` の中身が、アイコンの HTML の中身と同じか */
function hasIcon(button: Locator, icon: Parameters<typeof iconSvg>[0]) {
  return button.locator("svg").evaluate((svg, expected) => {
    const template = document.createElement("template");
    template.innerHTML = expected;
    return (
      svg.innerHTML === (template.content.querySelector("svg")?.innerHTML ?? "")
    );
  }, iconSvg(icon));
}

/** 帯の左端の言語のラベルと右端のコピーのボタンの、帯の中での位置を返却する */
function barLayout(page: Awaited<ReturnType<typeof holder.openStory>>) {
  return page.locator(".mdmark-code-bar").evaluate((bar) => {
    const rect = bar.getBoundingClientRect();
    const lang = bar
      .querySelector(".mdmark-code-lang")
      ?.getBoundingClientRect();
    const copy = bar
      .querySelector(".mdmark-code-copy")
      ?.getBoundingClientRect();
    return {
      langLeft: lang ? lang.left - rect.left : undefined,
      copyRight: copy ? rect.right - copy.right : undefined,
      lineHeight: Number.parseFloat(getComputedStyle(bar).lineHeight),
      height: rect.height,
    };
  });
}

// 言語のラベルを帯の左端の上端のタブに、コピーのボタンを右端に配置し、帯を本文と同じ地にして間に線を引かない（LanguageLabel）
test("test_language_label", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--language-label");
  // 検証
  await expect(
    page.locator(".mdmark-code-lang-name").innerText(),
  ).resolves.toBe("ts");
  await expect(
    page.locator(".mdmark-code-lang-name").getAttribute("aria-hidden"),
  ).resolves.toBe("true");
  await expect(page.locator(".mdmark-code-file").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-code-title").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-code-copy").innerText()).resolves.toBe(
    "コピー",
  );
  const layout = await barLayout(page);
  expect(layout.langLeft).toBeLessThan(16);
  expect(layout.copyRight).toBeLessThan(16);
  const bar = await page.locator(".mdmark-code-bar").evaluate((element) => {
    const pre = element.nextElementSibling as HTMLElement;
    const lang = element.querySelector(".mdmark-code-lang") as HTMLElement;
    return {
      barBackground: getComputedStyle(element).backgroundColor,
      barBorderBottom: getComputedStyle(element).borderBottomWidth,
      preBackground: getComputedStyle(pre).backgroundColor,
      preBorderTop: getComputedStyle(pre).borderTopWidth,
      langBorder: getComputedStyle(lang).borderTopWidth,
      langBackground: getComputedStyle(lang).backgroundColor,
      langTop:
        lang.getBoundingClientRect().top - element.getBoundingClientRect().top,
    };
  });
  expect(bar.barBackground).toBe(bar.preBackground);
  expect(bar.barBorderBottom).toBe("0px");
  expect(bar.preBorderTop).toBe("0px");
  expect(bar.langBorder).toBe("0px");
  expect(bar.langBackground).not.toBe(bar.barBackground);
  expect(Math.abs(bar.langTop)).toBeLessThanOrEqual(1);
  await expect(
    page.locator("#storybook-root pre").getAttribute("aria-label"),
  ).resolves.toBe("コード: ts");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// `言語:ファイル名` のコードブロックは、帯の左端に言語と、縦線で区切ったファイル名を出す（FileName）
test("test_file_name", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--file-name");
  // 検証
  await expect(
    page.locator(".mdmark-code-lang-name").innerText(),
  ).resolves.toBe("python");
  await expect(page.locator(".mdmark-code-file").innerText()).resolves.toBe(
    "hoge.py",
  );
  const separator = await page.locator(".mdmark-code-file").evaluate((el) => ({
    width: getComputedStyle(el).borderInlineStartWidth,
    style: getComputedStyle(el).borderInlineStartStyle,
  }));
  expect(separator).toEqual({ width: "1px", style: "solid" });
  await expect(
    page.locator("#storybook-root pre").getAttribute("aria-label"),
  ).resolves.toBe("コード: hoge.py");
  const layout = await barLayout(page);
  expect(layout.langLeft).toBeLessThan(16);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 帯の幅を超えるファイル名とタイトルは帯の中で折り返し、コピーのボタンは右端に残る（LongFileName）
test("test_long_file_name", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--long-file-name");
  // 検証
  const bar = await page.locator(".mdmark-code-bar").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const file = element.querySelector(".mdmark-code-file");
    const copy = element
      .querySelector(".mdmark-code-copy")
      ?.getBoundingClientRect();
    return {
      height: rect.height,
      fileFits: (file?.scrollWidth ?? 1) <= (file?.clientWidth ?? 0),
      fileWraps:
        (file?.getBoundingClientRect().height ?? 0) >
        Number.parseFloat(getComputedStyle(file as Element).lineHeight) * 1.5,
      copyRight: copy ? rect.right - copy.right : undefined,
      copyInside: copy
        ? copy.left >= rect.left && copy.right <= rect.right
        : false,
      barFits: element.scrollWidth <= element.clientWidth,
    };
  });
  expect(bar.fileFits).toBe(true);
  expect(bar.fileWraps).toBe(true);
  expect(bar.barFits).toBe(true);
  expect(bar.copyInside).toBe(true);
  expect(bar.copyRight).toBeLessThan(16);
  await expect(
    page.locator(".mdmark-code-title").innerText(),
  ).resolves.toContain("色分けの対象を探す");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 言語の無いコードブロックは、言語のラベルを出さず、帯はコピーのボタンだけを持つ（NoLanguage）
test("test_no_language", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--no-language");
  // 検証
  await expect(page.locator(".mdmark-code-lang").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-code-copy").count()).resolves.toBe(1);
  await expect(
    page.locator("#storybook-root pre").getAttribute("aria-label"),
  ).resolves.toBe("コード");
  const layout = await barLayout(page);
  expect(layout.copyRight).toBeLessThan(16);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// コードをコピーしたとき、ボタンを「コピーしました」と check のアイコンにする（Copied）
test("test_copied", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--copied");
  // 検証
  const button = page.locator(".mdmark-code-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("copied");
  await expect(button.innerText()).resolves.toBe("コピーしました");
  await expect(hasIcon(button, "check")).resolves.toBe(true);
  await expect(page.locator(".mdmark-code-status").innerText()).resolves.toBe(
    "コードをコピーしました",
  );
});

// コードをコピーできなかったとき、ボタンを「コピーできませんでした」と circle-alert のアイコンにする（CopyFailed）
test("test_copy_failed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--copy-failed");
  // 検証
  const button = page.locator(".mdmark-code-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("failed");
  await expect(button.innerText()).resolves.toBe("コピーできませんでした");
  await expect(hasIcon(button, "circle-alert")).resolves.toBe(true);
  await expect(page.locator(".mdmark-code-status").innerText()).resolves.toBe(
    "コードをコピーできませんでした",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** コードの行の不透明度を、上から並べて返却する */
function lineOpacities(lines: Locator): Promise<number[]> {
  return lines.evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).opacity)),
  );
}

// focus の 3〜4 行目のほかを薄くし、ポインターを乗せると全ての行を戻す（Focus）
test("test_focus", async () => {
  // 準備
  const page = await holder.openStory("parts-codeblock--focus");
  const lines = page.locator(".mdmark-code-line");
  // 検証: focus の行だけが薄くない
  const opacities = await lineOpacities(lines);
  opacities.forEach((opacity, index) => {
    if (index === 2 || index === 3) {
      expect(opacity).toBe(1);
    } else {
      expect(opacity).toBeLessThan(1);
    }
  });
  // 実行: コードブロックにポインターを乗せる
  await page.locator("#storybook-root pre").hover();
  // 検証: 全ての行を戻す
  await expect.poll(() => lineOpacities(lines)).toEqual(opacities.map(() => 1));
});

// warning の 2 行目と error の 5 行目を、地と左の線の色と行頭の `!`・`×` で分ける（ErrorWarning）
test("test_error_warning", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--error-warning");
  // 検証
  const styles = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderInlineStartColor,
        mark: getComputedStyle(element, "::after").content,
      })),
    );
  const [plain, warning, , , error] = styles;
  expect(warning?.mark).toContain("!");
  expect(error?.mark).toContain("×");
  expect(new Set([plain, warning, error].map((s) => s?.background)).size).toBe(
    3,
  );
  expect(new Set([plain, warning, error].map((s) => s?.border)).size).toBe(3);
});

// 全て開いた畳める行は、インデントの縦線を描き、ポインターを乗せた行だけに開閉のボタンを出す（Foldable）
test("test_foldable", async () => {
  // 準備
  const page = await holder.openStory("parts-codeblock--foldable");
  const lines = page.locator(".mdmark-code-line");
  const toggles = page.locator(".mdmark-code-fold");
  // 検証: 畳める 4 行に開いた状態のボタンがあり、隠れた行が無い
  await expect(toggles.count()).resolves.toBe(4);
  await expect(
    toggles.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-expanded")),
    ),
  ).resolves.toEqual(["true", "true", "true", "true"]);
  await expect(page.locator(".mdmark-code-line[hidden]").count()).resolves.toBe(
    0,
  );
  // 検証: インデントのレベルの数の縦線
  const levels = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      indent: element.getAttribute("data-indent") ?? "0",
      level: getComputedStyle(element)
        .getPropertyValue("--mdmark-code-level")
        .trim(),
    })),
  );
  for (const { indent, level } of levels) {
    expect(level).toBe(indent);
  }
  // 検証: ポインターを乗せる前はボタンを出さず、乗せた行だけに出す
  const opacity = (index: number) =>
    toggles
      .nth(index)
      .evaluate((element) => Number(getComputedStyle(element).opacity));
  await expect(opacity(0)).resolves.toBe(0);
  await lines.nth(2).hover();
  await expect.poll(() => opacity(1)).toBe(1);
  await expect(opacity(0)).resolves.toBe(0);
});

// ポインターが開閉のボタンの列に乗っているときは、畳める全ての行の開閉のボタンを出す（FoldColumnHovered）
test("test_fold_column_hovered", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--fold-column-hovered");
  // 検証
  await expect(
    page.locator("#storybook-root pre").getAttribute("data-fold-hover"),
  ).resolves.not.toBeNull();
  await expect(
    page
      .locator(".mdmark-code-fold")
      .evaluateAll((elements) =>
        elements.map((element) => Number(getComputedStyle(element).opacity)),
      ),
  ).resolves.toEqual([1, 1, 1, 1]);
});

// `fold=3` の 3 行目は、開閉のボタンを常に出して `⋯` を配置し、閉じ括弧の 8 行目を残す（Folded）
test("test_folded", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--folded");
  // 検証
  const hidden = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) => element.hasAttribute("hidden")),
    );
  expect(hidden).toEqual([
    false,
    false,
    false,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
  ]);
  const third = page.locator(".mdmark-code-line").nth(2);
  const toggle = third.locator(":scope > .mdmark-code-fold");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(
    toggle.evaluate((element) => Number(getComputedStyle(element).opacity)),
  ).resolves.toBe(1);
  const more = third.locator(":scope > .mdmark-code-fold-more");
  await expect(more.innerText()).resolves.toBe("⋯");
  await expect(more.isVisible()).resolves.toBe(true);
  await expect(
    page.locator(".mdmark-code-line").nth(7).innerText(),
  ).resolves.toContain("}");
});

// Shift で畳んでから 1 行目だけを開いた状態は、内側の 3・4・9 行目を畳んだまま出す（FoldNested）
test("test_fold_nested", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--fold-nested");
  // 検証
  const states = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) =>
        element
          .querySelector(":scope > .mdmark-code-fold")
          ?.getAttribute("aria-expanded"),
      ),
    );
  expect(states[0]).toBe("true");
  for (const index of [2, 3, 8]) {
    expect(states[index]).toBe("false");
  }
  const hidden = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) => element.hasAttribute("hidden")),
    );
  expect(hidden.slice(3, 7)).toEqual([true, true, true, true]);
  expect(hidden[9]).toBe(true);
  expect(hidden[1]).toBe(false);
  // ⋯ は畳んだ 3・4・9 行目に配置し、隠れた 4 行目の分は見えない
  const more = page.locator(".mdmark-code-line > .mdmark-code-fold-more");
  await expect(more.count()).resolves.toBe(3);
  await expect(
    more.evaluateAll(
      (buttons) =>
        buttons.filter((button) => button.getClientRects().length > 0).length,
    ),
  ).resolves.toBe(2);
});

// 行番号の無いコードブロックでは、開閉のボタンを行の頭の余白に配置し、文字に重ねない（FoldNoLineNumbers）
test("test_fold_no_line_numbers", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--fold-no-line-numbers");
  // 検証
  const boxes = await page
    .locator(".mdmark-code-line[data-folded]")
    .evaluate((line) => {
      const button = line.querySelector(":scope > .mdmark-code-fold");
      const text = line.querySelector(".mdmark-code-text");
      const pre = line.closest("pre");
      return {
        button: button?.getBoundingClientRect().toJSON(),
        text: text?.getBoundingClientRect().toJSON(),
        pre: pre?.getBoundingClientRect().toJSON(),
      };
    });
  expect(boxes.button.right).toBeLessThanOrEqual(boxes.text.left);
  expect(boxes.button.left).toBeGreaterThanOrEqual(boxes.pre.left);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// wrap の長い行を枠の幅で折り返し、行番号を折り返した行の 1 行目にだけ出し、横スクロールを出さない（Wrap）
test("test_wrap", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--wrap", {
    width: 390,
    height: 844,
  });
  // 検証
  const result = await page.locator("#storybook-root pre").evaluate((pre) => {
    const lines = [...pre.querySelectorAll(".mdmark-code-line")];
    return {
      fits: pre.scrollWidth <= pre.clientWidth,
      heights: lines.map((line) => line.getBoundingClientRect().height),
      numberTop: getComputedStyle(lines[1] as Element, "::before").top,
    };
  });
  expect(result.fits).toBe(true);
  const [first = 0, second = 0] = result.heights;
  expect(second).toBeGreaterThanOrEqual(first * 2);
  expect(result.numberTop).toBe("0px");
  await expect(pageOverflows(page)).resolves.toBe(false);
});
