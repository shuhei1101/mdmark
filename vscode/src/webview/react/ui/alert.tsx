import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

// shadcn/ui の Alert
export const Alert = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert"
    role="status"
    className={cn(
      "relative grid w-full gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground",
      className,
    )}
    {...props}
  />
);

export const AlertTitle = ({ className, ...props }: ComponentProps<"h1">) => (
  <h1
    data-slot="alert-title"
    className={cn("text-base font-medium tracking-tight", className)}
    {...props}
  />
);

export const AlertDescription = ({
  className,
  ...props
}: ComponentProps<"p">) => (
  <p
    data-slot="alert-description"
    className={cn("text-muted-foreground", className)}
    {...props}
  />
);
