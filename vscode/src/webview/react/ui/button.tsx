import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

// shadcn/ui の Button（PoC で使う variant だけ）
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-accent",
      },
      size: { default: "h-9 px-4 py-2" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const Button = ({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => (
  <button
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />
);
