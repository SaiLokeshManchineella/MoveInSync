import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: "success" | "warning" | "error" | "info" | "pending" | "in_progress";
  label: string;
  className?: string;
  showIcon?: boolean;
  animated?: boolean;
}

const statusConfig = {
  success: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
    icon: CheckCircle2,
  },
  warning: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
    icon: AlertCircle,
  },
  error: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/20",
    icon: XCircle,
  },
  info: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
    icon: AlertCircle,
  },
  pending: {
    bg: "bg-muted/10",
    text: "text-muted-foreground",
    border: "border-border",
    icon: Clock,
  },
  in_progress: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    icon: Loader2,
  },
};

export function StatusBadge({ 
  status, 
  label, 
  className,
  showIcon = true,
  animated = false 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border",
        config.bg,
        config.text,
        config.border,
        animated && status === "in_progress" && "animate-pulse",
        className
      )}
    >
      {showIcon && (
        <Icon 
          className={cn(
            "w-3.5 h-3.5",
            status === "in_progress" && "animate-spin"
          )} 
        />
      )}
      {label}
    </span>
  );
}




