/** 節（見出しとその中身）の HTML を返す。`toggle` が `false` のときは開閉のボタンを置かず中身を隠さない */
export declare function renderSection(options: {
    /** 見出しの階層 */
    level: 1 | 2 | 3 | 4;
    /** 見出しの ID。中身の `id` を `section-{id}` にする */
    id: string;
    /** 見出しの中身の HTML */
    title: string;
    /** 中身が開いているか（既定 `true`） */
    open?: boolean;
    /** 開閉のボタンを付けるか（既定 `true`） */
    toggle?: boolean;
    /** 見出しに ID へのアンカーを付けるか（既定 `true`） */
    anchor?: boolean;
    /** 中身の HTML（`SLOT_MARKER` を渡せる） */
    body: string;
}): string;
