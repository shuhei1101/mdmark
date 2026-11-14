import { afterEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 列の幅のつまみの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadResize = () => import("../../../../src/interact/table-resize.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 描いたときの見出しのセルの `--mdmark-column-min-width`（描く処理が入れる値の代わり） */
const INITIAL_MIN_WIDTH = "90px";

/** 名前・説明・更新日の 3 列で、各列の見出しの右端につまみを持つ表を配置し、表と見出しのセルとつまみを返却する */
function resizableTable(): {
  table: HTMLTableElement;
  headCells: HTMLTableCellElement[];
  handles: HTMLElement[];
} {
  const names = ["名前", "説明", "更新日"];
  const head = names
    .map(
      (name, column) =>
        `<th scope="col" data-col="${column}" style="--mdmark-column-min-width: ${INITIAL_MIN_WIDTH}"><span class="mdmark-th"><span class="mdmark-th-label">${name}</span></span><span class="mdmark-col-resize" role="separator" aria-orientation="vertical" tabindex="0" aria-label="「${name}」の列の幅" data-col="${column}"></span></th>`,
    )
    .join("");
  const body = ["りんご", "描画を速くする", "2026-10-01"]
    .map((value, column) => `<td data-col="${column}">${value}</td>`)
    .join("");
  const root = createRootFromHtml(
    `<div class="mdmark-table" data-kind="data" data-features="sort pin filter resize"><div class="mdmark-table-scroll"><table><thead><tr>${head}</tr></thead><tbody><tr>${body}</tr></tbody></table></div></div>`,
  );
  const table = root.querySelector("table");
  if (!table) {
    throw new Error("表が無い");
  }
  const headCells = [...table.querySelectorAll<HTMLTableCellElement>("th")];
  const handles = [
    ...table.querySelectorAll<HTMLElement>(".mdmark-col-resize"),
  ];
  return { table, headCells, handles };
}

/** つまみに `pointerdown` から `pointerup` までを送信する（`dx` は横の移動量の px） */
function drag(
  handle: HTMLElement,
  dx: number,
  pointerType: "mouse" | "touch" = "mouse",
): void {
  const rect = handle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType };
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...init, clientX: x + dx, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...init, clientX: x + dx, clientY: y }),
  );
}

/** つまみにキーを送信する */
function press(handle: HTMLElement, key: string): void {
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

/** 合成したポインターは捕まえられないので、捕まえる処理だけを止める */
function stubPointerCapture(): void {
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
    () => undefined,
  );
}

// ドラッグで列の幅だけを変え、ダブルクリックで戻す（正常系）
test("test_attach_column_resize_when_dragged", async () => {
  // 準備
  addStyles();
  stubPointerCapture();
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  const onResize = vi.fn();
  detachers.push(
    attachColumnResize(table, {
      headCells,
      maxWidth: () => 2000,
      onResize,
    }),
  );
  const before = headCells.map((cell) => cell.offsetWidth);
  // 実行: 1 列目のつまみを右へ 80px 動かす
  drag(handles[0], 80);
  // 検証
  expect(headCells[0].offsetWidth).toBe(before[0] + 80);
  expect(headCells[1].offsetWidth).toBe(before[1]);
  expect(headCells[2].offsetWidth).toBe(before[2]);
  expect(onResize).toHaveBeenCalledWith(0);
  // 実行・検証: ダブルクリックで付けた直後の幅に戻る
  handles[0].dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
  );
  expect(headCells[0].offsetWidth).toBe(before[0]);
  expect(headCells[0].style.getPropertyValue("--mdmark-column-min-width")).toBe(
    INITIAL_MIN_WIDTH,
  );
});

// 自動で列の幅を決めた表では、ほかの列の幅を止めず、幅を入れた後・測る前に onWidthWritten を呼ぶ（正常系）
test("test_attach_column_resize_when_auto_width", async () => {
  // 準備
  addStyles();
  stubPointerCapture();
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  table.setAttribute("data-auto-width", "");
  const calls: string[] = [];
  detachers.push(
    attachColumnResize(table, {
      headCells,
      maxWidth: () => 2000,
      onResize: () => calls.push("resize"),
      onWidthWritten: () => calls.push("written"),
    }),
  );
  // 実行: 1 列目のつまみを右へ 80px 動かす
  drag(handles[0], 80);
  // 検証: ほかの列にインラインの幅が入らず、幅を入れるたびに onResize の前に onWidthWritten が呼ばれる
  expect(headCells[1].style.width).toBe("");
  expect(headCells[2].style.width).toBe("");
  expect(calls[0]).toBe("written");
  expect(calls.at(-1)).toBe("resize");
  expect(calls.indexOf("written")).toBeLessThan(calls.indexOf("resize"));
});

// ←→ キーで 16px ずつ変え、Enter で戻し、つまみの値を書き換える（正常系）
test("test_attach_column_resize_when_key", async () => {
  // 準備
  addStyles();
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  detachers.push(
    attachColumnResize(table, {
      headCells,
      maxWidth: () => 2000,
      onResize: () => undefined,
    }),
  );
  const before = headCells[0].offsetWidth;
  // 実行: → を 2 回
  press(handles[0], "ArrowRight");
  press(handles[0], "ArrowRight");
  // 検証
  const widened = headCells[0].offsetWidth;
  expect(widened).toBe(before + 32);
  expect(handles[0].getAttribute("aria-valuenow")).toBe(String(widened));
  expect(handles[0].getAttribute("aria-valuetext")).toBe(`${widened}px`);
  // 実行・検証: ← を 1 回
  press(handles[0], "ArrowLeft");
  expect(headCells[0].offsetWidth).toBe(before + 16);
  // 実行・検証: Enter で付けた直後の幅に戻る
  press(handles[0], "Enter");
  expect(headCells[0].offsetWidth).toBe(before);
});

// 列の最小幅と上限で止める（正常系）
test("test_attach_column_resize_when_clamped", async () => {
  // 準備
  addStyles();
  stubPointerCapture();
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  detachers.push(
    attachColumnResize(table, {
      headCells,
      maxWidth: () => 200,
      onResize: () => undefined,
    }),
  );
  // 実行: 右へ 2000px
  drag(handles[0], 2000);
  // 検証
  expect(headCells[0].offsetWidth).toBe(200);
  expect(handles[0].getAttribute("aria-valuemax")).toBe("200");
  // 実行: 左へ 2000px
  drag(handles[0], -2000);
  // 検証
  expect(String(headCells[0].offsetWidth)).toBe(
    handles[0].getAttribute("aria-valuemin"),
  );
});

// タッチの 2 回のタップの間隔でダブルタップを見分け、ドラッグの終わりはタップに数えない（正常系）
test("test_attach_column_resize_when_double_tap", async () => {
  // 準備: タップの時刻は performance.now() で測る
  addStyles();
  stubPointerCapture();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  detachers.push(
    attachColumnResize(table, {
      headCells,
      maxWidth: () => 2000,
      onResize: () => undefined,
    }),
  );
  const before = headCells[0].offsetWidth;
  // 実行・検証: 100ms の間隔の 2 回のタップで戻る
  drag(handles[0], 60, "touch");
  now += 1000;
  drag(handles[0], 0, "touch");
  now += 100;
  drag(handles[0], 0, "touch");
  expect(headCells[0].offsetWidth).toBe(before);
  // 実行・検証: 400ms の間隔の 2 回のタップでは戻らない
  now += 1000;
  drag(handles[0], 60, "touch");
  now += 1000;
  drag(handles[0], 0, "touch");
  now += 400;
  drag(handles[0], 0, "touch");
  expect(headCells[0].offsetWidth).toBe(before + 60);
  // 実行・検証: ドラッグの直後 100ms 以内の 1 回のタップでは戻らない
  now += 1000;
  drag(handles[0], 60, "touch");
  now += 100;
  drag(handles[0], 0, "touch");
  expect(headCells[0].offsetWidth).toBe(before + 120);
});

// 削除する関数で受け取りと幅の指定を解除する（正常系）
test("test_attach_column_resize_when_detached", async () => {
  // 準備
  addStyles();
  const { attachColumnResize } = await loadResize();
  const { table, headCells, handles } = resizableTable();
  const detach = attachColumnResize(table, {
    headCells,
    maxWidth: () => 2000,
    onResize: () => undefined,
  });
  const before = headCells[0].offsetWidth;
  press(handles[0], "ArrowRight");
  // 実行
  detach();
  press(handles[0], "ArrowRight");
  // 検証
  expect(headCells[0].style.width).toBe("");
  expect(headCells[0].style.minWidth).toBe("");
  expect(headCells[0].offsetWidth).toBe(before);
});
