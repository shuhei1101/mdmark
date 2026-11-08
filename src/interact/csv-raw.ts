import { renderRawBar } from "../parts/table.ts";

// 表と、表を包む横のスクロールの要素
const TABLE_SELECTOR =
  ":scope > table, :scope > .mdmark-table-scroll > table, :scope > details > table, :scope > details > .mdmark-table-scroll > table";

/** 表と元の CSV を入れ替えるときに隠す・出す要素（表を包む要素があればそれ、無ければ表） */
const tableBlockOf = (table: Element): HTMLElement => {
  const parent = table.parentElement;
  return parent?.classList.contains("mdmark-table-scroll") === true
    ? parent
    : (table as HTMLElement);
};

/** CSV の表の囲みの帯に RAW のボタンを配置し、押すたびに表と元の CSV を入れ替える。並べ替え・絞り込み・ピン止めの状態は触らない */
export const attachCsvRaw = (root: HTMLElement): (() => void) => {
  const wrappers = [
    ...root.querySelectorAll<HTMLElement>(
      'div.mdmark-table[data-source="csv"]',
    ),
  ];
  const added: Element[] = [];
  for (const wrapper of wrappers) {
    const table = wrapper.querySelector(TABLE_SELECTOR);
    if (!table || wrapper.querySelector(".mdmark-raw-toggle")) {
      continue;
    }
    const pressed = wrapper.dataset.view === "raw";
    // 表の操作の帯があれば、その道具の並びに追加し、無ければ RAW のボタンの帯を表の前に配置する
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
      const block = tableBlockOf(table);
      block.insertAdjacentHTML("beforebegin", renderRawBar(pressed));
      if (block.previousElementSibling) {
        added.push(block.previousElementSibling);
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
    const table = wrapper.querySelector(TABLE_SELECTOR);
    const showRaw = wrapper.dataset.view !== "raw";
    if (showRaw) {
      wrapper.dataset.view = "raw";
    } else {
      delete wrapper.dataset.view;
    }
    button.setAttribute("aria-pressed", String(showRaw));
    if (table) {
      tableBlockOf(table).hidden = showRaw;
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
