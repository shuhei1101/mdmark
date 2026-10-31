import { type CodeCopyState, renderCodeCopy } from "../parts/code-block.ts";
import { COPIED_NOTICE_MS, copyText } from "./clipboard.ts";

/** コードブロックのコピーのボタンを返す。ボタンの外のクリックは `undefined` */
function findCopyButton(target: EventTarget | null): HTMLElement | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  return target.closest<HTMLElement>(".mdmark-code-copy") ?? undefined;
}

/** コピーする文字: 行の印を持つブロックは `data-kind="del"` の行を除いた各行の文字を改行でつなぎ、それ以外は `code` の文字から末尾の改行を 1 つ除く */
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

/** ボタンの状態・文言・アイコンと、読み上げの要素の文字を当てる */
function setState(meta: Element, state: CodeCopyState): void {
  const template = document.createElement("template");
  template.innerHTML = renderCodeCopy({ state });
  const button = meta.querySelector<HTMLElement>(".mdmark-code-copy");
  const status = meta.querySelector(".mdmark-code-status");
  const next = template.content;
  if (button) {
    button.dataset.state = state;
    button.innerHTML = next.querySelector(".mdmark-code-copy")?.innerHTML ?? "";
  }
  if (status) {
    status.textContent =
      next.querySelector(".mdmark-code-status")?.textContent ?? "";
  }
}

/** 各 `mdmark-code-bar` の右端にコピーのボタンを置き、押すとコードをクリップボードへ書く。ボタンとタイマーを取り除く関数を返す */
export function attachCodeCopy(root: HTMLElement): () => void {
  const added: HTMLElement[] = [];
  for (const bar of root.querySelectorAll<HTMLElement>(".mdmark-code-bar")) {
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
