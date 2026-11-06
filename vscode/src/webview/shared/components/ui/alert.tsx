import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

/** Alert の見た目 */
const alertVariants = cva(
  "grid w-full grid-cols-alert items-start gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        warning: "border-warning-border bg-warning text-warning-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** shadcn/ui の Alert。`warning` の variant を持つ。アイコンは 1 列目、他の子は 2 列目に置く */
export const Alert = ({
  className,
  variant,
  role = "alert",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) => (
  <div
    data-slot="alert"
    role={role}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);

/** Alert の 1 列目のアイコンの大きさと位置（タイトルの行の高さに揃える） */
export const ALERT_ICON_CLASS = "mt-1.5 size-4 text-current";

/** Alert のタイトル。`asChild` で `h1`・`h2` を受ける */
export const AlertTitle = ({
  className,
  asChild = false,
  ...props
}: ComponentProps<"div"> & { asChild?: boolean }) => {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      data-slot="alert-title"
      className={cn("col-start-2 m-0 font-bold", className)}
      {...props}
    />
  );
};

/** Alert の説明 */
export const AlertDescription = ({
  className,
  ...props
}: ComponentProps<"p">) => (
  <p
    data-slot="alert-description"
    className={cn("col-start-2 m-0", className)}
    {...props}
  />
);
