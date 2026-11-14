// PoC: 書き出した HTML から mdmark を使用していることを読み取れなくする置き換え
// 使用方法: node hide.mjs {入力の HTML} {出力の HTML}
import { readFileSync, writeFileSync } from "node:fs";

const ALIAS = "zq";
const PAYLOAD_OPEN = /<script type="application\/json" id="mdmark-payload">/;

/** 語の一部として出る mdmark を、大文字・小文字の形を保って別名へ置き換える */
export function replaceAll(text) {
  return text.replace(/mdmark/gi, (m) =>
    m === m.toUpperCase() ? ALIAS.toUpperCase() : m[0] === "M" ? ALIAS[0].toUpperCase() + ALIAS.slice(1) : ALIAS,
  );
}

/** 文書の本文: 部品の要素名・CSS 変数・class の値・アセットの scheme の mdmark だけを置き換える */
export function replaceInMarkdown(md) {
  return md
    .replace(/(<\/?)mdmark-/gi, `$1${ALIAS}-`)
    .replace(/--mdmark-/g, `--${ALIAS}-`)
    .replace(/(\bclass\s*=\s*["'])([^"']*)/gi, (_, head, value) => head + value.replace(/\bmdmark-/g, `${ALIAS}-`))
    .replace(/\bmdmark-asset:/g, `${ALIAS}-asset:`);
}

/** マーカー（`<!-- name -->`・`<!-- name: … -->`・`<!-- /name -->`）でない HTML のコメントを削除する */
export function dropNonMarkerComments(md) {
  return md.replace(/<!--([\s\S]*?)-->/g, (all, inner) =>
    /^\s*\/?[a-z][a-z0-9-]*\s*(:[\s\S]*)?$/.test(inner) ? all : "",
  );
}

function hidePayload(json) {
  const payload = JSON.parse(json);
  const userKeys = new Set(["index", "references", "aliases", "entry", "docs", "includes"]);
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = userKeys.has(key) ? value : JSON.parse(replaceAll(JSON.stringify(value)));
  }
  out.docs = payload.docs.map((doc) => ({ ...doc, markdown: replaceInMarkdown(dropNonMarkerComments(doc.markdown)) }));
  if (payload.includes) {
    out.includes = Object.fromEntries(
      Object.entries(payload.includes).map(([k, v]) => [k, replaceInMarkdown(dropNonMarkerComments(v))]),
    );
  }
  return JSON.stringify(out).replaceAll("<", "\\u003c");
}

export function hide(html) {
  const start = html.search(PAYLOAD_OPEN);
  const openEnd = html.indexOf(">", start) + 1;
  const end = html.indexOf("</script>", openEnd);
  const before = html.slice(0, start);
  const after = html.slice(end);
  const payload = hidePayload(html.slice(openEnd, end));
  const strip = (part) =>
    replaceAll(
      part
        .replace(/:root\{--mdmark-version:"[^"]*"\}\n?/g, "")
        .replace(/<!--([\s\S]*?)-->/g, ""),
    );
  return `${strip(before)}<script type="application/json" id="${ALIAS}-payload">${payload}${strip(after)}`;
}

if (process.argv[2]) {
  writeFileSync(process.argv[3], hide(readFileSync(process.argv[2], "utf8")));
}
