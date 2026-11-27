import { afterEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { CONFIG, mapRange, SEQUENCE } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** シーケンス図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSequenceView = () => import("../../../../src/map/sequence-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** sessionStorage に保った 1 つ目の図の状態 */
const saved = () =>
  JSON.parse(
    sessionStorage.getItem(`mdmark-map:${location.pathname}#1`) ?? "{}",
  );

/** シーケンス図を描いて付ける */
async function setUp() {
  const { attachMapSequence } = await loadSequenceView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: SEQUENCE })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapSequence(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs("").args,
    }),
  );
  return root;
}

// Alt + →（正常系）
test("test_attach_map_sequence_when_reorder", async () => {
  // 準備
  const root = await setUp();
  const first = root.querySelector<HTMLElement>(
    '.map-participant[data-participant="user"] .mdmark-diagram-node-hit',
  ) as HTMLElement;
  first.focus();
  // 実行
  first.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
    }),
  );
  // 検証
  expect(saved().order?.slice(0, 2)).toEqual(["mount", "user"]);
  expect(document.activeElement).toBe(
    root.querySelector(
      '.map-participant[data-participant="user"] .mdmark-diagram-node-hit',
    ),
  );
});

// Enter で参加者を選ぶ（正常系）
test("test_attach_map_sequence_when_select_by_key", async () => {
  // 準備
  const root = await setUp();
  const hit = root.querySelector<HTMLElement>(
    '.map-participant[data-participant="mount"] .mdmark-diagram-node-hit',
  ) as HTMLElement;
  hit.focus();
  // 実行
  hit.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  // 検証
  expect(saved().selected).toEqual(["mount"]);
});

// 中だけを描く（正常系）
test("test_attach_map_sequence_when_enter_block", async () => {
  // 準備
  const root = await setUp();
  // 実行
  root
    .querySelector<HTMLButtonElement>(
      'button[aria-label="loop「map の範囲ごと」の中だけを見る"]',
    )
    ?.click();
  // 検証
  expect(saved().entered).toBe("1");
  const shown = [...root.querySelectorAll("[data-participant]")].map((item) =>
    item.getAttribute("data-participant"),
  );
  expect(shown).toEqual(["mount", "marker", "mermaid", "layout"]);
});

// 選んだ参加者の印（正常系）
test("test_attach_map_sequence_when_packets", async () => {
  // 準備
  const root = await setUp();
  const head = root.querySelector<HTMLElement>(
    '.map-participant[data-participant="mount"]',
  ) as HTMLElement;
  // 実行
  head.click();
  // 検証
  const lines = [...root.querySelectorAll(".map-packet[data-message]")].map(
    (item) => Number(item.getAttribute("data-message")),
  );
  expect(lines.length).toBeGreaterThan(0);
  const { parseSequence } = await import("../../../../src/map/sequence.ts");
  const { SEQUENCE: source } = await import("../../helpers/map.ts");
  const messages = parseSequence(source).messages;
  for (const at of lines) {
    const message = messages[at];
    expect(message?.from === "mount" || message?.to === "mount").toBe(true);
  }
});

// 並べ替えのドラッグを pointercancel で止めたとき、並び順を変えない（正常系）
test("test_attach_map_sequence_when_reorder_cancelled", async () => {
  // 準備: 参加者を列に並べるため、描いた文書の CSS を読み込む
  addStyles();
  const root = await setUp();
  const heads = [...root.querySelectorAll<HTMLElement>(".map-participant")];
  const first = heads[0] as HTMLElement;
  const fourth = heads[3] as HTMLElement;
  const start = first.getBoundingClientRect();
  const goal = fourth.getBoundingClientRect();
  const point = (x: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType: "touch",
    clientX: x,
    clientY: start.y + 2,
  });
  // 実行: 4 人目の列まで動かしてから pointercancel、続けて pointerup
  first.dispatchEvent(new PointerEvent("pointerdown", point(start.x + 2)));
  window.dispatchEvent(
    new PointerEvent("pointermove", point(goal.x + goal.width / 2)),
  );
  window.dispatchEvent(
    new PointerEvent("pointercancel", point(goal.x + goal.width / 2)),
  );
  window.dispatchEvent(
    new PointerEvent("pointerup", point(goal.x + goal.width / 2)),
  );
  // 検証
  expect(saved().order).toBeUndefined();
  expect(root.querySelector(".map-insert-line")).toBeNull();
  expect(
    root.querySelector<HTMLElement>('[data-participant="user"]')?.style
      .translate,
  ).toBe("");
});

// 設定に無くても actor に人のアイコンを付ける（正常系）
test("test_attach_map_sequence_when_actor_default", async () => {
  // 準備
  const { attachMapSequence } = await loadSequenceView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const mermaid =
    "sequenceDiagram\n  actor U as 読者\n  participant P\n  U->>P: 開く\n";
  const iconOf = (root: HTMLElement, id: string) =>
    root
      .querySelector(`[data-participant="${id}"] .mdmark-map-icon`)
      ?.getAttribute("data-icon") ?? null;
  const attachWith = (kinds: Record<string, { icon: string }>) => {
    const root = createRootFromHtml(renderDoc(mapRange({ mermaid })).html);
    const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
    handles.push(
      attachMapSequence(
        range,
        resolveConfig({ config: { map: { ...CONFIG, kinds } } }),
        { args: parseMapArgs("").args },
      ),
    );
    return root;
  };
  // 実行
  const withoutActor = attachWith({});
  const withActor = attachWith({ actor: { icon: "smile" } });
  // 検証
  expect(iconOf(withoutActor, "U")).toBe("user");
  expect(iconOf(withoutActor, "P")).toBeNull();
  expect(iconOf(withActor, "U")).toBe("smile");
  // 人のアイコンは種類の行に svg で描かれる
  expect(
    withoutActor.querySelector(
      '[data-participant="U"] .mdmark-diagram-node-kind svg',
    ),
  ).not.toBeNull();
});

/** 強調で薄くした要素を、要素の種類と持ち主で並べる */
const dimmedKeys = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".map-dim")]
    .map((element) =>
      [
        element.tagName,
        element.getAttribute("data-participant") ?? "",
        element.getAttribute("data-lifeline") ?? "",
        element.getAttribute("data-message") ?? "",
        element.classList.contains("mdmark-diagram-label") ? "label" : "",
      ].join("|"),
    )
    .sort();

/** 参加者を押して選び、Esc で解いて、選んだときに薄くした要素を返却する */
const dimmedWhenSelected = (root: HTMLElement, id: string): string[] => {
  const head = root.querySelector<HTMLElement>(
    `.map-participant[data-participant="${id}"]`,
  ) as HTMLElement;
  head.click();
  const keys = dimmedKeys(root);
  root
    .querySelector(".mdmark-map figure")
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  return keys;
};

/** その参加者が送る・受けるメッセージの線の数 */
const messageCountOf = async (id: string): Promise<number> => {
  const { parseSequence } = await import("../../../../src/map/sequence.ts");
  return parseSequence(SEQUENCE).messages.filter(
    (message) => message.from === id || message.to === id,
  ).length;
};

/** ポインターの出来事を発火する */
const point = (
  target: Element,
  type: "pointerover" | "pointerout",
  options: { pointerType?: string; relatedTarget?: Element | null } = {},
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      pointerType: options.pointerType ?? "mouse",
      relatedTarget: options.relatedTarget ?? null,
    }),
  );

const lifelineHitOf = (root: HTMLElement, id: string) =>
  root.querySelector(`.map-lifeline-hit[data-lifeline="${id}"]`) as Element;
const headOf = (root: HTMLElement, id: string) =>
  root.querySelector(`.map-participant[data-participant="${id}"]`) as Element;

// ライフラインのポインターの強調（正常系）
test("test_attach_map_sequence_when_participant_hovered", async () => {
  // 準備
  const root = await setUp();
  const expected = dimmedWhenSelected(root, "mount");
  const stored = sessionStorage.getItem(`mdmark-map:${location.pathname}#1`);
  const hit = lifelineHitOf(root, "mount");
  // 実行
  point(hit, "pointerover");
  const hovered = dimmedKeys(root);
  const packets = root.querySelectorAll(".map-packets-hover").length;
  point(hit, "pointerout", { relatedTarget: document.body });
  // 検証
  expect(expected.length).toBeGreaterThan(0);
  expect(hovered).toEqual(expected);
  expect(packets).toBe(await messageCountOf("mount"));
  expect(dimmedKeys(root)).toEqual([]);
  expect(root.querySelector(".map-packets-hover")).toBeNull();
  expect(sessionStorage.getItem(`mdmark-map:${location.pathname}#1`)).toBe(
    stored,
  );
});

// 選んでいる間はポインターで変えない（正常系）
test("test_attach_map_sequence_when_hovered_while_selected", async () => {
  // 準備
  const root = await setUp();
  (headOf(root, "mount") as HTMLElement).click();
  const before = dimmedKeys(root);
  // 実行
  point(
    root.querySelector(
      '.map-participant[data-participant="layout"] .mdmark-diagram-node-hit',
    ) as Element,
    "pointerover",
  );
  // 検証
  expect(dimmedKeys(root)).toEqual(before);
  expect(root.querySelector(".map-packets-hover")).toBeNull();
});

// 選択を解いた直後は出さない（正常系）
test("test_attach_map_sequence_when_hovered_after_unselect", async () => {
  // 準備
  const root = await setUp();
  const expected = dimmedWhenSelected(root, "mount");
  // 実行: 箱を押して選び、もう一度押して解き、同じ箱にポインターを合わせる
  point(headOf(root, "mount"), "pointerover");
  (headOf(root, "mount") as HTMLElement).click();
  (headOf(root, "mount") as HTMLElement).click();
  point(headOf(root, "mount"), "pointerover");
  const afterUnselect = dimmedKeys(root);
  point(headOf(root, "mount"), "pointerout", { relatedTarget: document.body });
  point(headOf(root, "mount"), "pointerover");
  // 検証
  expect(afterUnselect).toEqual([]);
  expect(dimmedKeys(root)).toEqual(expected);
});

// タッチでは出さない（正常系）
test("test_attach_map_sequence_when_hovered_by_touch", async () => {
  // 準備
  const root = await setUp();
  // 実行
  point(lifelineHitOf(root, "mount"), "pointerover", { pointerType: "touch" });
  // 検証
  expect(dimmedKeys(root)).toEqual([]);
  expect(root.querySelector(".map-packets-hover")).toBeNull();
});

// 名前の文字の上も箱に含める（正常系）
test("test_attach_map_sequence_when_hovered_on_name", async () => {
  // 準備
  const root = await setUp();
  const expected = dimmedWhenSelected(root, "mount");
  const name = root.querySelector(
    '.map-participant[data-participant="mount"] .mdmark-diagram-node-name',
  ) as Element;
  const hit = root.querySelector(
    '.map-participant[data-participant="mount"] .mdmark-diagram-node-hit',
  ) as Element;
  // 実行
  point(name, "pointerover");
  const onName = dimmedKeys(root);
  point(hit, "pointerover");
  point(hit, "pointerout", { relatedTarget: name });
  // 検証
  expect(onName).toEqual(expected);
  expect(dimmedKeys(root)).toEqual(expected);
});

// Esc で解いた直後は出さない（正常系）
test("test_attach_map_sequence_when_hovered_after_escape", async () => {
  // 準備
  const root = await setUp();
  (headOf(root, "mount") as HTMLElement).click();
  // 実行
  point(headOf(root, "mount"), "pointerover");
  root
    .querySelector(".mdmark-map figure")
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  point(headOf(root, "mount"), "pointerover");
  // 検証
  expect(dimmedKeys(root)).toEqual([]);
  expect(root.querySelector(".map-packets-hover")).toBeNull();
});

// シーケンス図の一覧の表示（正常系）
test("test_attach_map_sequence_when_list", async () => {
  // 準備
  addStyles();
  const { attachMapSequence } = await loadSequenceView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const mermaid =
    "sequenceDiagram\n  participant user as 利用側のページ\n  participant mount as mount\n  participant parse as 記法の読み取り\n  user->>mount: 設定と Markdown\n  mount->>parse: map の範囲\n  parse-->>mount: 読み取った図\n  mount-->>user: 描いた文書\n";
  const root = createRootFromHtml(renderDoc(mapRange({ mermaid })).html);
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapSequence(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs("").args,
    }),
  );
  // 実行
  root.querySelector<HTMLButtonElement>('[data-tool="list"]')?.click();
  // 検証
  const items = [
    ...root.querySelectorAll<HTMLElement>('[role="tree"] [role="treeitem"]'),
  ];
  expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
    "利用側のページ → mount: 設定と Markdown",
    "mount → 記法の読み取り: map の範囲",
    "記法の読み取り → mount: 読み取った図",
    "mount → 利用側のページ: 描いた文書",
  ]);
  expect(items.some((item) => item.hasAttribute("aria-expanded"))).toBe(false);
});

// 設定の塗り方と色合いを参加者のホバーの印にも当てる（正常系）
test("test_attach_map_sequence_when_packet_style", async () => {
  // 準備: map.packets を指定して描く
  const { attachMapSequence } = await loadSequenceView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: SEQUENCE })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapSequence(
      range,
      resolveConfig({
        config: {
          map: { ...CONFIG, packets: { fill: "glow", palette: "vivid" } },
        },
      }),
      { args: parseMapArgs("").args },
    ),
  );
  // 実行: mount の参加者の箱にポインターを乗せる
  point(lifelineHitOf(root, "mount"), "pointerover");
  // 検証
  const packets = root.querySelectorAll(".map-packets-hover .map-packet");
  expect(packets.length).toBeGreaterThan(0);
  for (const packet of packets) {
    expect(packet.getAttribute("data-fill")).toBe("glow");
  }
  expect(root.querySelector('[data-packet-palette="vivid"]')).not.toBeNull();
});

/** 要素の中央を押し、動かさずに離す（イベントは要素から window まで伝わる） */
function pressStill(element: Element): void {
  const box = element.getBoundingClientRect();
  const point = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  };
  element.dispatchEvent(new PointerEvent("pointerdown", point));
  element.dispatchEvent(new PointerEvent("pointerup", point));
}

/** 開いている移動のメニューの、文言が `label` のボタンを返却する（無ければ例外） */
function moveItem(label: string): HTMLButtonElement {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>(".mdmark-step-menu button"),
  ].find((item) => item.textContent?.trim() === label);
  if (!found) {
    throw new Error(`メニューの項目が無い: ${label}`);
  }
  return found;
}

/** 参加者 `id` の箱 */
const participantBox = (root: HTMLElement, id: string) =>
  root.querySelector(`.map-participant[data-participant="${id}"]`) as Element;

/** 図の移動のボタン（出るまで待つ） */
async function shownMoveButton(root: HTMLElement): Promise<HTMLButtonElement> {
  return vi.waitFor(() => {
    const found = root.querySelector<HTMLButtonElement>("button.map-move");
    expect(found?.hidden).toBe(false);
    return found as HTMLButtonElement;
  });
}

// 移動のメニューで参加者を 1 列ずつ並べ替える（正常系）
test("test_attach_map_sequence_when_move_menu", async () => {
  // 準備: 先頭の参加者は左へ移せない
  const root = await setUp();
  pressStill(participantBox(root, "user"));
  (await shownMoveButton(root)).click();
  const firstDisabled = moveItem("左へ移す").disabled;
  // 実行: 2 人目の参加者を右へ移す
  pressStill(participantBox(root, "mount"));
  (await shownMoveButton(root)).click();
  moveItem("右へ移す").click();
  // 検証: Alt + → を 1 回押したときと同じ並びで、再描画した後もメニューが開いている
  expect(firstDisabled).toBe(true);
  expect(saved().order?.slice(0, 3)).toEqual(["user", "marker", "mount"]);
  expect(document.activeElement).toBe(moveItem("右へ移す"));
  // 実行: メッセージの線を押す
  const wire = root.querySelector(
    ".mdmark-diagram-wire[data-message]",
  ) as Element;
  pressStill(wire);
  // 検証
  await vi.waitFor(() => {
    expect(
      root.querySelector<HTMLButtonElement>("button.map-move")?.hidden ?? true,
    ).toBe(true);
  });
});
