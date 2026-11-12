import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[4px] bg-surface-2 border border-line", className)}
      {...props}
    />
  );
}

export { Skeleton };
