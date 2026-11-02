import { renderMediaError } from "./parts/media-error.ts";

/** スキームを持つ URL か */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** パスを持つ要素と、パスを持つ属性 */
const ASSET_SELECTOR = "img[src], video[src], video[poster], audio[src]";

/** 書いたパスを控える属性 */
const SOURCE_ATTRIBUTE = "data-mdmark-src";

/** スキームも `/` も `#` も持たない相対パスか */
function isRelativePath(value: string): boolean {
  return (
    value !== "" &&
    !SCHEME_PATTERN.test(value) &&
    !value.startsWith("/") &&
    !value.startsWith("#")
  );
}

/** 要素がパスを持つ属性の名前を返す */
function pathAttributesOf(element: Element): string[] {
  return element.localName === "video" ? ["src", "poster"] : ["src"];
}

/** 描いた文書の `img`・`video`・`audio` の相対パスを、重ねずに書いた順で返す */
export function collectAssetPaths(root: HTMLElement): string[] {
  const paths: string[] = [];
  for (const element of root.querySelectorAll(ASSET_SELECTOR)) {
    for (const name of pathAttributesOf(element)) {
      const value = element.getAttribute(name) ?? "";
      if (isRelativePath(value) && !paths.includes(value)) {
        paths.push(value);
      }
    }
  }
  return paths;
}

/** 書いたパスが `urls` にある要素の `src`・`poster` を Webview の URL に替える。`null` のパスは替えない。動画・音声は替える前のパスを `data-mdmark-src` に控える */
export function applyAssetUrls(
  root: HTMLElement,
  urls: Record<string, string | null>,
): void {
  for (const element of root.querySelectorAll(ASSET_SELECTOR)) {
    for (const name of pathAttributesOf(element)) {
      const value = element.getAttribute(name) ?? "";
      const url = Object.hasOwn(urls, value) ? urls[value] : null;
      if (url === null || url === undefined) {
        continue;
      }
      if (name === "src" && element.localName !== "img") {
        element.setAttribute(SOURCE_ATTRIBUTE, value);
      }
      element.setAttribute(name, url);
    }
  }
}

/** パスのクエリとフラグメントを除いた拡張子 */
function formatOf(path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? "";
  const dot = bare.lastIndexOf(".");
  return dot < 0 ? "" : bare.slice(dot + 1).toLowerCase();
}

/** 描いた文書の動画・音声が再生できないとき、その要素（`figure.mdmark-media` の中なら `figure`）を知らせの枠に替える。受け取りを外す関数を返す */
export function attachMediaErrors(root: HTMLElement): () => void {
  const onError = (event: Event): void => {
    const media = event.target;
    if (
      !(media instanceof HTMLVideoElement || media instanceof HTMLAudioElement)
    ) {
      return;
    }
    const path =
      media.getAttribute(SOURCE_ATTRIBUTE) ?? media.getAttribute("src") ?? "";
    const html = renderMediaError({
      kind: media instanceof HTMLVideoElement ? "video" : "audio",
      format: formatOf(path),
      path,
    });
    const target = media.closest("figure.mdmark-media") ?? media;
    const template = document.createElement("template");
    template.innerHTML = html;
    target.replaceWith(template.content);
  };
  // `error` は伝わらないため、キャプチャで受ける
  root.addEventListener("error", onError, true);
  return () => root.removeEventListener("error", onError, true);
}
