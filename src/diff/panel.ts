import { renderDiffLines } from "../parts/diff-lines.ts";
import { renderDiffMessage } from "../parts/diff-message.ts";
import { renderDiffToggle } from "../parts/diff-toggle.ts";
import { renderNotice } from "../parts/notice.ts";
import {
  describeRevision,
  renderRevisionPicker,
} from "../parts/revision-picker.ts";
import { computeDiff, type DiffBlock } from "./compute.ts";
import { attachMinimap } from "./minimap.ts";
import {
  checkRevisions,
  type DiffRevision,
  type DiffSource,
} from "./source.ts";

/** 差分のプレビューの前と後の HTML を文書と同じ描き方で描き、置いた要素に文書と同じ操作を付ける関数を返す関数 */
export type DiffHtmlRenderer = (html: string) => {
  /** 描いた範囲の中身 */
  html: string;
  /** 置いた要素に図の拡大・ツールチップ・操作できる部品などの操作を付け、外す関数を返す */
  attach: (root: HTMLElement) => () => void;
};

/** プレビューの前と後の、描いた中身に操作を付ける関数 */
type RangeAttaches = {
  before: ReturnType<DiffHtmlRenderer>["attach"] | null;
  after: ReturnType<DiffHtmlRenderer>["attach"] | null;
};

/** `id` を指す、空白で区切った `id` を持つ属性 */
const ID_LIST_ATTRIBUTES = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "for",
];

/** `url(#id)` の参照 */
const URL_REFERENCE = /url\(#([^)\s]+)\)/g;

/** 取り出し元の待ちがこれを過ぎたら読み込み中の文を出す（ミリ秒） */
const LOADING_DELAY_MS = 1000;

/** 取り出し元の待ちがこれを過ぎたら回る表示を足す（ミリ秒） */
const SPINNER_DELAY_MS = 2000;

/** 差分の場所の `id` と選ぶ欄の `id` の頭。ページの中で一意にする通し番号を続ける */
const ID_PREFIX = "mdmark-diff-panel-";

/** 差分の場所の `id` に使う通し番号 */
let serial = 0;

/** 差分を開いている間に隠す本文の要素と右側の目次に付ける属性。`index.css` が `display: none !important` で隠す */
export const DIFF_HIDDEN_ATTRIBUTE = "data-mdmark-diff-hidden";

/** HTML 文字列から要素を作る */
function parseElement(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 語の区切り。`Intl.Segmenter` を持たないブラウザでは `undefined` */
function createSegmenter(): Intl.Segmenter | undefined {
  if (typeof Intl.Segmenter !== "undefined") {
    return new Intl.Segmenter("ja", { granularity: "word" });
  }
  return undefined;
}

/** 要素の中の `id` に頭を付け、その `id` を指す属性も書き換えて、前と後のプレビューと本文の間で `id` を重ならせない。表に無い `id`（範囲の外を指すもの）は変えない */
export function scopeIds(options: {
  /** プレビューの側の中身 */
  root: HTMLElement;
  /** 付ける頭 */
  prefix: string;
}): void {
  const { root, prefix } = options;
  const scoped = new Map<string, string>();
  for (const element of root.querySelectorAll("[id]")) {
    scoped.set(element.id, `${prefix}${element.id}`);
    element.id = `${prefix}${element.id}`;
  }
  if (scoped.size === 0) {
    return;
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const { name, value } = attribute;
      if (ID_LIST_ATTRIBUTES.includes(name)) {
        element.setAttribute(
          name,
          value
            .split(/\s+/)
            .map((id) => scoped.get(id) ?? id)
            .join(" "),
        );
      } else if (
        (name === "href" || name === "xlink:href") &&
        value[0] === "#"
      ) {
        element.setAttribute(
          name,
          `#${scoped.get(value.slice(1)) ?? value.slice(1)}`,
        );
      } else if (value.includes("url(#")) {
        element.setAttribute(
          name,
          value.replace(URL_REFERENCE, (match, id: string) =>
            scoped.has(id) ? `url(#${scoped.get(id)})` : match,
          ),
        );
      }
    }
  }
}

/** 埋め込んだ HTML の範囲の塊の前と後を、今の描画で描く。描いた中身に置き換えたブロックと、範囲ごとの操作を付ける関数を返す */
function renderBlocks(
  blocks: DiffBlock[],
  renderHtml: DiffHtmlRenderer,
): { blocks: DiffBlock[]; ranges: RangeAttaches[] } {
  const ranges: RangeAttaches[] = [];
  const rendered = blocks.map((block) => {
    if (block.type !== "html") {
      return block;
    }
    const before = block.before === null ? null : renderHtml(block.before);
    const after = block.after === null ? null : renderHtml(block.after);
    ranges.push({
      before: before?.attach ?? null,
      after: after?.attach ?? null,
    });
    return {
      ...block,
      before: before?.html ?? null,
      after: after?.html ?? null,
    };
  });
  return { blocks: rendered, ranges };
}

/** 描いた文書に「変更を見る」と差分の場所を置き、開く・選び直す・閉じるを受け取って取り出し元を呼び、差分を描く。差分を閉じ、待ちと受け取りとミニマップを片付け、置いた要素を取り除く関数を返す */
export function attachDiff(options: {
  /** 描いた本文（右側の目次を置いたときは本文の列） */
  root: HTMLElement;
  /** 使う側の取り出し元 */
  source: DiffSource;
  /** 取り出し元に渡す文書の `id` */
  docId: string;
  /** 埋め込んだ HTML を文書と同じ描き方で描き、操作を付ける関数を返す関数 */
  renderHtml: DiffHtmlRenderer;
  /** 差分を開いている間、`root` の外で一緒に隠す要素（右側の目次） */
  hideWith?: HTMLElement[];
}): () => void {
  const { root, source, docId, renderHtml, hideWith = [] } = options;
  serial += 1;
  const panelId = `${ID_PREFIX}${serial}`;
  const bar = parseElement(renderDiffToggle({ controls: panelId }));
  const toggle = bar.querySelector<HTMLButtonElement>(".mdmark-diff-toggle");
  const panel = document.createElement("div");
  panel.className = "mdmark-diff";
  panel.id = panelId;
  panel.hidden = true;
  if (toggle === null) {
    throw new Error("差分を開くボタンが無い");
  }
  const title = [...root.children].find((child) => child.tagName === "H1");
  if (title === undefined) {
    root.prepend(bar, panel);
  } else {
    title.after(bar, panel);
  }

  // 開いている間に隠した本文の要素
  let hidden: HTMLElement[] = [];

  /** 開いている間に隠した要素と `hideWith` の要素の属性を外す */
  const showHidden = (): void => {
    for (const element of [...hidden, ...hideWith]) {
      element.removeAttribute(DIFF_HIDDEN_ATTRIBUTE);
    }
    hidden = [];
  };
  // 開いた世代と選び直しの世代: 進めるたびに、前の待ちの結果を捨てる
  let openGeneration = 0;
  let selectGeneration = 0;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let spinnerTimer: ReturnType<typeof setTimeout> | undefined;
  let detachMinimap: (() => void) | undefined;
  // プレビューの前と後に付けた操作を外す関数
  let detachPreviews: (() => void)[] = [];

  /** 読み込み中の文を出す待ちのタイマーを止める */
  const clearTimers = (): void => {
    clearTimeout(loadingTimer);
    clearTimeout(spinnerTimer);
  };

  /** 差分の行のミニマップと、プレビューに付けた操作を外す */
  const clearMinimap = (): void => {
    detachMinimap?.();
    detachMinimap = undefined;
    for (const detach of detachPreviews) {
      detach();
    }
    detachPreviews = [];
  };

  /** 置いた前と後のプレビューの中身ごとに、`id` に側ごとの頭を付けてから操作を付ける */
  const attachPreviews = (
    result: HTMLElement,
    ranges: RangeAttaches[],
  ): void => {
    result
      .querySelectorAll<HTMLElement>(".mdmark-diff-html")
      .forEach((range, position) => {
        const attaches = ranges[position];
        const sides = range.querySelectorAll<HTMLElement>(".mdmark-diff-side");
        (["before", "after"] as const).forEach((name, side) => {
          const attach = attaches?.[name];
          const root = sides[side]?.querySelector<HTMLElement>(".mdmark-html");
          if (!attach || !root) {
            return;
          }
          scopeIds({ root, prefix: `${panelId}-${position}-${name}-` });
          detachPreviews.push(attach(root));
        });
      });
  };

  /** 選んだ 2 つのリビジョンの本文を取り出して差分を描く */
  const refresh = async (view: {
    revisions: DiffRevision[];
    before: HTMLSelectElement;
    after: HTMLSelectElement;
    summary: HTMLElement;
    result: HTMLElement;
  }): Promise<void> => {
    const { revisions, before, after, summary, result } = view;
    selectGeneration += 1;
    const mine = selectGeneration;
    const current = openGeneration;
    const pair = [before.value, after.value].map((id) =>
      revisions.find((revision) => revision.id === id),
    ) as [DiffRevision, DiffRevision];
    // 本文の待ちが長いときは、前の差分に替えて読み込み中を出す
    clearTimers();
    loadingTimer = setTimeout(() => {
      clearMinimap();
      summary.textContent = "";
      result.innerHTML = renderDiffMessage({ kind: "loading" });
    }, LOADING_DELAY_MS);
    spinnerTimer = setTimeout(() => {
      result.innerHTML = renderDiffMessage({ kind: "loading", spinner: true });
    }, SPINNER_DELAY_MS);
    const settled = await Promise.allSettled(
      pair.map(async (revision) =>
        source.content({ docId, revisionId: revision.id }),
      ),
    );
    if (openGeneration !== current || selectGeneration !== mine) {
      return;
    }
    clearTimers();
    clearMinimap();
    const failed: DiffRevision[] = [];
    const texts: string[] = [];
    settled.forEach((item, position) => {
      const revision = pair[position] as DiffRevision;
      if (item.status === "rejected" || typeof item.value !== "string") {
        failed.push(revision);
        console.error(
          "[mdmark] 差分の本文を取り出せません: content",
          docId,
          revision.id,
          item.status === "rejected" ? item.reason : item.value,
        );
      } else {
        texts.push(item.value);
      }
    });
    summary.textContent = "";
    if (failed.length > 0) {
      result.innerHTML = renderNotice({
        name: failed.map(describeRevision).join("」と「"),
        source: "diff-content",
      });
      return;
    }
    const diff = computeDiff({
      before: texts[0] as string,
      after: texts[1] as string,
      segmenter: createSegmenter(),
    });
    if (diff.counts.del === 0 && diff.counts.add === 0) {
      result.innerHTML = renderDiffMessage({ kind: "same" });
      return;
    }
    const prepared = renderBlocks(diff.blocks, renderHtml);
    result.innerHTML = renderDiffLines({
      blocks: prepared.blocks,
      sides: "side",
      labels: {
        before: describeRevision(pair[0]),
        after: describeRevision(pair[1]),
      },
    });
    attachPreviews(result, prepared.ranges);
    summary.textContent = `削除した行 ${diff.counts.del}・追加した行 ${diff.counts.add}`;
    const lines = result.querySelector<HTMLElement>(".mdmark-diff-lines");
    if (lines !== null) {
      detachMinimap = attachMinimap(lines);
    }
  };

  /** 開く: 本文を隠し、取り出し元からリビジョンの一覧を受けて選ぶ欄と差分を出す */
  const open = async (): Promise<void> => {
    openGeneration += 1;
    selectGeneration += 1;
    const current = openGeneration;
    hidden = [...root.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child !== title &&
        child !== bar &&
        child !== panel,
    );
    for (const element of [...hidden, ...hideWith]) {
      element.setAttribute(DIFF_HIDDEN_ATTRIBUTE, "");
    }
    panel.hidden = false;
    panel.replaceChildren();
    toggle.setAttribute("aria-expanded", "true");
    loadingTimer = setTimeout(() => {
      panel.innerHTML = renderDiffMessage({ kind: "loading" });
    }, LOADING_DELAY_MS);
    spinnerTimer = setTimeout(() => {
      panel.innerHTML = renderDiffMessage({ kind: "loading", spinner: true });
    }, SPINNER_DELAY_MS);
    let revisions: DiffRevision[];
    try {
      revisions = checkRevisions(await source.revisions(docId));
    } catch (error) {
      if (openGeneration !== current) {
        return;
      }
      clearTimers();
      console.error(
        "[mdmark] 差分のリビジョンの一覧を取り出せません: revisions",
        docId,
        error,
      );
      panel.innerHTML = renderNotice({ name: docId, source: "diff-revisions" });
      return;
    }
    if (openGeneration !== current) {
      return;
    }
    clearTimers();
    if (revisions.length < 2) {
      panel.innerHTML = renderDiffMessage({ kind: "single" });
      return;
    }
    const [newest, previous] = revisions as [DiffRevision, DiffRevision];
    panel.innerHTML = `${renderRevisionPicker({
      revisions,
      before: previous.id,
      after: newest.id,
      idPrefix: `${panelId}-picker`,
    })}<div class="mdmark-diff-result"></div>`;
    const before = panel.querySelector<HTMLSelectElement>(
      `#${CSS.escape(`${panelId}-picker-before`)}`,
    );
    const after = panel.querySelector<HTMLSelectElement>(
      `#${CSS.escape(`${panelId}-picker-after`)}`,
    );
    const summary = panel.querySelector<HTMLElement>(".mdmark-diff-summary");
    const result = panel.querySelector<HTMLElement>(".mdmark-diff-result");
    if (!before || !after || !summary || !result) {
      throw new Error("リビジョンの選択が描かれていない");
    }
    const view = { revisions, before, after, summary, result };
    /** 前の欄の選択に合わせて、後の欄の選べない項目を直す。後が前以前になったら、前の 1 つ新しいリビジョンに移す */
    const constrain = (): void => {
      const limit = before.selectedIndex;
      for (const option of after.options) {
        option.disabled = option.index >= limit;
      }
      if (after.selectedIndex >= limit) {
        after.selectedIndex = limit - 1;
      }
    };
    before.addEventListener("change", () => {
      constrain();
      void refresh(view);
    });
    after.addEventListener("change", () => {
      void refresh(view);
    });
    await refresh(view);
  };

  /** 閉じる: 世代を進めて待ちを捨て、ミニマップを外し、場所を空にして隠し、隠した本文を戻す */
  const close = (): void => {
    openGeneration += 1;
    selectGeneration += 1;
    clearTimers();
    clearMinimap();
    panel.replaceChildren();
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    showHidden();
  };

  /** 埋め込んだ HTML の「ソース」「プレビュー」のボタンを押したとき、押した見方の中身だけを出す */
  const switchView = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-view]")
        : null;
    const range = button?.closest<HTMLElement>(".mdmark-diff-html");
    if (!button || !range) {
      return;
    }
    for (const other of range.querySelectorAll<HTMLElement>("[data-view]")) {
      other.setAttribute("aria-pressed", String(other === button));
    }
    for (const pane of range.querySelectorAll<HTMLElement>("[data-pane]")) {
      pane.hidden = pane.dataset.pane !== button.dataset.view;
    }
  };

  toggle.addEventListener("click", () => {
    if (panel.hidden) {
      void open();
    } else {
      close();
    }
  });
  panel.addEventListener("click", switchView);

  return () => {
    if (!panel.hidden) {
      close();
    }
    openGeneration += 1;
    selectGeneration += 1;
    bar.remove();
    panel.remove();
  };
}
