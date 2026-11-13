import type { StateCore } from "markdown-it";
/** 表にしたコードブロックの `table_open` の `meta` に持たせる、記載したとおりの CSV */
export type CsvTableMeta = {
    rawCsv: string;
};
/** RFC 4180 の決まりで、CSV を行と値に分ける。末尾の改行は行にしない */
export declare const parseCsv: (text: string) => string[][];
/** `csv` がオンなら、言語 `csv` で中身が空でないコードブロックを、1 行目を見出しにした表のトークンにする。列の数が見出しと違う行はそろえて警告を差し込む */
export declare const buildCsvTables: (state: StateCore) => void;
