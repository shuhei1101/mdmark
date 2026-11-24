/** 配布物が登録するカスタム要素の登録する関数。部品のカスタム要素を追加するときは、この並びに 1 つ加える */
export declare const ELEMENT_DEFINERS: ReadonlyArray<(registry: CustomElementRegistry) => void>;
/** `customElements` があれば、配布物が持つカスタム要素を登録する（Node では何もしない） */
export declare const defineElements: () => void;
