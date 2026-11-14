import type { StateCore, Token } from "markdown-it";
import { type CardGridItem, renderCardGrid } from "../../parts/card-grid.ts";
import { SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import type { Mark } from "../marks.ts";
import { ICON_NAME_PATTERN } from "./inline-icons.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** アイコンにする行内のコードの頭 */
const ICON_PREFIX = "icon:";

/** URL をそのまま記載したリンクのマークアップ */
const AUTOLINK_MARKUPS = ["linkify", "autolink"];

/** URL のスキーム */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/** 行内の子を HTML にする */
const renderInline = (state: StateCore, children: Token[]): string =>
  state.md.renderer.renderInline(children, state.md.options, state.env).trim();

/** 行内の子の頭の空白と改行を除く */
const trimStart = (children: Token[]): Token[] => {
  const rest = [...children];
  while (
    rest[0] &&
    (rest[0].type === "softbreak" ||
      (rest[0].type === "text" && rest[0].content.trim() === ""))
  ) {
    rest.shift();
  }
  const [first] = rest;
  if (first?.type === "text") {
    const trimmed = Object.assign(
      Object.create(Object.getPrototypeOf(first)),
      first,
    );
    trimmed.content = first.content.trimStart();
    rest[0] = trimmed;
  }
  return rest;
};

/** 頭の `icon:名前` の行内のコードをアイコンにし、残りの子の並びと一緒に返却する */
const takeIcon = (
  children: Token[],
): { icon: string | undefined; rest: Token[] } => {
  const [head] = children;
  if (head?.type !== "code_inline" || !head.content.startsWith(ICON_PREFIX)) {
    return { icon: undefined, rest: children };
  }
  const name = head.content.slice(ICON_PREFIX.length).trim();
  if (!ICON_NAME_PATTERN.test(name)) {
    return { icon: undefined, rest: children };
  }
  return { icon: name, rest: trimStart(children.slice(1)) };
};

/** 項目の行内の子の並びから、カードの中身を読み込む */
const readItem = (state: StateCore, children: Token[]): CardGridItem => {
  const { icon, rest } = takeIcon(trimStart(children));
  const openIndex = rest.findIndex((child) => child.type === "link_open");
  const closeIndex = rest.findIndex(
    (child, index) => index > openIndex && child.type === "link_close",
  );
  if (openIndex >= 0 && closeIndex > openIndex) {
    const open = rest[openIndex] as Token;
    const inner = rest.slice(openIndex + 1, closeIndex);
    const autolinked = AUTOLINK_MARKUPS.includes(open.markup);
    const title = autolinked
      ? renderInline(state, inner).replace(SCHEME_PATTERN, "")
      : renderInline(state, inner);
    // カードのリンクの中にリンクを入れられないため、説明のリンクは文字だけにする
    const description = renderInline(
      state,
      [
        ...rest.slice(0, openIndex),
        ...trimStart(rest.slice(closeIndex + 1)),
      ].filter(
        (child) => child.type !== "link_open" && child.type !== "link_close",
      ),
    );
    return {
      title,
      href: String(open.attrGet("href") ?? ""),
      icon,
      description,
    };
  }
  // リンクを持たない項目は、最初の行をタイトル、残りを説明にする
  const breakIndex = rest.findIndex((child) => child.type === "softbreak");
  const titleChildren = breakIndex < 0 ? rest : rest.slice(0, breakIndex);
  const descriptionChildren =
    breakIndex < 0 ? [] : trimStart(rest.slice(breakIndex + 1));
  return {
    title: renderInline(state, titleChildren),
    icon,
    description: renderInline(state, descriptionChildren),
  };
};

/** カードの格子の枠だけに mdmark が出した要素のマーカーを付け、記載した人のタイトルと説明の HTML をマーカーの後に差し込んだトークン */
const cardGridBlock = (
  state: StateCore,
  items: CardGridItem[],
  source: Token,
): Token => {
  const slots: string[] = [];
  const frames = items.map((item) => {
    slots.push(item.title);
    const hasDescription =
      item.description !== undefined && item.description !== "";
    if (hasDescription) {
      slots.push(item.description as string);
    }
    return {
      ...item,
      title: SLOT_MARKER,
      description: hasDescription ? SLOT_MARKER : undefined,
    };
  });
  const token = ownBlock(
    state,
    renderCardGrid({ items: frames, icons: envOf(state).icons }),
    source,
  );
  const pieces = splitSlots(token.content);
  token.content = pieces
    .map((piece, index) => `${piece}${slots[index] ?? ""}`)
    .join("");
  return token;
};

/** リスト 1 つの項目ごとに、段落の行内の子を改行でつないで集める */
const collectItems = (tokens: Token[]): Token[][] => {
  const items: Token[][] = [];
  let current: Token[] | undefined;
  for (const token of tokens) {
    if (token.type === "list_item_open" && token.level === 1) {
      current = [];
      items.push(current);
    } else if (token.type === "inline" && current) {
      if (current.length > 0) {
        current.push(
          Object.assign(Object.create(Object.getPrototypeOf(token)), {
            ...token,
            type: "softbreak",
            children: null,
            content: "",
          }),
        );
      }
      current.push(...(token.children ?? []));
    }
  }
  return items;
};

/** 範囲の中身がリスト 1 つか（リストの開きと閉じが範囲の両端にある） */
const isSingleList = (inner: Token[]): boolean => {
  const first = inner[0];
  const last = inner.at(-1);
  if (
    !first ||
    !last ||
    !["bullet_list_open", "ordered_list_open"].includes(first.type) ||
    last.type !== first.type.replace("_open", "_close")
  ) {
    return false;
  }
  return inner.filter((token) => token.level === first.level).length === 2;
};

/** `card-grid` がオンなら、`<!-- cards -->` 〜 `<!-- /cards -->` の中身のリスト 1 つをカードの格子にする。中身がリスト 1 つでないときは警告を差し込み、オフのときは何もしない（マーカーは後で取り除く） */
export const buildCardGrid = (state: StateCore): void => {
  if (!featureOn(state, "card-grid")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    const mark = markOf(token);
    if (mark?.name !== "cards" || mark.closing) {
      out.push(token);
      continue;
    }
    const closeIndex = findClose(tokens, index, "cards");
    const inner = closeIndex < 0 ? [] : tokens.slice(index + 1, closeIndex);
    if (closeIndex < 0 || !isSingleList(inner)) {
      out.push(
        warningBlock(
          state,
          {
            mark: (mark as Mark).raw,
            message:
              "で囲めるのはリスト 1 つです。カードの格子にせずに、中身を記載したとおりに表示しています。",
          },
          token,
        ),
      );
      continue;
    }
    const items = collectItems(
      inner.map((child) =>
        Object.assign(Object.create(Object.getPrototypeOf(child)), child, {
          level: child.level - (inner[0]?.level ?? 0),
        }),
      ),
    ).map((children) => readItem(state, children));
    out.push(cardGridBlock(state, items, token));
    index = closeIndex;
  }
  state.tokens = out;
};
