import type { PageSettings } from "../config.ts";
import type { MarkOptions } from "./mark-options.ts";
/** page のマーカーの JSON のオブジェクト（マーカーの JSON Schema に通した後のもの）を記載した順に重ね、ページの設定にする。同じキーは後に記載した値を使用する */
export declare const readPageSettings: (options: MarkOptions[]) => PageSettings;
