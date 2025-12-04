import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  color?: "primary" | "success" | "warning" | "destructive" | "accent";
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = true,
  color = "primary",
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Extract height class from className if provided
  const heightMatch = className?.match(/h-[\d.]+/);
  const heightClass = heightMatch ? heightMatch[0] : "h-2.5";
  const otherClasses = className?.replace(/h-[\d.]+/, "").trim() || "";

  // Color mapping using CSS variables
  const colorStyles = {
    primary: { backgroundColor: "hsl(var(--primary))" },
    success: { backgroundColor: "hsl(var(--success))" },
    warning: { backgroundColor: "hsl(var(--warning))" },
    destructive: { backgroundColor: "hsl(var(--destructive))" },
    accent: { backgroundColor: "hsl(var(--accent))" },
  };

  return (
    <div className={cn("w-full", otherClasses)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">
            {Math.round(percentage)}%
          </span>
          <span className="text-xs text-muted-foreground">
            {value} / {max}
          </span>
        </div>
      )}
      <div 
        className={cn(
          "w-full rounded-full overflow-hidden relative",
          heightClass
        )}
        style={{ backgroundColor: "hsl(var(--muted))" }}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            animated && "animate-shimmer"
          )}
          style={{ 
            width: `${percentage}%`,
            ...colorStyles[color],
            minWidth: percentage > 0 ? "4px" : "0"
          }}
        />
      </div>
    </div>
  );
}
