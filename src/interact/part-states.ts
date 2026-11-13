/** 読者が開閉した部品の要素の開閉を、`partKey` の鍵から引く記録。`mount` ごとに 1 つ作る */
export type PartStates = Map<string, { open: boolean; marker: string }>;

/** `partKey` の種類ごとに、同じセクションの中の何番目かを数える部品の要素のセレクタ */
export const PART_SELECTORS = {
  "row-detail": "table:has(tr.mdmark-row-detail)",
  details: 'details[class="mdmark-collapsible"]',
  callout: "details.markdown-alert",
  er: 'figure.mdmark-diagram[data-diagram="er"]',
  tree: "div.mdmark-tree",
  code: "pre:has([data-fold-lines])",
  "table-tree": "div.mdmark-table[data-tree]",
} as const satisfies Record<string, string>;

/** 部品の種類 */
export type PartKind = keyof typeof PART_SELECTORS;

/** 要素を囲む最も内側のセクションの中身の `id`（`root` の中に無ければ空の文字列） */
const sectionIdOf = (root: HTMLElement, element: Element): string => {
  const body = element.parentElement?.closest<HTMLElement>(
    ".mdmark-section-body",
  );
  return body && root.contains(body) ? body.id : "";
};

/** 部品を囲むセクションの `id` と、そのセクションの中の同じ種類の部品の何番目かで、記録の鍵を作る */
export const partKey = (options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 部品の要素 */
  part: Element;
  /** 部品の種類 */
  kind: PartKind;
  /** 部品の中の要素の鍵 */
  inner?: string;
}): string => {
  const { root, part, kind, inner } = options;
  const section = sectionIdOf(root, part);
  const index = [...root.querySelectorAll(PART_SELECTORS[kind])]
    .filter((candidate) => sectionIdOf(root, candidate) === section)
    .indexOf(part);
  const key = `${kind}|${section}|${index}`;
  return inner === undefined ? key : `${key}|${inner}`;
};

/** 記録の `marker` が今のマーカーと同じなら記録の開閉を、そうでなければマーカーのとおりの開閉を返却する */
export const startOpen = (options: {
  /** 部品の開閉の記録（無ければ記録を見ない） */
  states: PartStates | undefined;
  /** 記録の鍵 */
  key: string;
  /** 今のマーカーの値 */
  marker: string;
  /** マーカーのとおりの開閉 */
  markerOpen: boolean;
}): boolean => {
  const { states, key, marker, markerOpen } = options;
  const recorded = states?.get(key);
  return recorded !== undefined && recorded.marker === marker
    ? recorded.open
    : markerOpen;
};

/** 読者が変えた後の開閉を記録する */
export const recordOpen = (options: {
  /** 部品の開閉の記録（無ければ何もしない） */
  states: PartStates | undefined;
  /** 記録の鍵 */
  key: string;
  /** 変えた後の開閉 */
  open: boolean;
  /** 今のマーカーの値 */
  marker: string;
}): void => {
  const { states, key, open, marker } = options;
  states?.set(key, { open, marker });
};

/** details の範囲と折りたたみの注意書きを記録の開閉で始め、`summary` を押して変えた開閉を記録する。受け取りを取り除く関数を返却する */
export const attachDetailsStates = (options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 部品の開閉の記録 */
  states: PartStates;
}): (() => void) => {
  const { root, states } = options;
  const cleanups: Array<() => void> = [];
  const kinds = ["details", "callout"] as const;
  for (const kind of kinds) {
    for (const details of root.querySelectorAll<HTMLDetailsElement>(
      PART_SELECTORS[kind],
    )) {
      const key = partKey({ root, part: details, kind });
      const marker = details.open ? "open" : "closed";
      details.open = startOpen({
        states,
        key,
        marker,
        markerOpen: details.open,
      });
      let clicked = false;
      const onClick = (event: Event): void => {
        const summary = (event.target as Element).closest("summary");
        if (summary?.parentElement === details) {
          clicked = true;
        }
      };
      const onToggle = (): void => {
        if (clicked) {
          clicked = false;
          recordOpen({ states, key, open: details.open, marker });
        }
      };
      details.addEventListener("click", onClick);
      details.addEventListener("toggle", onToggle);
      cleanups.push(() => {
        details.removeEventListener("click", onClick);
        details.removeEventListener("toggle", onToggle);
      });
    }
  }
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
};
