import indexCss from "../../../src/index.css?inline";
import { renderDoc } from "./render.ts";

const roots: HTMLElement[] = [];
let styleElement: HTMLStyleElement | undefined;

/** 描いた文書の CSS をページに足す（表のはみ出しなど、見た目で決まる動きを確かめる） */
export function addStyles(): void {
  if (styleElement === undefined) {
    styleElement = document.createElement("style");
    styleElement.textContent = indexCss;
    document.head.append(styleElement);
  }
}

/** Markdown を描いた HTML を持つ、描く先の要素をページに置く */
export function createRoot(markdown: string): {
  root: HTMLElement;
  features: Record<string, boolean>;
} {
  const { html, features } = renderDoc(markdown);
  const root = document.createElement("div");
  root.className = "mdmark";
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return { root, features };
}

/** HTML をそのまま入れた、描く先の要素をページに置く */
export function createRootFromHtml(html: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "mdmark";
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return root;
}

/** 置いた要素を全て取り除く */
export function removeRoots(): void {
  for (const root of roots.splice(0)) {
    root.remove();
  }
}
