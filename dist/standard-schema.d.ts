/** Standard Schema の仕様の型（https://standardschema.dev/）を書き写したもの。mdmark は検査ライブラリに依存しない */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    /** 検査ライブラリが持つ仕様の入口 */
    readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
export declare namespace StandardSchemaV1 {
    /** `~standard` の中身 */
    interface Props<Input = unknown, Output = Input> {
        /** 仕様の版 */
        readonly version: 1;
        /** 検査ライブラリの名前 */
        readonly vendor: string;
        /** 値を検査する。同期でも非同期でもよい */
        readonly validate: (value: unknown, options?: Options | undefined) => Result<Output> | Promise<Result<Output>>;
        /** 型の推論だけに使う */
        readonly types?: Types<Input, Output> | undefined;
    }
    /** 検査の結果 */
    type Result<Output> = SuccessResult<Output> | FailureResult;
    /** 合ったとき */
    interface SuccessResult<Output> {
        readonly value: Output;
        readonly issues?: undefined;
    }
    /** 検査ライブラリごとの追加の設定 */
    interface Options {
        readonly libraryOptions?: Record<string, unknown> | undefined;
    }
    /** 合わなかったとき */
    interface FailureResult {
        readonly issues: ReadonlyArray<Issue>;
    }
    /** 合わなかった理由 1 つ */
    interface Issue {
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }
    /** `path` の要素が持つキー */
    interface PathSegment {
        readonly key: PropertyKey;
    }
    /** 型の推論に使う入力と出力の型 */
    interface Types<Input = unknown, Output = Input> {
        readonly input: Input;
        readonly output: Output;
    }
}
