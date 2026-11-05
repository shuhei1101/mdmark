import type { InspectedElement } from "../../messages.ts";

/** PoC で比べる計算済みのスタイル */
export const COMPUTED_PROPERTIES = [
  "font-size",
  "list-style-type",
  "margin-top",
  "margin-bottom",
  "padding-left",
  "display",
  "border-top-width",
  "box-sizing",
] as const;

/** selector に当たる要素ごとの様子と、計算済みのスタイル */
export const inspectElements = async (
  selector: string,
): Promise<InspectedElement[]> =>
  [...document.querySelectorAll(selector)].map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.getAttribute("class") ?? "",
      attributes: {},
      text: element.textContent ?? "",
      top: rect.top,
      height: rect.height,
      computed: Object.fromEntries(
        COMPUTED_PROPERTIES.map((name) => [name, style.getPropertyValue(name)]),
      ),
    };
  });
