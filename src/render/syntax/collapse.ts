import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";

/** 折り畳みに入れるかと、既定の開閉 */
export type CollapseMode = "none" | "closed" | "open";

/** 表・タブ・ステップの印から `closed`・`open`・`title=` を読んだ結果 */
export type CollapseSpec = {
  /** 折り畳みに入れるかと既定の開閉。`closed` と `open` を両方書いたら `closed` */
  collapse: CollapseMode;
  /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
  title?: string | undefined;
  /** 読めなかった指定 */
  items: WarningItem[];
  /** `closed`・`open`・`title=` を除いた残りの引数 */
  rest: MdmarkMarkArgs;
};

/** 折り畳みの指定の引数 */
const COLLAPSE_ARGS = ["closed", "open"];

/** 折り畳みの見出しの引数のキー */
const TITLE_KEY = "title";

/** 表・タブ・ステップの印の引数から `closed`・`open`・`title=` を読む */
export function readCollapse(args: MdmarkMarkArgs): CollapseSpec {
  const closed = args.args.includes("closed");
  const open = args.args.includes("open");
  const collapse: CollapseMode = closed ? "closed" : open ? "open" : "none";
  const items: WarningItem[] = [];
  if (closed && open) {
    items.push({
      label: "closed と open",
      message:
        "の `closed` と `open` は同時に書けません。どちらか 1 つにしてください。`closed` を当てて描いています。",
    });
  }
  const { [TITLE_KEY]: titleValue, ...keys } = args.keys;
  let title: string | undefined;
  if (titleValue !== undefined) {
    if (collapse === "none") {
      items.push({
        label: `${TITLE_KEY}=`,
        message:
          "は `closed` か `open` と一緒に書きます。当てずに、折り畳みに入れず描いています。",
      });
    } else if (titleValue === "") {
      items.push({
        label: `${TITLE_KEY}=`,
        message:
          "の見出しがありません。`title=準備` のように書いてください。見出しは中身から作っています。",
      });
    } else {
      title = titleValue;
    }
  }
  return {
    collapse,
    title,
    items,
    rest: {
      args: args.args.filter((arg) => !COLLAPSE_ARGS.includes(arg)),
      keys,
    },
  };
}
