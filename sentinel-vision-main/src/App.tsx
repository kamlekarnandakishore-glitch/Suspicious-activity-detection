import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LiveMonitoring from "./pages/LiveMonitoring";
import Alerts from "./pages/Alerts";
import ActivityLogs from "./pages/ActivityLogs";
import Analytics from "./pages/Analytics";
import CameraManagement from "./pages/CameraManagement";
import SettingsPage from "./pages/SettingsPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <NotificationsProvider>
        <RealtimeNotifications />
        {children}
      </NotificationsProvider>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors closeButton expand />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedLayout>
                    <Index />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/monitoring"
                element={
                  <ProtectedLayout>
                    <LiveMonitoring />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedLayout>
                    <Alerts />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedLayout>
                    <ActivityLogs />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedLayout>
                    <Analytics />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/cameras"
                element={
                  <ProtectedLayout>
                    <CameraManagement />
                  </ProtectedLayout>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedLayout>
                    <SettingsPage />
                  </ProtectedLayout>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
