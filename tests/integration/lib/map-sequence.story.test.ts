import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  createBrowserHolder,
  pageOverflows,
  resolveColorIn,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// シーケンス図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1280, height: 1200 };

/** map のシーケンス図のストーリーを開く */
function openSequence(id: string): Promise<Page> {
  return holder.openStory(`parts-mapsequence--${id}`, WIDE);
}

/** 参加者の ID を左から並べる */
function participantOrder(page: Page) {
  return page.locator(".map-participant").evaluateAll((boxes) =>
    boxes
      .map((box) => ({
        id: box.getAttribute("data-participant") ?? "",
        left: box.getBoundingClientRect().left,
      }))
      .sort((a, b) => a.left - b.left)
      .map((box) => box.id),
  );
}

/** メッセージの線の番号ごとの、薄くしたか */
function messageDims(page: Page) {
  return page
    .locator("path.mdmark-diagram-wire[data-message]")
    .evaluateAll((paths) =>
      Object.fromEntries(
        paths.map((path) => [
          path.getAttribute("data-message"),
          path.classList.contains("map-dim"),
        ]),
      ),
    );
}

/** データの印を流しているメッセージの番号 */
function packetMessages(page: Page) {
  return page
    .locator(".map-packets .map-packet")
    .evaluateAll((packets) => [
      ...new Set(packets.map((packet) => packet.getAttribute("data-message"))),
    ]);
}

/** ブロックのタブの、種類と、開閉のボタン・名前のボタンの有無 */
function fragmentTabs(page: Page) {
  return page.locator(".map-seq-fragment-tab").evaluateAll((tabs) =>
    tabs.map((tab) => ({
      kind: tab.getAttribute("data-kind"),
      toggle: tab.querySelector("button.map-disclosure") !== null,
      enter: tab.querySelector("button.map-seq-fragment-title") !== null,
      text: tab.textContent ?? "",
    })),
  );
}

// 名前を持つ rect・loop の中の alt / else・注記・活性化・点線・× の矢じりを描く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openSequence("default");
  // 検証
  const tabs = await fragmentTabs(page);
  expect(tabs.map((tab) => tab.kind)).toEqual(["rect", "loop", "alt"]);
  expect(tabs[0]?.text).toContain("描く前の準備");
  await expect(
    page.locator(".map-seq-section-label").innerText(),
  ).resolves.toBe("[ブロックが無い]");
  await expect(page.locator(".map-seq-note").innerText()).resolves.toBe(
    "全ての範囲を描き終えてから返す",
  );
  await expect(page.locator(".map-seq-activation").count()).resolves.toBe(1);
  await expect(
    page.locator("path.mdmark-diagram-wire[stroke-dasharray]").count(),
  ).resolves.toBe(3);
  await expect(
    page
      .locator('path.mdmark-diagram-wire[data-message="5"]')
      .getAttribute("marker-end"),
  ).resolves.toContain("head-cross");
  const labels = await page
    .locator(".mdmark-diagram-label[data-message]")
    .allInnerTexts();
  expect(labels[0]).toBe("1 設定と Markdown");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 全ての矢印の種類を、点線・塗った矢じり・× ・非同期の開いた矢じり・両向きの矢じりで描き、ラベルの頭に番号を付ける（Arrows）
test("test_arrows", async () => {
  // 準備・実行
  const page = await openSequence("arrows");
  // 検証
  const wires = await page
    .locator("path.mdmark-diagram-wire[data-message]")
    .evaluateAll((paths) =>
      paths.map((path) => ({
        dashed: path.hasAttribute("stroke-dasharray"),
        end: (path.getAttribute("marker-end") ?? "").replace(/.*head-|\)/g, ""),
        start: (path.getAttribute("marker-start") ?? "").replace(
          /.*head-|\)/g,
          "",
        ),
      })),
    );
  expect(wires.map((wire) => wire.dashed)).toEqual([
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
  ]);
  expect(wires.map((wire) => wire.end)).toEqual([
    "",
    "",
    "filled",
    "filled",
    "cross",
    "cross",
    "async",
    "async",
    "filled",
    "filled",
  ]);
  expect(wires.slice(8).map((wire) => wire.start)).toEqual([
    "filled",
    "filled",
  ]);
  const labels = await page
    .locator(".mdmark-diagram-label[data-message]")
    .allInnerTexts();
  expect(labels.map((label) => label.split(" ")[0])).toEqual(
    Array.from({ length: 10 }, (_, index) => String(index + 1)),
  );
});

// 名前が 2 行の参加者は箱を高くし、最初のメッセージを一番高い箱の下から描く（TallParticipants）
test("test_tall_participants", async () => {
  // 準備・実行
  const page = await openSequence("tall-participants");
  // 検証
  const boxes = await page.locator(".map-participant").evaluateAll((heads) =>
    heads.map((head) => {
      const name = head.querySelector(".mdmark-diagram-node-name");
      const box = head.getBoundingClientRect();
      const text = name?.getBoundingClientRect();
      return {
        id: head.getAttribute("data-participant"),
        height: box.height,
        bottom: box.bottom,
        lines: name
          ? Math.round(
              (text?.height ?? 0) /
                Number.parseFloat(getComputedStyle(name).lineHeight),
            )
          : 0,
        inside: (text?.bottom ?? 0) <= box.bottom + 1,
      };
    }),
  );
  expect(boxes.map((box) => [box.id, box.lines, box.inside])).toEqual([
    ["A", 2, true],
    ["B", 1, true],
  ]);
  expect(boxes[0]?.height ?? 0).toBeGreaterThanOrEqual(boxes[1]?.height ?? 0);
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  const first = await page
    .locator('.mdmark-diagram-label[data-message="0"]')
    .boundingBox();
  expect(first?.y ?? 0).toBeGreaterThan(bottom);
});

// alt を閉じると「alt と名前・メッセージ 4 件」の 1 行にし、中の活性化の帯をその行から描く（BlockCollapsed）
test("test_block_collapsed", async () => {
  // 準備・実行
  const page = await openSequence("block-collapsed");
  // 検証
  const alt = page.locator('.map-seq-fragment-tab[data-kind="alt"]');
  await expect(alt.innerText()).resolves.toMatch(
    /alt\s*mermaid のブロックがある\s*メッセージ 4 件/,
  );
  const toggle = alt.locator("button.map-disclosure");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "alt「mermaid のブロックがある」を開く",
  );
  const labels = await page
    .locator(".mdmark-diagram-label[data-message]")
    .allInnerTexts();
  expect(labels).toEqual(["1 設定と Markdown", "2 map の範囲", "7 描いた文書"]);
  const activation = await page.locator(".map-seq-activation").boundingBox();
  const row = await alt.boundingBox();
  expect(activation?.y ?? 0).toBeLessThanOrEqual(row?.y ?? 0);
  expect((activation?.y ?? 0) + (activation?.height ?? 0)).toBeGreaterThan(
    row?.y ?? 0,
  );
});

// loop の中だけを描くと、loop の枠とタブを残し、タブの名前を押せず山形も無く、関わる参加者だけを並べる（BlockEntered）
test("test_block_entered", async () => {
  // 準備・実行
  const page = await openSequence("block-entered");
  // 検証
  const tabs = await fragmentTabs(page);
  expect(tabs[0]).toMatchObject({ kind: "loop", toggle: false, enter: false });
  expect(tabs.map((tab) => tab.kind)).toEqual(["loop", "alt"]);
  expect(await participantOrder(page)).toEqual([
    "mount",
    "marker",
    "mermaid",
    "layout",
  ]);
  const labels = await page
    .locator(".mdmark-diagram-label[data-message]")
    .allInnerTexts();
  expect(labels).toHaveLength(5);
});

// 参加者を 1 人選ぶと、その参加者のメッセージとライフラインのほかを薄くし、その線にデータの印を流す（ParticipantSelected）
test("test_participant_selected", async () => {
  // 準備・実行
  const page = await openSequence("participant-selected");
  // 検証
  const mount = page.locator('.map-participant[data-participant="mount"]');
  await expect(mount.getAttribute("data-selected")).resolves.not.toBeNull();
  await expect(mount.getAttribute("aria-label")).resolves.toBe(
    "mount（選択中）",
  );
  await expect(mount.getAttribute("aria-pressed")).resolves.toBeNull();
  expect(await messageDims(page)).toEqual({
    0: false,
    1: false,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
  });
  const lifelines = await page
    .locator(".mdmark-diagram-lifeline")
    .evaluateAll((lines) =>
      lines
        .filter((line) => !line.classList.contains("map-dim"))
        .map((line) => line.getAttribute("data-lifeline")),
    );
  expect(lifelines).toEqual(["mount"]);
  expect((await packetMessages(page)).sort()).toEqual([
    "0",
    "1",
    "4",
    "5",
    "6",
  ]);
});

// 再生の 3 つ目のメッセージは、送り手と受け手とその線のほかを薄くし、その線にデータの印を流す（Playing）
test("test_playing", async () => {
  // 準備・実行
  const page = await openSequence("playing");
  // 検証
  const dims = await messageDims(page);
  expect(
    Object.entries(dims)
      .filter(([, dim]) => !dim)
      .map(([message]) => message),
  ).toEqual(["2"]);
  const heads = await page
    .locator(".map-participant")
    .evaluateAll((boxes) =>
      boxes
        .filter((box) => !box.classList.contains("map-dim"))
        .map((box) => box.getAttribute("data-participant")),
    );
  expect(heads).toEqual(["marker", "mermaid"]);
  expect(await packetMessages(page)).toEqual(["2"]);
});

// 並び順を渡すと、参加者をその順に並べる（Reordering）
test("test_reordering", async () => {
  // 準備・実行
  const page = await openSequence("reordering");
  // 検証
  expect(await participantOrder(page)).toEqual([
    "user",
    "layout",
    "mount",
    "marker",
    "mermaid",
  ]);
});

// ブロックのボタン・参加者の箱は名前とキーを持ち、ブロックの枠線とライフラインは 1px で背景とのコントラスト比 3:1 以上（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openSequence("default");
  // 検証
  const loop = page.locator('.map-seq-fragment-tab[data-kind="loop"]');
  await expect(
    loop.locator("button.map-disclosure").getAttribute("aria-label"),
  ).resolves.toBe("loop「map の範囲ごと」を閉じる");
  await expect(
    loop.locator("button.map-seq-fragment-title").getAttribute("aria-label"),
  ).resolves.toBe("loop「map の範囲ごと」の中だけを見る");
  const box = page.locator('.map-participant[data-participant="user"]');
  await expect(box.getAttribute("tabindex")).resolves.toBe("0");
  await expect(box.getAttribute("aria-keyshortcuts")).resolves.toBe(
    "Enter Space Alt+ArrowLeft Alt+ArrowRight",
  );
  await expect(box.getAttribute("aria-label")).resolves.toBe("利用側のページ");
  const styles = await box.evaluate((element) => ({
    box: getComputedStyle(element).cursor,
    name: getComputedStyle(
      element.querySelector(".mdmark-diagram-node-name") ?? element,
    ).userSelect,
  }));
  expect(styles).toEqual({ box: "grab", name: "text" });
  const background = await resolveColorIn(
    page,
    "#storybook-root .mdmark",
    "var(--mdmark-color-bg)",
  );
  for (const selector of [
    "rect.map-seq-fragment:not(.is-rect)",
    "line.mdmark-diagram-lifeline",
  ]) {
    const stroke = await page
      .locator(selector)
      .first()
      .evaluate((element) => ({
        color: getComputedStyle(element).stroke,
        width: getComputedStyle(element).strokeWidth,
      }));
    expect(stroke.width, selector).toBe("1px");
    expect(
      contrastRatio(stroke.color, background),
      selector,
    ).toBeGreaterThanOrEqual(3);
  }
});
