import { createInterface, type Interface } from "node:readline";

/** 質問の文を出し、回答の 1 行を返却する。回答する前に入力が終わったら `undefined` を返却する */
export type Prompter = (question: string) => Promise<string | undefined>;

/** 質問の文を書き出し、入力の次の 1 行を回答にする `Prompter` を返却する */
export function createLinePrompter(options: {
  input: NodeJS.ReadableStream;
  write: (line: string) => void;
}): Prompter {
  // 質問が無いまま終わるときは入力を読み込まないよう、最初の質問で入力を読み込み始める
  let reader: Interface | undefined;
  let lines: AsyncIterator<string> | undefined;
  let closed = false;
  return async (question) => {
    options.write(question);
    if (!reader || !lines) {
      reader = createInterface({ input: options.input });
      reader.on("close", () => {
        closed = true;
      });
      lines = reader[Symbol.asyncIterator]();
    }
    if (!closed) {
      reader.resume();
    }
    const next = await lines.next();
    // 回答を受けたら入力を止め、プロセスが終われるようにする
    if (!closed) {
      reader.pause();
    }
    return next.done ? undefined : next.value.trim();
  };
}
