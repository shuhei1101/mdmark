/** 階層の表の 1 行の計画 */
export type TreeRowPlan = {
    /** 全体のパス（`aliases[].id` の構造） */
    path: string;
    /** 親の全体のパス。最上位は空 */
    parent: string;
    /** 深さ（0 から） */
    depth: number;
    /** 末尾の名前（`aliases[]` の構造を含む） */
    name: string;
    /** 表に無い親を補った行か */
    virtual: boolean;
    /** 子を持つか */
    hasChildren: boolean;
    /** 元の行の位置（補った行は `undefined`） */
    source: number | undefined;
};
/** `aliases[].metadata.type` の構造のパスを `.` で分け、名前の並びと根からの親の全体のパスの並びを返却する */
export declare function splitKeyPath(path: string): {
    names: string[];
    parents: string[];
};
/** 表の行のキーの並びから、表に無い親を子の最初の行の前に補った行の並びを返却する */
export declare function planTreeRows(keys: string[]): TreeRowPlan[];
/** YAML の行ごとに、インデントと `- ` から求めたキーのパスを返却する（キーを持たない行は `undefined`） */
export declare function yamlLinePaths(lines: string[]): Array<string | undefined>;
/** 末尾の名前に単語を含む行とその祖先の行のパスの集まりと、該当した行のうち補った行でないものの数を返却する */
export declare function filterTreeRows(options: {
    /** `planTreeRows` の行 */
    rows: TreeRowPlan[];
    /** 絞り込みの単語 */
    word: string;
}): {
    keep: Set<string>;
    hits: Set<string>;
    count: number;
};
