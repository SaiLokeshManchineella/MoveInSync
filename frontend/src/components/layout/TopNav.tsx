import { Search, ChevronRight, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebarCollapse } from "./Sidebar";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationCenter } from "@/components/ui/notification-center";

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebarCollapse();
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    return paths.map((path, index) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1).replace("-", " "),
      path: "/" + paths.slice(0, index + 1).join("/"),
      isLast: index === paths.length - 1,
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-card/95 backdrop-blur-sm border-b border-border z-30 px-6 shadow-sm transition-smooth",
      isCollapsed ? "left-16" : "left-60"
    )}>
      <div className="flex items-center justify-between h-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/dashboard/buses")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-fast"
                >
                  <Home className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Go to Dashboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => !crumb.isLast && navigate(crumb.path)}
                className={cn(
                  "transition-fast",
                  crumb.isLast
                    ? "text-foreground font-semibold cursor-default"
                    : "text-muted-foreground hover:text-foreground cursor-pointer hover:underline"
                )}
              >
                {crumb.label}
              </button>
            </div>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Search - Minimal Icon Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-fast">
                  <Search className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Search (⌘K)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Notifications */}
          <NotificationCenter />

          {/* Profile */}
          <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-3 py-1.5 rounded-xl transition-fast">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-md">
              SL
            </div>
            <span className="text-sm font-medium text-foreground">Sai Lokesh</span>
          </div>
        </div>
      </div>
    </header>
  );
}
