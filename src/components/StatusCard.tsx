import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "info";
  subtitle?: string;
}

const accent = {
  default: { ring: "from-primary/30 to-primary/5", icon: "text-primary bg-primary/10", glow: "shadow-glow" },
  success: { ring: "from-success/30 to-success/5", icon: "text-success bg-success/10", glow: "" },
  warning: { ring: "from-warning/30 to-warning/5", icon: "text-warning bg-warning/10", glow: "" },
  info: { ring: "from-info/30 to-info/5", icon: "text-info bg-info/10", glow: "" },
};

export function StatusCard({ title, value, icon: Icon, variant = "default", subtitle }: StatusCardProps) {
  const a = accent[variant];
  return (
    <div className="group relative animate-scale-in">
      <div
        className={cn(
          "absolute -inset-px rounded-[var(--radius)] bg-gradient-to-br opacity-60 blur-sm transition-opacity duration-300 group-hover:opacity-100",
          a.ring,
        )}
      />
      <div className="glass-card-hover relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold leading-tight truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", a.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
