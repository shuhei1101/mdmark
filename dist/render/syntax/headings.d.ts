import type { StateCore } from "markdown-it";
/** 見出しの文字から GitHub と同じ規則で ID を作り、使用済みの ID には `-1`・`-2` を付ける */
export declare function slugify(text: string, used: Map<string, number>): string;
/** 全ての見出しに ID を付け、`anchors` がオンなら見出しの文字の後にアンカーを足し、見出しを `env.headings` に控える */
export declare function assignHeadingIds(state: StateCore): void;
