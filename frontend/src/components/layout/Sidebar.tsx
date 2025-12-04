import { Bus, MapIcon, MapPin, Car, UserCircle, BarChart3, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { createContext, useContext, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";

const menuItems = [
  { icon: Bus, label: "Bus Dashboard", path: "/dashboard/buses" },
  { icon: MapIcon, label: "Manage Routes", path: "/dashboard/routes" },
  { icon: MapPin, label: "Stops & Paths", path: "/dashboard/stops-paths" },
  { icon: Car, label: "Vehicles", path: "/dashboard/vehicles" },
  { icon: UserCircle, label: "Drivers", path: "/dashboard/drivers" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

// Create context for sidebar state
const SidebarContext = createContext<{ isCollapsed: boolean }>({ isCollapsed: false });

export const useSidebarCollapse = () => useContext(SidebarContext);

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r border-border transition-smooth z-40 shadow-xl",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!isCollapsed ? (
          <Logo size="sm" showText={true} />
        ) : (
          <Logo size="sm" />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-muted rounded-md transition-fast"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation Menu */}
      <TooltipProvider delayDuration={300}>
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const navItem = (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground",
                  "hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 hover:text-foreground hover:shadow-sm hover:scale-105",
                  isCollapsed && "justify-center"
                )}
                activeClassName="bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-semibold border-l-4 border-primary shadow-sm scale-105"
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
              </NavLink>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    {navItem}
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return navItem;
          })}
        </nav>
      </TooltipProvider>

      {/* User Profile Section */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground font-semibold shadow-md">
              SL
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Sai Lokesh</p>
              <p className="text-xs text-muted-foreground truncate">john@company.com</p>
            </div>
          </div>
        </div>
      )}
      </aside>
    </SidebarContext.Provider>
  );
}
