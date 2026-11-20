import type { ExportPayload } from "../cli/html.ts";
import type { MdmarkRendered, MountOptions } from "../mount.ts";
import { restoreAssets } from "./bundle.ts";

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

/** 書き出しの中身の文書 1 つから、`mount` の `rendered`・`pureMarkdown`・`path` を作る。`bundle` では `rendered.html` と `pureMarkdown` の `mdmark-asset:{キー}` を `assets` の `data:` URL に替える */
export const renderedOptions = (options: {
  payload: ExportPayload;
  doc: ExportPayload["docs"][number];
}): { rendered: MdmarkRendered; pureMarkdown: string; path: string } => {
  const { payload, doc } = options;
  return {
    rendered: {
      ...doc.rendered,
      html: restoreAssets(doc.rendered.html, payload.assets),
    },
    pureMarkdown: restoreAssets(doc.pureMarkdown, payload.assets),
    path: doc.path,
  };
};
