import type { ExportPayload } from "../cli/html.ts";

/** 書き出しの中身から、文書のフォルダからのパスをキーにした取り込む文書の表を作る */
export const includesOf = (
  payload: ExportPayload,
  doc: ExportPayload["docs"][number],
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(doc.includes ?? {}).map(([key, file]) => [
      key,
      payload.includes?.[file] ?? "",
    ]),
  );
