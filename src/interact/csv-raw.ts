import { renderRawBar } from "../parts/table.ts";

/** CSV の表の囲みの帯に RAW のボタンを置き、押すたびに表と元の CSV を入れ替える。並べ替え・絞り込み・ピン止めの状態は触らない */
export const attachCsvRaw = (root: HTMLElement): (() => void) => {
  const wrappers = [
    ...root.querySelectorAll<HTMLElement>(
      'div.mdmark-table[data-source="csv"]',
    ),
  ];
  const added: Element[] = [];
  for (const wrapper of wrappers) {
    const table = wrapper.querySelector(
      ":scope > table, :scope > details > table",
    );
    if (!table || wrapper.querySelector(".mdmark-raw-toggle")) {
      continue;
    }
    const pressed = wrapper.dataset.view === "raw";
    // 表の操作の帯があれば、その道具の並びに足し、無ければ RAW のボタンの帯を表の前に置く
    const bar = wrapper.querySelector(":scope > .mdmark-table-bar");
    if (bar) {
      const holder = document.createElement("div");
      holder.innerHTML = renderRawBar(pressed);
      const tools = holder.querySelector(".mdmark-table-tools");
      if (tools) {
        bar.append(tools);
        added.push(tools);
      }
    } else {
      table.insertAdjacentHTML("beforebegin", renderRawBar(pressed));
      if (table.previousElementSibling) {
        added.push(table.previousElementSibling);
      }
    }
  }
  const onClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "button.mdmark-raw-toggle",
    );
    const wrapper = button?.closest<HTMLElement>(
      'div.mdmark-table[data-source="csv"]',
    );
    if (!button || !wrapper) {
      return;
    }
    const raw = wrapper.querySelector<HTMLElement>(":scope > pre.mdmark-raw");
    const table = wrapper.querySelector<HTMLElement>(
      ":scope > table, :scope > details > table",
    );
    const showRaw = wrapper.dataset.view !== "raw";
    if (showRaw) {
      wrapper.dataset.view = "raw";
    } else {
      delete wrapper.dataset.view;
    }
    button.setAttribute("aria-pressed", String(showRaw));
    if (table) {
      table.hidden = showRaw;
    }
    if (raw) {
      raw.hidden = !showRaw;
    }
  };
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
    for (const element of added) {
      element.remove();
    }
  };
};
