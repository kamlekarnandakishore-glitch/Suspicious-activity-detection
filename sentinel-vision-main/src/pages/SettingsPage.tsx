import { DashboardLayout } from "@/components/DashboardLayout";
import { SecurityPersonnelPanel } from "@/components/SecurityPersonnelPanel";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        SETTINGS
      </h2>

      <SecurityPersonnelPanel />
    </DashboardLayout>
  );
}
