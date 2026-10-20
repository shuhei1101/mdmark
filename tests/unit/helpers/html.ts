/** HTML の中の開始タグを、現れた順に全て返す */
export function startTags(html: string): string[] {
  return html.match(/<[a-zA-Z][^>]*>/g) ?? [];
}

/** `needle` を含む最初の開始タグを返す（無ければ例外） */
export function findTag(html: string, needle: string): string {
  const tag = startTags(html).find((candidate) => candidate.includes(needle));
  if (tag === undefined) {
    throw new Error(`開始タグが無い: ${needle}`);
  }
  return tag;
}

/** `needle` を含む開始タグを全て返す */
export function findTags(html: string, needle: string): string[] {
  return startTags(html).filter((candidate) => candidate.includes(needle));
}

/** 開始タグのタグ名を返す */
function tagName(tag: string): string {
  const name = /^<([a-zA-Z0-9]+)/.exec(tag)?.[1];
  if (name === undefined) {
    throw new Error(`タグ名が読めない: ${tag}`);
  }
  return name;
}

/** `needle` を含む最初の開始タグの要素の中身を、同じ名前の入れ子を数えて返す */
export function innerHtml(html: string, needle: string): string {
  const tag = findTag(html, needle);
  const name = tagName(tag);
  const start = html.indexOf(tag) + tag.length;
  const pattern = new RegExp(`<${name}\\b[^>]*>|</${name}>`, "g");
  pattern.lastIndex = start;
  let depth = 1;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return html.slice(start, match.index);
    }
  }
  throw new Error(`閉じタグが無い: ${tag}`);
}

/** `needle` を含む最初の開始タグから、その要素の閉じタグまでを返す */
export function outerHtml(html: string, needle: string): string {
  const tag = findTag(html, needle);
  return `${tag}${innerHtml(html, needle)}</${tagName(tag)}>`;
}

/** タグを取り除き、`&lt;`・`&gt;`・`&amp;` を文字に戻して、画面に出る文字だけにする */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** 正規表現（`g` 付き）に合う文字列を全て返す（合わなければ空） */
export function matches(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}
