// 矢印キーで移る向き
const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

// タブの id を文書の中で重ならせないための通し番号
let tabsCounter = 0;

/** タブ 1 組に、タブの並びと切り替えを付け、外す関数を返す */
function attachTabGroup(tabs: HTMLElement): () => void {
  tabsCounter += 1;
  const base = `mdmark-tabs-${tabsCounter}`;
  const panels = [
    ...tabs.querySelectorAll<HTMLElement>(":scope > .mdmark-tab-panel"),
  ];
  const tablist = document.createElement("div");
  tablist.className = "mdmark-tablist";
  tablist.setAttribute("role", "tablist");
  const buttons = panels.map((panel, index) => {
    const title = panel.querySelector(":scope > .mdmark-tab-title");
    const button = document.createElement("button");
    button.className = "mdmark-tab";
    button.type = "button";
    button.id = `${base}-tab-${index}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `${base}-panel-${index}`);
    button.textContent = title?.textContent ?? "";
    panel.id = `${base}-panel-${index}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    return button;
  });
  tablist.append(...buttons);
  tabs.prepend(tablist);

  /** タブを選び、選んだタブの中身だけを出す。`focus` が真ならフォーカスも移す */
  const select = (selected: number, focus: boolean): void => {
    buttons.forEach((button, index) => {
      button.setAttribute("aria-selected", String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
      panels[index]?.toggleAttribute("hidden", index !== selected);
    });
    if (focus) {
      buttons[selected]?.focus();
    }
  };
  /** 押したタブを選ぶ */
  const onClick = (event: Event): void => {
    const index = buttons.indexOf(
      (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[role=tab]",
      ) as HTMLButtonElement,
    );
    if (index >= 0) {
      select(index, true);
    }
  };
  /** 左右の矢印・Home・End で、選ぶタブを移す */
  const onKeydown = (event: KeyboardEvent): void => {
    const current = buttons.indexOf(
      (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[role=tab]",
      ) as HTMLButtonElement,
    );
    if (current < 0) {
      return;
    }
    let next: number | undefined;
    const step = ARROW_STEPS[event.key];
    if (step !== undefined) {
      next = (current + step + buttons.length) % buttons.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = buttons.length - 1;
    }
    if (next !== undefined) {
      event.preventDefault();
      select(next, true);
    }
  };
  tablist.addEventListener("click", onClick);
  tablist.addEventListener("keydown", onKeydown);
  select(0, false);
  return () => {
    tablist.remove();
    for (const panel of panels) {
      panel.removeAttribute("role");
      panel.removeAttribute("id");
      panel.removeAttribute("aria-labelledby");
      panel.removeAttribute("hidden");
    }
  };
}

/** 各 `mdmark-tabs` の頭にタブの並びを置き、中身を `role="tabpanel"` にして 1 つ目を選ぶ。タブの並びを取り除き、中身を `render` の形に戻す関数を返す */
export function attachTabs(root: HTMLElement): () => void {
  const detachers = [...root.querySelectorAll<HTMLElement>(".mdmark-tabs")].map(
    attachTabGroup,
  );
  return () => {
    for (const detach of detachers) {
      detach();
    }
  };
}
