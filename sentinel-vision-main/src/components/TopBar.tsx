import { Bell, LogOut, Settings, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBackendHealth } from "@/hooks/use-backend";
import type { Severity } from "@/lib/alerts";

interface TopBarProps {
  onToggleSidebar?: () => void;
}

const severityDot: Record<Severity, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-primary",
};

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const { user, logout } = useAuth();
  const { data: backendUp } = useBackendHealth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openNotifications = () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) markAllRead();
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-6 relative z-40">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors lg:hidden"
        >
          <Menu className="w-4 h-4 text-muted-foreground" />
        </button>
        <span
          className={`text-xs font-mono px-2 py-1 rounded-full ${
            backendUp
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {backendUp ? "● Backend online" : "○ Backend offline"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
            {user.email}
          </span>
        )}
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={openNotifications}
            className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                key={unreadCount}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-12 w-80 glass-card border border-border rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Alerts</span>
                  <span className="text-[10px] font-mono text-destructive flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    LIVE
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground text-center font-mono">
                      No alerts yet
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markRead(n.id);
                          setShowNotifications(false);
                          navigate("/alerts");
                        }}
                        className={`w-full text-left p-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0 ${
                          !n.read ? "bg-destructive/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${severityDot[n.severity]}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{n.type}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {n.camera} • {n.time}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate("/alerts");
                  }}
                  className="w-full p-2 text-[10px] font-mono text-primary hover:bg-secondary/50 transition-colors"
                >
                  VIEW ALL →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
