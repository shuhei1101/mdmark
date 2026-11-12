/** マーカーの引数の JSON のオブジェクト */
export type MarkOptions = Record<string, unknown>;

/** 読んだマーカーの引数 */
export type MarkArgs =
  | { kind: "none" }
  | { kind: "json"; options: MarkOptions }
  | { kind: "legacy"; text: string }
  | { kind: "invalid"; message: string };

/** 値がオブジェクト（配列を除く）か */
export const isMarkOptions = (value: unknown): value is MarkOptions =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON として読めない最初の位置（0 から）を探す。最後まで読めて足りないときは文字の数 */
const jsonErrorIndex = (text: string): number => {
  let index = 0;
  const fail = (at: number): never => {
    throw at;
  };
  const skip = (): void => {
    while (/\s/.test(text[index] ?? "")) {
      index++;
    }
  };
  const literal = (word: string): void => {
    for (const char of word) {
      if (text[index] !== char) {
        fail(index);
      }
      index++;
    }
  };
  const string = (): void => {
    index++;
    while (index < text.length && text[index] !== '"') {
      index += text[index] === "\\" ? 2 : 1;
    }
    if (index >= text.length) {
      fail(text.length);
    }
    index++;
  };
  const number = (): void => {
    const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(index));
    if (!match) {
      fail(index);
    }
    index += match?.[0].length ?? 0;
  };
  const value = (): void => {
    skip();
    const char = text[index];
    if (char === "{") {
      container("}", true);
    } else if (char === "[") {
      container("]", false);
    } else if (char === '"') {
      string();
    } else if (char === "t") {
      literal("true");
    } else if (char === "f") {
      literal("false");
    } else if (char === "n") {
      literal("null");
    } else {
      number();
    }
  };
  const container = (close: string, keyed: boolean): void => {
    index++;
    skip();
    if (text[index] === close) {
      index++;
      return;
    }
    for (;;) {
      skip();
      if (keyed) {
        if (text[index] !== '"') {
          fail(index);
        }
        string();
        skip();
        if (text[index] !== ":") {
          fail(index);
        }
        index++;
      }
      value();
      skip();
      if (text[index] === ",") {
        index++;
        continue;
      }
      if (text[index] === close) {
        index++;
        return;
      }
      fail(index);
    }
  };
  try {
    value();
    skip();
    return index < text.length ? index : text.length;
  } catch (at) {
    return typeof at === "number" ? Math.min(at, text.length) : text.length;
  }
};

/** 位置の文字が、引用符で囲んでいない値の文字か（`:` の後ろで `"`・数字・`{`・`[`・`t`・`f`・`n`・`-` 以外） */
const isUnquotedValue = (text: string, position: number): boolean => {
  const before = text.slice(0, position).trimEnd();
  const char = text[position] ?? "";
  return (
    (before.endsWith(":") || before.endsWith(",") || before.endsWith("[")) &&
    !/["\d{[\]tfn-]/.test(char)
  );
};

/** 閉じていない文字の値があるか（`"` の数が奇数） */
const hasUnclosedString = (text: string): boolean => {
  let quotes = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
      continue;
    }
    if (text[index] === '"') {
      quotes++;
    }
  }
  return quotes % 2 === 1;
};

/** `JSON.parse` が投げたエラーの位置と引数の文字から、記載の警告の本文を作る */
export const jsonErrorMessage = (options: {
  text: string;
  error: unknown;
}): string => {
  const { text } = options;
  if (hasUnclosedString(text)) {
    return "の引数を JSON として読めません（文字の値が閉じていません）。値に `-->` を記載すると、コメントがそこで閉じます。`>` を `\\u003e` にした `--\\u003e` で記載してください。既定の設定で描いています。";
  }
  const position = jsonErrorIndex(text);
  if (position >= text.length) {
    return "の引数を JSON として読めません（オブジェクトが閉じていません）。`{` と `}` の対応を確かめてください。既定の設定で描いています。";
  }
  const char = text[position] ?? "";
  const where = `${position + 1} 文字目の \`${char}\``;
  if (isUnquotedValue(text, position)) {
    return `の引数を JSON として読めません（${where} で、値の文字を \`"\` で囲んでいません）。値の文字は \`"\` で囲んでください。既定の設定で描いています。`;
  }
  if (char === "}" || char === "]") {
    return `の引数を JSON として読めません（${where} の前に、余分な \`,\` があります）。最後の値の後ろの \`,\` を削除してください。既定の設定で描いています。`;
  }
  return `の引数を JSON として読めません（${where}）。JSON のオブジェクトの記載方法を確かめてください。既定の設定で描いています。`;
};

/** マーカーの `:` の後ろから `-->` の前までの文字を、引数の記載方法ごとに読む */
export const readMarkArgs = (text: string): MarkArgs => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { kind: "none" };
  }
  if (!trimmed.startsWith("{")) {
    return { kind: "legacy", text: trimmed };
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    return {
      kind: "invalid",
      message: jsonErrorMessage({ text: trimmed, error }),
    };
  }
  if (!isMarkOptions(value)) {
    return {
      kind: "invalid",
      message:
        "の引数を JSON のオブジェクトとして読めません。`{` と `}` で囲んだオブジェクトで記載してください。既定の設定で描いています。",
    };
  }
  return { kind: "json", options: value };
};
