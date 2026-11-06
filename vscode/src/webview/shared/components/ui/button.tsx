import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

/** Button の見た目 */
const buttonVariants = cva(
  "inline-flex h-9 min-w-9 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-warning-border bg-background text-foreground hover:bg-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** shadcn/ui の Button。`default`・`outline` の variant を持つ */
export const Button = ({
  className,
  variant,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => (
  <button
    data-slot="button"
    type={type}
    className={cn(buttonVariants({ variant }), className)}
    {...props}
  />
);
