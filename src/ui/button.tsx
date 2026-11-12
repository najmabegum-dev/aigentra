import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[4px] text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:pointer-events-none disabled:opacity-40 cursor-pointer border",
  {
    variants: {
      variant: {
        default:
          "bg-signal text-[#0B0C0E] border-transparent hover:opacity-90 active:opacity-100",
        destructive:
          "bg-deny text-[#0B0C0E] border-transparent hover:opacity-90",
        outline:
          "border-line bg-surface text-text hover:bg-surface-2 hover:border-line-strong",
        secondary:
          "border-line bg-surface-2 text-text hover:border-line-strong hover:bg-surface",
        ghost:
          "border-transparent text-text hover:bg-surface-2 hover:text-text",
        link:
          "border-transparent text-signal underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-8 px-3.5 py-1.5",
        sm: "h-7 px-2.5 text-[11px]",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
