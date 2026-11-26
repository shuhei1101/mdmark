import { renderRawToggle } from "./table.part.ts";

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

/** 囲みの直下の、元の CSV の要素 */
const rawOf = (wrapper: HTMLElement): HTMLElement | null =>
  wrapper.querySelector<HTMLElement>(":scope > pre.mdmark-raw");

/** 囲みの中の、その囲みの表のメニューのボタン */
const menuButtonOf = (wrapper: HTMLElement): HTMLElement | undefined =>
  [...wrapper.querySelectorAll<HTMLElement>("button.mdmark-table-menu")].find(
    (button) => button.closest(".mdmark-table") === wrapper,
  );

/** 囲みの表と元の CSV を入れ替え、出した側のボタンへフォーカスを移す */
const showRaw = (wrapper: HTMLElement, shown: boolean): void => {
  const table = wrapper.querySelector(TABLE_SELECTOR);
  const toggle = wrapper.querySelector<HTMLElement>(
    ":scope > .mdmark-raw-toggle",
  );
  const menuButton = menuButtonOf(wrapper);
  if (shown) {
    wrapper.dataset.view = "raw";
  } else {
    delete wrapper.dataset.view;
  }
  if (table) {
    tableBlockOf(table).hidden = shown;
  }
  const raw = rawOf(wrapper);
  if (raw) {
    raw.hidden = !shown;
  }
  if (menuButton) {
    menuButton.hidden = shown;
  }
  if (toggle) {
    toggle.hidden = !shown;
  }
  (shown ? toggle : menuButton)?.focus();
};

/** CSV の表の元の CSV の右上に「表で表示」のボタンを配置し、表のメニューの「元の CSV を表示」と「表で表示」で表と元の CSV を入れ替える。並べ替え・絞り込み・ピン止めの状態は触らない */
export const attachCsvRaw = (root: HTMLElement): (() => void) => {
  const wrappers = [
    ...root.querySelectorAll<HTMLElement>(
      'div.mdmark-table[data-source="csv"]',
    ),
  ];
  const added: Element[] = [];
  for (const wrapper of wrappers) {
    const raw = rawOf(wrapper);
    if (!raw || wrapper.querySelector(".mdmark-raw-toggle")) {
      continue;
    }
    raw.insertAdjacentHTML(
      "afterend",
      renderRawToggle(wrapper.dataset.view === "raw"),
    );
    if (raw.nextElementSibling) {
      added.push(raw.nextElementSibling);
    }
  }
  const onClick = (event: Event): void => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>(
      'button.mdmark-raw-toggle, button.mdmark-table-menu-item[data-action="raw"]',
    );
    const wrapper = button?.closest<HTMLElement>(
      'div.mdmark-table[data-source="csv"]',
    );
    if (!button || !wrapper) {
      return;
    }
    showRaw(wrapper, !button.classList.contains("mdmark-raw-toggle"));
  };
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
    for (const element of added) {
      element.remove();
    }
  };
};
