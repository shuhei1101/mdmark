import { type PageSettings } from "../config.ts";
import type { MdmarkMarkArgs } from "../extensions.ts";
/** page の印の引数から、書けるキーと値だけをページの設定にし、書けるキーの知らない値と、知らないキー・`=` を持たない引数を、それぞれ書いた順に並べて返す */
export declare const readPageSettings: (options: MdmarkMarkArgs) => {
    settings: PageSettings;
    unknown: string[];
    skipped: string[];
};
