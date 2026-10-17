import { createInterface, type Interface } from "node:readline";

/** 問いの文を出し、答えの 1 行を返す。答える前に入力が終わったら `undefined` を返す */
export type Prompter = (question: string) => Promise<string | undefined>;

/** 問いの文を書き出し、入力の次の 1 行を答えにする `Prompter` を返す */
export function createLinePrompter(options: {
  input: NodeJS.ReadableStream;
  write: (line: string) => void;
}): Prompter {
  // 問いが無いまま終わるときは入力を読まないよう、最初の問いで入力を読み始める
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
    // 答えを受けたら入力を止め、プロセスが終われるようにする
    if (!closed) {
      reader.pause();
    }
    return next.done ? undefined : next.value.trim();
  };
}
