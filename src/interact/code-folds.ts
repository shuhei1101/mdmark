import { guideRangeOf, hiddenLinesOf } from "../code-fold-logic.ts";
import {
  codeLineId,
  renderCodeFoldMore,
  renderCodeFoldToggle,
} from "../parts/code-block.ts";
import {
  type PartStates,
  partKey,
  recordOpen,
  startOpen,
} from "./part-states.ts";

/** `attachCodeFolds` が開閉のボタンごとに登録する、行を開くか畳む関数 */
export const codeFoldSetters = new WeakMap<Element, (open: boolean) => void>();

/** 開閉のボタンから `codeFoldSetters` の関数を参照して、その行を開くか畳む。登録の無いボタンは何もしない */
export function setCodeFoldOpen(toggle: Element, open: boolean): void {
  codeFoldSetters.get(toggle)?.(open);
}

// コードブロックの id を文書の中で重ならせないための通し番号
let codeCounter = 0;

/** HTML の文字列から最初の要素を作る */
function elementOf(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** コードブロック 1 つの行に開閉を付け、削除する関数を返却する */
function attachCodeBlock(
  code: HTMLElement,
  root: HTMLElement,
  states: PartStates | undefined,
): () => void {
  codeCounter += 1;
  const base = `mdmark-code-${codeCounter}`;
  const lines = [
    ...code.querySelectorAll<HTMLElement>(":scope > .mdmark-code-line"),
  ];
  const foldLines = lines.map((line) =>
    line.dataset.foldLines === undefined
      ? undefined
      : Number(line.dataset.foldLines),
  );
  const indents = lines.map((line) =>
    line.dataset.indent === undefined ? 0 : Number(line.dataset.indent),
  );
  const folded = lines.map(
    (line, index) =>
      line.dataset.folded === "true" && foldLines[index] !== undefined,
  );
  const pre = code.parentElement;
  /** コードブロックの記録の鍵（`pre` が無いか記録しないときは無し） */
  const blockKey =
    pre === null || states === undefined
      ? undefined
      : partKey({ root, part: pre, kind: "code" });
  /** 行の記録の鍵 */
  const keyOf = (index: number): string | undefined =>
    blockKey === undefined ? undefined : `${blockKey}|${index + 1}`;
  /** 行のマーカーの値（`data-folded` の有無） */
  const markers = folded.map((value) => (value ? "folded" : ""));
  folded.forEach((value, index) => {
    const key = foldLines[index] === undefined ? undefined : keyOf(index);
    if (key !== undefined) {
      folded[index] = !startOpen({
        states,
        key,
        marker: markers[index] ?? "",
        markerOpen: !value,
      });
    }
  });
  /** 読者が変えた行の開閉を記録する（`nested` が真なら範囲の中の畳める行も） */
  const record = (index: number, nested: boolean): void => {
    const targets = [index];
    if (nested) {
      const { from, to } = rangeOf(index);
      for (let line = from - 1; line <= to - 1; line++) {
        if (foldLines[line] !== undefined) {
          targets.push(line);
        }
      }
    }
    for (const target of targets) {
      const key = keyOf(target);
      if (key !== undefined) {
        recordOpen({
          states,
          key,
          open: !folded[target],
          marker: markers[target] ?? "",
        });
      }
    }
  };
  const addedIds = lines.filter((line) => !line.id);
  lines.forEach((line, index) => {
    line.id ||= codeLineId(base, index);
  });
  // 行の間の改行を、行と一緒に隠せる要素にする
  const breaks = lines.map((line) => {
    const next = line.nextSibling;
    if (!(next instanceof Text) || next.data !== "\n") {
      return undefined;
    }
    const wrapper = document.createElement("span");
    wrapper.className = "mdmark-code-break";
    next.replaceWith(wrapper);
    wrapper.append(next);
    return wrapper;
  });
  // 開閉のボタンの列の幅を取る class
  pre?.classList.add("mdmark-code-foldable");
  const toggles = new Map<number, HTMLButtonElement>();
  /** 畳む範囲の最初と最後の行番号（1 から） */
  const rangeOf = (index: number) => ({
    from: index + 2,
    to: index + 1 + (foldLines[index] ?? 0),
  });
  /** 行の畳んだ状態を、ボタン・`⋯`・行の `hidden` に適用する */
  const apply = (): void => {
    const hidden = hiddenLinesOf({ foldLines, folded });
    lines.forEach((line, index) => {
      line.hidden = hidden.has(index);
      const lineBreak = breaks[index];
      if (lineBreak) {
        lineBreak.hidden = hidden.has(index);
      }
    });
    for (const [index, toggle] of toggles) {
      const range = rangeOf(index);
      const fresh = elementOf(
        renderCodeFoldToggle({
          expanded: !folded[index],
          ...range,
          controls: toggle.getAttribute("aria-controls") ?? "",
        }),
      );
      toggle.setAttribute("aria-expanded", String(!folded[index]));
      toggle.innerHTML = fresh.innerHTML;
      const line = lines[index];
      const more = line?.querySelector(":scope > .mdmark-code-fold-more");
      if (folded[index] && !more) {
        line?.append(elementOf(renderCodeFoldMore(range)));
      } else if (!folded[index]) {
        more?.remove();
      }
    }
  };
  /** 行を開くか畳む。`nested` が真なら範囲の中の畳める行も同じ状態にする */
  const setFolded = (index: number, value: boolean, nested: boolean): void => {
    folded[index] = value;
    if (nested) {
      const { from, to } = rangeOf(index);
      for (let line = from - 1; line <= to - 1; line++) {
        if (foldLines[line] !== undefined) {
          folded[line] = value;
        }
      }
    }
    apply();
  };
  lines.forEach((line, index) => {
    const count = foldLines[index];
    if (count === undefined) {
      return;
    }
    const controls = Array.from(
      { length: count },
      (_, offset) => lines[index + 1 + offset]?.id ?? "",
    ).join(" ");
    const toggle = elementOf(
      renderCodeFoldToggle({
        expanded: !folded[index],
        ...rangeOf(index),
        controls,
      }),
    ) as HTMLButtonElement;
    line.prepend(toggle);
    toggles.set(index, toggle);
    codeFoldSetters.set(toggle, (open) => setFolded(index, !open, false));
  });
  apply();

  // Enter・Space の押下から来たクリックでも Shift を読み込めるよう、押している間を記録する
  let shiftKeyDown = false;
  const onKeyDown = (event: KeyboardEvent): void => {
    shiftKeyDown = event.shiftKey;
  };
  const onKeyUp = (): void => {
    shiftKeyDown = false;
  };
  const onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const toggle = target.closest<HTMLButtonElement>(".mdmark-code-fold");
    const more = target.closest<HTMLButtonElement>(".mdmark-code-fold-more");
    const line = (toggle ?? more)?.closest<HTMLElement>(".mdmark-code-line");
    const index = line ? lines.indexOf(line) : -1;
    if (index < 0) {
      return;
    }
    if (more) {
      setFolded(index, false, false);
      record(index, false);
      toggles.get(index)?.focus();
      return;
    }
    const nested = event.shiftKey || shiftKeyDown;
    setFolded(index, !folded[index], nested);
    record(index, nested);
  };
  /** 乗せた行を含む最も内側の範囲の行に `data-guide-active` を付ける */
  const markGuide = (index: number | undefined): void => {
    const range =
      index === undefined
        ? undefined
        : guideRangeOf({ indents, foldLines, index });
    lines.forEach((line, position) => {
      const active =
        range !== undefined && range.from <= position && position <= range.to;
      line.toggleAttribute("data-guide-active", active);
      if (active) {
        line.style.setProperty(
          "--mdmark-code-guide-depth",
          String(range.depth - 1),
        );
      } else {
        line.style.removeProperty("--mdmark-code-guide-depth");
      }
    });
  };
  const onPointerOver = (event: PointerEvent): void => {
    const line = (event.target as HTMLElement).closest<HTMLElement>(
      ".mdmark-code-line",
    );
    const index = line ? lines.indexOf(line) : -1;
    markGuide(index < 0 ? undefined : index);
  };
  const onPointerOut = (): void => {
    markGuide(undefined);
  };
  /** ポインターの横の位置が開閉のボタンの列（最初の開閉のボタンの左端から右端まで）にあれば `pre` に `data-fold-hover` を付ける */
  const onPointerMove = (event: PointerEvent): void => {
    const first = toggles.values().next().value;
    if (!pre || !first) {
      return;
    }
    const box = first.getBoundingClientRect();
    pre.toggleAttribute(
      "data-fold-hover",
      box.left <= event.clientX && event.clientX <= box.right,
    );
  };
  const onPointerLeave = (): void => {
    pre?.removeAttribute("data-fold-hover");
  };
  code.addEventListener("click", onClick);
  code.addEventListener("keydown", onKeyDown);
  code.addEventListener("keyup", onKeyUp);
  code.addEventListener("pointerover", onPointerOver);
  code.addEventListener("pointerout", onPointerOut);
  pre?.addEventListener("pointermove", onPointerMove);
  pre?.addEventListener("pointerleave", onPointerLeave);
  return () => {
    pre?.removeEventListener("pointermove", onPointerMove);
    pre?.removeEventListener("pointerleave", onPointerLeave);
    pre?.removeAttribute("data-fold-hover");
    code.removeEventListener("click", onClick);
    code.removeEventListener("keydown", onKeyDown);
    code.removeEventListener("keyup", onKeyUp);
    code.removeEventListener("pointerover", onPointerOver);
    code.removeEventListener("pointerout", onPointerOut);
    for (const toggle of toggles.values()) {
      codeFoldSetters.delete(toggle);
      toggle.remove();
    }
    for (const more of code.querySelectorAll(".mdmark-code-fold-more")) {
      more.remove();
    }
    pre?.classList.remove("mdmark-code-foldable");
    for (const line of lines) {
      line.hidden = false;
      line.removeAttribute("data-guide-active");
      line.style.removeProperty("--mdmark-code-guide-depth");
      if (line.getAttribute("style") === "") {
        line.removeAttribute("style");
      }
    }
    for (const line of addedIds) {
      line.removeAttribute("id");
    }
    for (const lineBreak of breaks) {
      lineBreak?.replaceWith(...lineBreak.childNodes);
    }
  };
}

/** `data-fold-lines` の行を持つコードブロックに、行の開閉のボタン・`⋯`・縦線の範囲を付け、削除する関数を返却する */
export function attachCodeFolds(
  root: HTMLElement,
  states?: PartStates,
): () => void {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre > code")].filter(
    (code) =>
      code.querySelector(":scope > .mdmark-code-line[data-fold-lines]") !==
      null,
  );
  const detachers = blocks.map((code) => attachCodeBlock(code, root, states));
  return () => {
    for (const detach of detachers) {
      detach();
    }
  };
}
