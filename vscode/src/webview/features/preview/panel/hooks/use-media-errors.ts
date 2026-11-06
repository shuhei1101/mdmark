import { useEffect } from "react";
import { attachMediaErrors } from "../assets.ts";

/** 描く先を包む要素に、再生できない動画・音声の受け取りを付け、後始末で外す */
export const useMediaErrors = (root: HTMLElement): void => {
  useEffect(() => attachMediaErrors(root), [root]);
};
