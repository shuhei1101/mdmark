// 矢印キーで移る向き
const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** 選んだタブ名を残す localStorage のキーの頭。キーは `{頭}{group}` */
export const TAB_CHOICE_KEY_PREFIX = "mdmark-tabs:";

// タブの id を文書の中で重ならせないための通し番号
let tabsCounter = 0;

/** 操作を付けた `mdmark-tabs` から、タブ名でタブを選ぶ関数を引く控え。別の `mount` のタブも同じ控えから引いて揃える */
const tabSelectors = new WeakMap<HTMLElement, (name: string) => void>();

/** localStorage に残したタブ名を読む。取り出しと読み出しで例外が出たら `console.warn` に出して `undefined` を返す */
export function loadTabChoice(group: string): string | undefined {
  try {
    return (
      window.localStorage.getItem(`${TAB_CHOICE_KEY_PREFIX}${group}`) ??
      undefined
    );
  } catch (error) {
    console.warn("選んだタブを読めませんでした", error);
    return undefined;
  }
}

/** 選んだタブ名を localStorage に残す。取り出しと書き込みで例外が出たら `console.warn` に出して続ける */
export function saveTabChoice(choice: { group: string; name: string }): void {
  try {
    window.localStorage.setItem(
      `${TAB_CHOICE_KEY_PREFIX}${choice.group}`,
      choice.name,
    );
  } catch (error) {
    console.warn("選んだタブを残せませんでした", error);
  }
}

/** ページの中の、操作を付けた `group` の `mdmark-tabs`（`tabs` を除く）を同じタブ名へ切り替える。そのタブ名が無いタブは変えない */
function syncTabGroup(options: {
  tabs: HTMLElement;
  group: string;
  name: string;
}): void {
  const { tabs, group, name } = options;
  // 組の名前に記号が入っても照合できるよう、セレクタに入れず dataset で絞る
  for (const other of document.querySelectorAll<HTMLElement>(
    ".mdmark-tabs[data-group]",
  )) {
    if (other !== tabs && other.dataset.group === group) {
      tabSelectors.get(other)?.(name);
    }
  }
}

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
  const titles = buttons.map((button) => button.textContent ?? "");
  const group = tabs.dataset.group;

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
  /** 読む人が選んだタブを選び、組を持つなら同じ組のタブを揃えて、タブ名を残す */
  const choose = (selected: number): void => {
    select(selected, true);
    const name = titles[selected];
    if (group !== undefined && name !== undefined) {
      syncTabGroup({ tabs, group, name });
      saveTabChoice({ group, name });
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
      choose(index);
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
      choose(next);
    }
  };
  tablist.addEventListener("click", onClick);
  tablist.addEventListener("keydown", onKeydown);
  // 組を持つタブは、残したタブ名のタブ（無ければ 1 つ目）を選ぶ。描いたときの選択は残さない
  const saved = group === undefined ? undefined : loadTabChoice(group);
  select(Math.max(0, titles.indexOf(saved ?? "")), false);
  if (group !== undefined) {
    // 揃えて切り替えるときは、フォーカスを動かさず残しもしない
    tabSelectors.set(tabs, (name) => {
      const position = titles.indexOf(name);
      if (position >= 0) {
        select(position, false);
      }
    });
  }
  return () => {
    tabSelectors.delete(tabs);
    tablist.remove();
    for (const panel of panels) {
      panel.removeAttribute("role");
      panel.removeAttribute("id");
      panel.removeAttribute("aria-labelledby");
      panel.removeAttribute("hidden");
    }
  };
}

/** 各 `mdmark-tabs` の頭にタブの並びを置き、中身を `role="tabpanel"` にして 1 つ目（組を持つなら残したタブ名のタブ）を選ぶ。タブの並びを取り除き、中身を `render` の形に戻す関数を返す */
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
