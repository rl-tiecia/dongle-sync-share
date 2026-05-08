import * as React from "react";
import { cn } from "@/lib/utils";

export const GlassPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }>(
  ({ className, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass-card",
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated",
        className,
      )}
      {...props}
    />
  ),
);
GlassPanel.displayName = "GlassPanel";
