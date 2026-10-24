/** 図の部品が定義から出した要素だけが持てる要素。文書に書いたものは取り除く */
export declare const DIAGRAM_ONLY_TAGS: Set<string>;
/** 埋め込んだ HTML の `style` に残す宣言: 名前と、値の許可の正規表現。値に `url(`・`expression(`・単位 `vw`・`vh` を含むものは、ここに当たっても落とす */
export declare const EMBED_STYLES: ReadonlyArray<{
    name: RegExp;
    value: RegExp;
}>;
/** 埋め込んだ HTML の要素の `style` から、`EMBED_STYLES` の宣言だけを残して `名前:値` を `;` でつないだ値にする。残る宣言が無ければ空の文字。postcss を使わない */
export declare function filterEmbeddedStyle(style: string): string;
/** 埋め込んだ HTML の中の、図の部品の置き場所を預ける要素と、その印の属性。`sanitizeEmbedded` が残し、呼ぶ側が図の部品の HTML に戻す */
export declare const EMBED_PART_TAG = "mdmark-part";
export declare const EMBED_PART_ATTRIBUTE = "data-part";
/** 文字を `onText` に渡さない要素（用語の下線を引かない場所） */
export declare const TEXT_FILTER_SKIP_TAGS: Set<string>;
/** 許可していない要素のうち、中身の文字ごと落とす要素（sanitize-html の既定と同じ） */
export declare const EMBEDDED_NON_TEXT_TAGS: string[];
/** 埋め込んだ HTML の中身を落とす: `script` 要素・`on` で始まる属性・`javascript:` の URL・許していない `style` の宣言を落とし、`button` は `type="button"` で残す。`onText` は本文の文字（エスケープ済み。`a`・`code`・`pre`・`button`・見出しの中を除く）を受け、置き換える HTML を返す */
export declare function sanitizeEmbedded(html: string, onText: (text: string) => string): string;
/** 許可していないものを落とした HTML を返す。`nonce` と同じ印を持つ要素は mdmark が記法から出したものとして、記法の class・`data-*`・`id` などを残す */
export declare function sanitize(html: string, nonce: string): string;
