import type { ExportPayload } from "../cli/html.ts";
import type { MountOptions } from "../mount.ts";

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

/** 書き出しの中身が持つ索引・文書の ID・参照の表・用語を、`mount` の引数にする */
export const knowledgeOptions = (
  payload: ExportPayload,
  docId: string | undefined,
): Pick<MountOptions, "index" | "docId" | "references" | "aliases"> => ({
  ...(payload.index ? { index: payload.index } : {}),
  ...(docId ? { docId } : {}),
  ...(payload.references ? { references: payload.references } : {}),
  ...(payload.aliases ? { aliases: payload.aliases } : {}),
});
