import { LayoutDashboard, Bell, Camera, BarChart3, Settings, Shield, Monitor, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationsContext";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Live Monitoring", url: "/monitoring", icon: Monitor },
  { title: "Alerts", url: "/alerts", icon: Bell, showAlertBadge: true },
  { title: "Activity Logs", url: "/logs", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Cameras", url: "/cameras", icon: Camera },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center glow-primary shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground tracking-wide">SENTINEL</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest">AI SURVEILLANCE</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              activeClassName=""
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "drop-shadow-[0_0_6px_hsl(192_95%_55%/0.6)]" : ""}`} />
              {!collapsed && <span className="font-medium truncate">{item.title}</span>}
              {!collapsed && item.showAlertBadge && unreadCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </motion.aside>
  );
}
