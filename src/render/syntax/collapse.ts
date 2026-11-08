import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";

/** 折り畳みに入れるかと、既定の開閉 */
export type CollapseMode = "none" | "closed" | "open";

/** 表・タブ・ステップのマーカーから `closed`・`open`・`title=` を読み込んだ結果 */
export type CollapseSpec = {
  /** 折り畳みに入れるかと既定の開閉。`closed` と `open` を両方書いたら `closed` */
  collapse: CollapseMode;
  /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
  title?: string | undefined;
  /** 読み込めなかった指定 */
  items: WarningItem[];
  /** `title=` の値の空白の後ろの単語。`closed`・`open` と、`+`・`-` で始まる単語は入れない。呼ぶ側が知らない指定としてスキップする前にこの単語と比べ、同じなら `titleTailItem` の警告にする */
  titleTail?: string | undefined;
  /** `closed`・`open`・`title=` を除いた残りの引数 */
  rest: MdmarkMarkArgs;
};

/** 折り畳みの指定の引数 */
const COLLAPSE_ARGS = ["closed", "open"];

/** 折り畳みの見出しの引数のキー */
const TITLE_KEY = "title";

/** マーカーの引数の文字から、`title=値` の直後に空白を挟んで続く `キー=値` でない単語（空白を含むタイトルの続き）を返却する */
export function titleTailOf(text: string): string | undefined {
  const tail = /(?:^|\s)title=\S*\s+(\S+)/.exec(text)?.[1];
  return tail === undefined || tail.includes("=") ? undefined : tail;
}

/** `title=` の値の空白の後ろの単語の警告の項目 */
export function titleTailItem(word: string): WarningItem {
  return {
    label: word,
    message:
      "使用できない指定です。マーカーの引数は空白で区切るため、`title=` の値に空白は記載できません。",
  };
}

/** 表・タブ・ステップのマーカーの引数から `closed`・`open`・`title=` を読み込む。`text` はマーカーの引数の文字で、`title=` の値の空白の後ろの単語を `titleTail` にする */
export function readCollapse(args: MdmarkMarkArgs, text = ""): CollapseSpec {
  const closed = args.args.includes("closed");
  const open = args.args.includes("open");
  const collapse: CollapseMode = closed ? "closed" : open ? "open" : "none";
  const items: WarningItem[] = [];
  if (closed && open) {
    items.push({
      label: "closed と open",
      message:
        "の `closed` と `open` は同時に記載できません。どちらか 1 つにしてください。`closed` を適用して描いています。",
    });
  }
  const { [TITLE_KEY]: titleValue, ...keys } = args.keys;
  let title: string | undefined;
  if (titleValue !== undefined) {
    if (collapse === "none") {
      items.push({
        label: `${TITLE_KEY}=`,
        message:
          "は `closed` か `open` と一緒に記載します。当てずに、折り畳みに入れず描いています。",
      });
    } else if (titleValue === "") {
      items.push({
        label: `${TITLE_KEY}=`,
        message:
          "の見出しがありません。`title=準備` のように記載してください。見出しは中身から作っています。",
      });
    } else {
      title = titleValue;
    }
  }
  const tail = titleValue === undefined ? undefined : titleTailOf(text);
  const titleTail =
    tail === undefined ||
    COLLAPSE_ARGS.includes(tail) ||
    tail.startsWith("+") ||
    tail.startsWith("-")
      ? undefined
      : tail;
  return {
    collapse,
    title,
    items,
    titleTail,
    rest: {
      args: args.args.filter((arg) => !COLLAPSE_ARGS.includes(arg)),
      keys,
    },
  };
}
