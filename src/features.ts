/** 設定の `features` に、文書の印の引数（`+名前`・`-名前`）を書いた順に重ねて返す */
export function resolveFeatures(options: {
  /** 既定を当てた設定の `features` */
  defaults: Record<string, boolean>;
  /** 文書の `features` の印の引数を書いた順に並べたもの */
  args: string[];
}): Record<string, boolean> {
  const features = { ...options.defaults };
  for (const arg of options.args) {
    const sign = arg.slice(0, 1);
    const name = arg.slice(1);
    // 既定に無い名前と、符号の無い引数は無視する
    if ((sign === "+" || sign === "-") && Object.hasOwn(features, name)) {
      features[name] = sign === "+";
    }
  }
  return features;
}
