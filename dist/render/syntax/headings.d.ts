import type { StateCore } from "markdown-it";
/** GitHub と同じ規則で文字を ID の元にする。作れないときは空文字 */
export declare function slugBase(text: string): string;
/** 見出しの文字から GitHub と同じ規則で ID を作り、使用済みの ID には `-1`・`-2` を付ける */
export declare function slugify(text: string, used: Map<string, number>): string;
/** 脚注の定義の外の全ての見出しに ID を付け、`anchors` がオンなら見出しの文字の後にアンカーを追加し、見出しを `env.headings` に記録する */
export declare function assignHeadingIds(state: StateCore): void;
