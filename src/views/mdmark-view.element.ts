import { loadPartModule } from "../part-modules.ts";
import { renderNotice } from "../shared/notice.part.ts";
import {
  captureTableState,
  restoreTableState,
  type TableState,
} from "../table/table.interact.ts";
import type { FilterKind } from "../table/table.logic.ts";
import {
  checkViewOptions,
  type MdmarkViewOptions,
  type ViewIconName,
} from "./spec.ts";

/** ビューのカスタム要素の項目 */
export type MdmarkViewItem = {
  /** 項目のキー。`mdmark-item-click` の `key` にする */
  key: string;
  /** 列名をキーにした値の組 */
  values: Record<string, string>;
};

/** 項目の押下のイベントの値 */
export type MdmarkViewItemClickDetail = {
  /** 押した項目の `items[].key` */
  key: string;
};

/** カスタム要素の名前 */
export const VIEW_ELEMENT_NAME = "mdmark-view";

/** 代入を受け取るプロパティ */
const PROPERTIES = [
  "columns",
  "items",
  "group",
  "default",
  "filter",
  "icons",
] as const;

/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** 指定の誤り */
type ViewIssue = { name: string; reason: string };

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `items` の構造とキーの重なりを確かめ、誤りがあれば最初の 1 つを返却する */
const checkItems = (items: unknown): ViewIssue | undefined => {
  if (!Array.isArray(items)) {
    return { name: "items", reason: "は項目の配列で指定してください。" };
  }
  const keys = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (!isRecord(item) || !isRecord(item.values)) {
      return {
        name: `items[${index}]`,
        reason: "は key と values を持つオブジェクトで指定してください。",
      };
    }
    if (typeof item.key !== "string" || item.key === "") {
      return {
        name: `items[${index}].key`,
        reason: "は空でない文字列で指定してください。",
      };
    }
    if (keys.has(item.key)) {
      return {
        name: `items[${index}].key`,
        reason:
          "がほかの項目と重なっています。項目ごとに異なるキーにしてください。",
      };
    }
    keys.add(item.key);
  }
  return undefined;
};

/** `checkViewOptions` の `TypeError` のメッセージを、指定の名前と誤りの内容に分ける */
const issueOf = (error: TypeError): ViewIssue => {
  const match = /^opts\.([^\s]+) (.*)$/.exec(error.message);
  return match
    ? { name: match[1] ?? "", reason: match[2] ?? "" }
    : { name: "items", reason: error.message };
};

/** 列名と項目を代入すると、次のマイクロタスクでビューか通知ブロックを描くカスタム要素 */
export class MdmarkViewElement extends BaseElement {
  #columns: string[] | undefined;
  #items: MdmarkViewItem[] | undefined;
  #group: string | undefined;
  #default: "board" | "table" | undefined;
  #filter: Record<string, FilterKind> | undefined;
  #icons: Record<string, ViewIconName> | undefined;
  #pending = false;
  #detach: (() => void) | undefined;
  /** 描画の番号。部品のモジュールを待つ間に次の描画が始まったら、前の描画をやめる */
  #renders = 0;

  /** 列名 */
  get columns(): string[] | undefined {
    return this.#columns;
  }

  set columns(value: string[] | undefined) {
    this.#columns = value;
    this.scheduleRender();
  }

  /** 項目 */
  get items(): MdmarkViewItem[] | undefined {
    return this.#items;
  }

  set items(value: MdmarkViewItem[] | undefined) {
    this.#items = value;
    this.scheduleRender();
  }

  /** ボードで列に分ける列名 */
  get group(): string | undefined {
    return this.#group;
  }

  set group(value: string | undefined) {
    this.#group = value;
    this.scheduleRender();
  }

  /** 描いた直後に出すビュー */
  get default(): "board" | "table" | undefined {
    return this.#default;
  }

  set default(value: "board" | "table" | undefined) {
    this.#default = value;
    this.scheduleRender();
  }

  /** 絞り込みを付ける列と種類 */
  get filter(): Record<string, FilterKind> | undefined {
    return this.#filter;
  }

  set filter(value: Record<string, FilterKind> | undefined) {
    this.#filter = value;
    this.scheduleRender();
  }

  /** ボードの列の見出しのアイコンの対応 */
  get icons(): Record<string, ViewIconName> | undefined {
    return this.#icons;
  }

  set icons(value: Record<string, ViewIconName> | undefined) {
    this.#icons = value;
    this.scheduleRender();
  }

  /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、描画を予約する */
  connectedCallback(): void {
    for (const name of PROPERTIES) {
      if (Object.hasOwn(this, name)) {
        const value: unknown = (this as Record<string, unknown>)[name];
        delete (this as Record<string, unknown>)[name];
        (this as Record<string, unknown>)[name] = value;
      }
    }
    this.scheduleRender();
  }

  /** `document` の受け取りを解除する（プロパティは残し、ページへ戻すと描き直す） */
  disconnectedCallback(): void {
    this.#detach?.();
    this.#detach = undefined;
  }

  /** 描画を次のマイクロタスクに 1 回だけ予約する */
  scheduleRender(): void {
    if (this.#pending) {
      return;
    }
    this.#pending = true;
    queueMicrotask(() => {
      void this.renderNow();
    });
  }

  /** 指定を確認し、誤りがあれば通知ブロックを、無ければビューの部品のモジュールの `drawView` で描く */
  async renderNow(): Promise<void> {
    this.#pending = false;
    if (
      !this.isConnected ||
      this.#columns === undefined ||
      this.#items === undefined
    ) {
      return;
    }
    this.#renders += 1;
    const render = this.#renders;
    const issue = this.#check();
    if (issue) {
      this.#detach?.();
      this.#detach = undefined;
      this.#showNotice(
        renderNotice({
          name: issue.name,
          figure: false,
          source: "data",
          reason: issue.reason,
        }),
      );
      return;
    }
    let module: Awaited<ReturnType<typeof loadPartModule<"view">>>["module"];
    try {
      ({ module } = await loadPartModule("view"));
    } catch {
      this.#showNotice(
        renderNotice({ name: "view", figure: false, source: "part" }),
      );
      return;
    }
    if (render !== this.#renders || !this.isConnected) {
      return;
    }
    const state = this.#captureState();
    this.#detach?.();
    const items = this.#items;
    this.#detach = module.drawView(this, this.#options(items), {
      keys: items.map((item) => item.key),
      onItemClick: (key) => {
        this.dispatchEvent(
          new CustomEvent<MdmarkViewItemClickDetail>("mdmark-item-click", {
            detail: { key },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
    this.#restoreState(state);
  }

  /** 指定を確認し、最初の誤りを返却する */
  #check(): ViewIssue | undefined {
    const itemsIssue = checkItems(this.#items);
    if (itemsIssue) {
      return itemsIssue;
    }
    try {
      checkViewOptions(this, this.#options(this.#items ?? []));
    } catch (error) {
      if (error instanceof TypeError) {
        return issueOf(error);
      }
      throw error;
    }
    return undefined;
  }

  /** `drawView` に渡す指定（省いたプロパティは渡さない） */
  #options(items: MdmarkViewItem[]): MdmarkViewOptions {
    return {
      columns: this.#columns ?? [],
      items: items.map((item) => item.values),
      ...(this.#group === undefined ? {} : { group: this.#group }),
      ...(this.#default === undefined ? {} : { default: this.#default }),
      ...(this.#filter === undefined ? {} : { filter: this.#filter }),
      ...(this.#icons === undefined ? {} : { icons: this.#icons }),
    };
  }

  /** 要素の中を class `mdmark` の要素の中の通知ブロックにする */
  #showNotice(html: string): void {
    const root = document.createElement("div");
    root.className = "mdmark";
    root.innerHTML = html;
    this.replaceChildren(root);
  }

  /** 表示しているビューと、表形式の並べ替え・絞り込みを記録する */
  #captureState(): { mode?: string; table?: TableState } {
    const view = this.querySelector<HTMLElement>(".mdmark-view");
    if (!view) {
      return {};
    }
    const mode = view.querySelector<HTMLElement>(
      '.mdmark-view-switch-item[aria-pressed="true"]',
    )?.dataset.mode;
    const table = view.querySelector<HTMLElement>(
      ".mdmark-view-table .mdmark-table",
    );
    return {
      ...(mode === undefined ? {} : { mode }),
      ...(table ? { table: captureTableState(table) } : {}),
    };
  }

  /** 記録したビューと並べ替え・絞り込みを、同じ列名について戻す */
  #restoreState(state: { mode?: string; table?: TableState }): void {
    if (state.mode !== undefined) {
      this.querySelector<HTMLButtonElement>(
        `.mdmark-view-switch-item[data-mode="${CSS.escape(state.mode)}"]:not(:disabled)`,
      )?.click();
    }
    const table = this.querySelector<HTMLElement>(
      ".mdmark-view-table .mdmark-table",
    );
    if (table && state.table) {
      restoreTableState(table, state.table);
    }
  }
}

/** 登録先に `mdmark-view` が登録されていなければ `MdmarkViewElement` を登録する */
export const defineViewElement = (registry: CustomElementRegistry): void => {
  if (registry.get(VIEW_ELEMENT_NAME) === undefined) {
    registry.define(VIEW_ELEMENT_NAME, MdmarkViewElement);
  }
};
