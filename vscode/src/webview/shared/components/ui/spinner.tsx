import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

/** shadcn/ui の Spinner。動きを減らす設定のときは 6 秒で 1 回転にゆっくり回す */
export const Spinner = ({
  className,
  ...props
}: ComponentProps<typeof LoaderCircle>) => (
  <LoaderCircle
    role="img"
    aria-label="読み込み中"
    className={cn(
      "size-4 motion-safe:animate-spin motion-reduce:animate-spin-slow",
      className,
    )}
    {...props}
  />
);
