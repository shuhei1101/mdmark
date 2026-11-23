import { renderNotice } from "../shared/notice.part.ts";
import {
  applyCellRenderers,
  attachTableRows,
  type MdmarkTableCellEditDetail,
  renderCellContent,
} from "./mdmark-table.interact.ts";
import {
  checkTableSpec,
  type MdmarkTableColumn,
  type MdmarkTableFeatures,
  type MdmarkTableRow,
  type MdmarkTableValue,
  type TableSpec,
  toTableOptions,
} from "./mdmark-table.logic.ts";
import {
  attachTables,
  captureTableState,
  restoreTableState,
  type TableState,
} from "./table.interact.ts";
import { renderPlainTable, renderTable } from "./table.part.ts";
import { attachStickyRows } from "./table-sticky.interact.ts";

export type { MdmarkTableCellEditDetail };

/** 行の押下のイベントの値 */
export type MdmarkTableRowClickDetail = {
  /** 押した行の行のキー */
  key: string;
};

/** カスタム要素の名前 */
export const TABLE_ELEMENT_NAME = "mdmark-table";

/** 代入を受け取るプロパティ */
const PROPERTIES = ["columns", "rows", "features"] as const;

/** 編集した値の上書きのキー */
const editKey = (row: string, column: string): string =>
  `${row}\u0000${column}`;

/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** 列の定義と行のデータを代入すると、次のマイクロタスクで表か通知ブロックを描くカスタム要素 */
export class MdmarkTableElement extends BaseElement {
  #columns: MdmarkTableColumn[] | undefined;
  #rows: MdmarkTableRow[] | undefined;
  #features: MdmarkTableFeatures | undefined;
  #pending = false;
  #detach: (() => void) | undefined;
  #edits = new Map<string, string>();

  /** 列の定義 */
  get columns(): MdmarkTableColumn[] | undefined {
    return this.#columns;
  }

  set columns(value: MdmarkTableColumn[] | undefined) {
    this.#columns = value;
    this.scheduleRender();
  }

  /** 行のデータ */
  get rows(): MdmarkTableRow[] | undefined {
    return this.#rows;
  }

  set rows(value: MdmarkTableRow[] | undefined) {
    this.#rows = value;
    this.#edits.clear();
    this.scheduleRender();
  }

  /** 表の機能 */
  get features(): MdmarkTableFeatures | undefined {
    return this.#features;
  }

  set features(value: MdmarkTableFeatures | undefined) {
    this.#features = value;
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

  /** 操作を解除する（要素の中身とプロパティは残す） */
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
    queueMicrotask(() => this.renderNow());
  }

  /** 指定を確認して、表か通知ブロックを描く */
  renderNow(): void {
    this.#pending = false;
    if (
      !this.isConnected ||
      this.#columns === undefined ||
      this.#rows === undefined
    ) {
      return;
    }
    const previous = this.querySelector<HTMLElement>(".mdmark-table");
    const state: TableState | undefined = previous
      ? captureTableState(previous)
      : undefined;
    this.#detach?.();
    this.#detach = undefined;
    const issue = checkTableSpec({
      columns: this.#columns,
      rows: this.#rows,
      features: this.#features,
    });
    if (issue) {
      this.replaceChildren(
        this.#container(
          renderNotice({
            name: issue.path,
            source: "table-data",
            reason: issue.reason,
          }),
        ),
      );
      return;
    }
    const spec: TableSpec = {
      columns: this.#columns,
      rows: this.#editedRows(this.#rows),
      features: this.#features,
    };
    const options = toTableOptions(spec);
    const root = this.#container(
      renderTable({ ...options, body: renderPlainTable(options) }),
    );
    this.replaceChildren(root);
    const wrapper = root.querySelector<HTMLElement>(".mdmark-table");
    if (!wrapper) {
      return;
    }
    applyCellRenderers(wrapper, spec);
    const detachers = [
      attachTables(root, { pinMode: "each" }),
      attachStickyRows(root),
      attachTableRows(wrapper, this.#handlers(spec)),
    ];
    if (state) {
      restoreTableState(wrapper, state);
    }
    this.#detach = () => {
      for (const detach of detachers.reverse()) {
        detach();
      }
    };
  }

  /** class `mdmark` の要素に HTML を入れて返却する */
  #container(html: string): HTMLElement {
    const root = document.createElement("div");
    root.className = "mdmark";
    root.innerHTML = html;
    return root;
  }

  /** 確定した編集の値を重ねた行のデータ */
  #editedRows(rows: MdmarkTableRow[]): MdmarkTableRow[] {
    if (this.#edits.size === 0) {
      return rows;
    }
    return rows.map((row) => {
      const values = { ...row.values };
      for (const [key, value] of this.#edits) {
        const [rowKey, column] = key.split("\u0000");
        if (rowKey === row.key && column !== undefined) {
          values[column] = value;
        }
      }
      return { key: row.key, values };
    });
  }

  /** 行とセルの操作の通知先（要素のイベントを送信する） */
  #handlers(spec: TableSpec) {
    const rowOf = new Map(spec.rows.map((row) => [row.key, row]));
    const readValue = (key: string, column: number): MdmarkTableValue => {
      const columnKey = spec.columns[column]?.key ?? "";
      const edited = this.#edits.get(editKey(key, columnKey));
      return edited ?? rowOf.get(key)?.values[columnKey] ?? null;
    };
    return {
      onRowClick: (key: string) => {
        this.dispatchEvent(
          new CustomEvent<MdmarkTableRowClickDetail>("mdmark-row-click", {
            detail: { key },
            bubbles: true,
            composed: true,
          }),
        );
      },
      onCellEdit: (detail: MdmarkTableCellEditDetail): boolean => {
        const accepted = this.dispatchEvent(
          new CustomEvent<MdmarkTableCellEditDetail>("mdmark-cell-edit", {
            detail,
            bubbles: true,
            composed: true,
            cancelable: true,
          }),
        );
        if (accepted) {
          this.#edits.set(editKey(detail.key, detail.column), detail.value);
        }
        return accepted;
      },
      onRowAdd: () => {
        this.dispatchEvent(
          new CustomEvent<Record<string, never>>("mdmark-row-add", {
            detail: {},
            bubbles: true,
            composed: true,
          }),
        );
      },
      renderCell: (cell: HTMLTableCellElement, key: string, column: number) => {
        const definition = spec.columns[column];
        const row = rowOf.get(key);
        if (definition?.render && row) {
          const value = readValue(key, column);
          renderCellContent({
            cell,
            column: definition,
            row: { key, values: { ...row.values, [definition.key]: value } },
            value,
          });
        }
      },
      valueOf: readValue,
    };
  }
}

/** 登録先に `mdmark-table` が登録されていなければ `MdmarkTableElement` を登録する */
export const defineTableElement = (registry: CustomElementRegistry): void => {
  if (registry.get(TABLE_ELEMENT_NAME) === undefined) {
    registry.define(TABLE_ELEMENT_NAME, MdmarkTableElement);
  }
};
