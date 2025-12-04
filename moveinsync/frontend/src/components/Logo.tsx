import { Route, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

const iconSizes = {
  sm: "w-3.5 h-3.5",
  md: "w-5 h-5",
  lg: "w-7 h-7",
};

export function Logo({ size = "md", showText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "relative bg-gradient-to-br from-primary via-purple-500 to-accent rounded-xl flex items-center justify-center shadow-lg",
        sizeClasses[size]
      )}>
        {/* Main Route/Navigation icon */}
        <Route className={cn("text-primary-foreground", iconSizes[size])} strokeWidth={2.5} />
        {/* Overlay navigation icon for depth */}
        <Navigation 
          className={cn(
            "absolute text-primary-foreground/30 rotate-45",
            size === "sm" ? "w-2.5 h-2.5" : size === "md" ? "w-3.5 h-3.5" : "w-5 h-5"
          )} 
          strokeWidth={2}
        />
      </div>
      {showText && (
        <span className="font-bold text-lg text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          MoveInSync
        </span>
      )}
    </div>
  );
}




