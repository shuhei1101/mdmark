/** 許可していないものを落とした HTML を返す。`nonce` と同じ印を持つ要素は mdmark が記法から出したものとして、記法の class・`data-*`・`id` などを残す */
export declare function sanitize(html: string, nonce: string): string;
