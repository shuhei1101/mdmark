/** 要素に効いている `--mdmark-sticky-top` を px に換算して返却する（指定が無いときは 0）。`@property` で登録していない変数は指定した文字列のまま返るため、測るための要素の高さで `calc()`・`rem`・`em`・`vh` を換算する */
export function readStickyTop(el: HTMLElement): number {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position: absolute; visibility: hidden; inline-size: 0; block-size: var(--mdmark-sticky-top, 0px); padding: 0; border: 0; margin: 0";
  el.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(height) ? height : 0;
}
