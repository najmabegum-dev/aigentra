import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-[11px] font-mono font-medium transition-colors border",
  {
    variants: {
      variant: {
        default:
          "rounded-[4px] border-line bg-surface-2 text-text",
        secondary:
          "rounded-[4px] border-line bg-surface-2 text-text-dim",
        destructive:
          "rounded-[4px] border-deny/40 bg-deny/10 text-deny",
        outline:
          "rounded-[4px] border-line bg-transparent text-text",
        // Real status badges — only these are allowed as pills
        allow:
          "rounded-full border-[var(--color-allow)]/30 bg-[var(--color-allow)]/10 text-[var(--color-allow)] px-2.5 py-0.5 font-bold",
        approval:
          "rounded-full border-[var(--color-approval)]/30 bg-[var(--color-approval)]/10 text-[var(--color-approval)] px-2.5 py-0.5 font-bold",
        deny:
          "rounded-full border-[var(--color-deny)]/30 bg-[var(--color-deny)]/10 text-[var(--color-deny)] px-2.5 py-0.5 font-bold",
        signal:
          "rounded-full border-signal/30 bg-signal/10 text-signal px-2.5 py-0.5 font-bold",
        info:
          "rounded-[4px] border-line bg-surface-2 text-text px-2 py-0.5",
        sandbox:
          "rounded-full border-approval/30 bg-approval/10 text-approval px-2.5 py-0.5 font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
