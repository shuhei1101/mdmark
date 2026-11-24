import { renderMediaError } from "../../../shared/lib/media-error.ts";

/** スキームを持つ URL か */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** パスを持つ要素と、パスを持つ属性 */
const ASSET_SELECTOR =
  "img[src], video[src], video[poster], audio[src], button.mdmark-media-open[data-media-src]";

/** 記載したパスを記録する属性 */
const SOURCE_ATTRIBUTE = "data-mdmark-src";

/** スキームも `/` も `#` も持たない相対パスか */
const isRelativePath = (value: string): boolean => {
  return (
    value !== "" &&
    !SCHEME_PATTERN.test(value) &&
    !value.startsWith("/") &&
    !value.startsWith("#")
  );
};

/** 要素がパスを持つ属性の名前を返却する */
const pathAttributesOf = (element: Element): string[] => {
  if (element.localName === "button") {
    return ["data-media-src", "data-media-poster"];
  }
  return element.localName === "video" ? ["src", "poster"] : ["src"];
};

/** 描いた文書の `img`・`video`・`audio` と再生のボタンの相対パスを、重ねずに記載した順で返却する */
export const collectAssetPaths = (root: HTMLElement): string[] => {
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
};

/** 記載したパスが `urls` にある要素の `src`・`poster`・`data-media-src`・`data-media-poster` を Webview の URL に替える。`null` のパスは替えない。動画・音声と再生のボタンは替える前のパスを `data-mdmark-src` に記録する */
export const applyAssetUrls = (
  root: HTMLElement,
  urls: Record<string, string | null>,
): void => {
  for (const element of root.querySelectorAll(ASSET_SELECTOR)) {
    for (const name of pathAttributesOf(element)) {
      const value = element.getAttribute(name) ?? "";
      const url = Object.hasOwn(urls, value) ? urls[value] : null;
      if (url === null || url === undefined) {
        continue;
      }
      if (
        (name === "src" && element.localName !== "img") ||
        name === "data-media-src"
      ) {
        element.setAttribute(SOURCE_ATTRIBUTE, value);
      }
      element.setAttribute(name, url);
    }
  }
};

/** パスのクエリとフラグメントを除いた拡張子 */
const formatOf = (path: string): string => {
  const bare = path.split(/[?#]/, 1)[0] ?? "";
  const dot = bare.lastIndexOf(".");
  return dot < 0 ? "" : bare.slice(dot + 1).toLowerCase();
};

/** 記載したパス。`data-mdmark-src` を持たない再生のダイアログの中の要素は、同じ URL を持つ再生のボタンの `data-mdmark-src` から引く */
const sourcePathOf = (root: HTMLElement, media: HTMLMediaElement): string => {
  const own = media.getAttribute(SOURCE_ATTRIBUTE);
  if (own !== null) {
    return own;
  }
  const src = media.getAttribute("src") ?? "";
  const opener = [
    ...root.querySelectorAll<HTMLButtonElement>(
      `button.mdmark-media-open[${SOURCE_ATTRIBUTE}]`,
    ),
  ].find((button) => button.dataset.mediaSrc === src);
  return opener?.getAttribute(SOURCE_ATTRIBUTE) ?? src;
};

/** 描いた文書の動画・音声が再生できないとき、その要素（`figure.mdmark-media` の中なら `figure`）を通知ブロックに替える。受け取りを解除する関数を返却する */
export const attachMediaErrors = (root: HTMLElement): (() => void) => {
  const onError = (event: Event): void => {
    const media = event.target;
    if (
      !(media instanceof HTMLVideoElement || media instanceof HTMLAudioElement)
    ) {
      return;
    }
    const path = sourcePathOf(root, media);
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
};
