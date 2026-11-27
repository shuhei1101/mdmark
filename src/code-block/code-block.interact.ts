import { COPIED_NOTICE_MS, copyText } from "../shared/clipboard.interact.ts";
import {
  type PartStates,
  partKey,
  startOpen,
} from "../shared/part-states.interact.ts";
import { alignFileTreeNotes } from "../tree/tree.interact.ts";
import {
  type CodeCopyState,
  renderCodeCopy,
  renderCodeWrapToggle,
} from "./code-block.part.ts";

/** コードブロックのコピーのボタンを返却する。ボタンの外のクリックは `undefined` */
function findCopyButton(target: EventTarget | null): HTMLElement | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  return target.closest<HTMLElement>(".mdmark-code-copy") ?? undefined;
}

/** コピーする文字: 行のマーカーを持つブロックは `data-kind="del"` の行を除いた各行の文字を改行でつなぎ、それ以外は `code` の文字から末尾の改行を 1 つ除く */
function codeToCopy(block: Element): string {
  const code = block.querySelector("pre > code");
  if (!code) {
    return "";
  }
  const lines = [...code.querySelectorAll<HTMLElement>(".mdmark-code-line")];
  if (lines.length > 0) {
    return lines
      .filter((line) => line.dataset.kind !== "del")
      .map((line) => line.querySelector(".mdmark-code-text")?.textContent ?? "")
      .join("\n");
  }
  return (code.textContent ?? "").replace(/\n$/, "");
}

/** ボタンの状態・アイコン・名前とツールチップの文言と、スクリーンリーダー向けの要素の文字を適用する */
function setState(meta: Element, state: CodeCopyState): void {
  const template = document.createElement("template");
  template.innerHTML = renderCodeCopy({ state });
  const button = meta.querySelector<HTMLElement>(".mdmark-code-copy");
  const status = meta.querySelector(".mdmark-code-status");
  const next = template.content;
  const templateButton = next.querySelector(".mdmark-code-copy");
  if (button && templateButton) {
    button.dataset.state = state;
    button.innerHTML = templateButton.innerHTML;
    for (const name of ["aria-label", "title"]) {
      button.setAttribute(name, templateButton.getAttribute(name) ?? "");
    }
  }
  if (status) {
    status.textContent =
      next.querySelector(".mdmark-code-status")?.textContent ?? "";
  }
}

/** 各 `mdmark-code-bar` の右端にコピーのボタンを配置し、押すとコードをクリップボードへ書き込む。ボタンとタイマーを取り除く関数を返却する */
export function attachCodeCopy(root: HTMLElement): () => void {
  const added: HTMLElement[] = [];
  for (const bar of root.querySelectorAll<HTMLElement>(
    ".mdmark-code > .mdmark-code-bar",
  )) {
    if (bar.querySelector(".mdmark-code-meta")) {
      continue;
    }
    bar.insertAdjacentHTML("beforeend", renderCodeCopy({ state: "idle" }));
    const meta = bar.lastElementChild;
    if (meta instanceof HTMLElement) {
      added.push(meta);
    }
  }
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const onClick = async (event: Event): Promise<void> => {
    const button = findCopyButton(event.target);
    const meta = button?.closest(".mdmark-code-meta");
    const block = button?.closest(".mdmark-code");
    if (!button || !meta || !block) {
      return;
    }
    clearTimeout(timers.get(meta));
    if (await copyText(codeToCopy(block))) {
      setState(meta, "copied");
      timers.set(
        meta,
        setTimeout(() => setState(meta, "idle"), COPIED_NOTICE_MS),
      );
    } else {
      setState(meta, "failed");
    }
  };
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    for (const meta of added) {
      meta.remove();
    }
  };
}

/** 折り返しを切り替えるブロック（コードブロックの pre かファイルツリー）と、折り返したときの class・記録の鍵 */
type WrapTarget = {
  /** class を付け外しする要素 */
  element: HTMLElement;
  /** 折り返したときの class */
  className: string;
  /** 帯 */
  bar: HTMLElement;
  /** 部品の開閉の記録の鍵 */
  key: string;
  /** ファイルツリーか */
  tree: boolean;
};

/** 帯を持つコードブロックとファイルツリーのうち `blocks` がオンの種類を、文書の順に返却する */
function wrapTargets(
  root: HTMLElement,
  blocks: { code: boolean; tree: boolean },
): WrapTarget[] {
  const targets: WrapTarget[] = [];
  const selector = [
    ...(blocks.code ? [".mdmark-code"] : []),
    ...(blocks.tree ? ["div.mdmark-tree"] : []),
  ].join(", ");
  if (selector === "") {
    return targets;
  }
  for (const block of root.querySelectorAll<HTMLElement>(selector)) {
    const bar = block.querySelector<HTMLElement>(":scope > .mdmark-code-bar");
    if (!bar) {
      continue;
    }
    if (block.matches("div.mdmark-tree")) {
      targets.push({
        element: block,
        className: "mdmark-tree-wrap",
        bar,
        key: partKey({ root, part: block, kind: "tree", inner: "wrap" }),
        tree: true,
      });
      continue;
    }
    const pre = block.querySelector<HTMLElement>(":scope pre");
    if (pre) {
      targets.push({
        element: pre,
        className: "mdmark-code-wrap",
        bar,
        key: partKey({ root, part: block, kind: "code-wrap" }),
        tree: false,
      });
    }
  }
  return targets;
}

/** 帯のコピーのボタンの前に折り返しのボタンを配置し、押すたびにそのブロックだけの折り返しを切り替える。ボタンと受け取りを取り除く関数を返却する */
export function attachCodeWraps(
  root: HTMLElement,
  options: {
    /** 設定の `code.wrap` */
    defaultWrap: boolean;
    /** 再描画で保つ部品の状態 */
    partStates?: PartStates | undefined;
    /** ボタンを付ける種類（機能 `code`・`tree` のオン・オフ。既定は両方） */
    blocks?: { code: boolean; tree: boolean };
  },
): () => void {
  const { defaultWrap, partStates, blocks = { code: true, tree: true } } =
    options;
  const added: Array<{ button: HTMLButtonElement; onClick: () => void }> = [];
  for (const target of wrapTargets(root, blocks)) {
    // マーカーの wrap を持つか既定が折り返すなら、描いた直後に折り返す
    const marked = target.element.classList.contains(target.className);
    const markerOpen = marked || defaultWrap;
    const wrapped = startOpen({
      states: partStates,
      key: target.key,
      marker: String(markerOpen),
      markerOpen,
    });
    const template = document.createElement("template");
    template.innerHTML = renderCodeWrapToggle({ pressed: wrapped });
    const button = template.content.firstElementChild as HTMLButtonElement;
    const meta = target.bar.querySelector(":scope > .mdmark-code-meta");
    if (meta) {
      meta.prepend(button);
    } else {
      target.bar.append(button);
    }
    const apply = (next: boolean): void => {
      target.element.classList.toggle(target.className, next);
      button.setAttribute("aria-pressed", String(next));
      if (target.tree) {
        alignFileTreeNotes(target.element);
      }
    };
    apply(wrapped);
    const onClick = (): void => {
      const next = button.getAttribute("aria-pressed") !== "true";
      apply(next);
      partStates?.set(target.key, { open: next, marker: String(markerOpen) });
    };
    button.addEventListener("click", onClick);
    added.push({ button, onClick });
  }
  return () => {
    for (const { button, onClick } of added.splice(0)) {
      button.removeEventListener("click", onClick);
      button.remove();
    }
  };
}
