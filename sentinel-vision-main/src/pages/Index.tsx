import { DashboardLayout } from "@/components/DashboardLayout";
import { LiveFeedPanel } from "@/components/LiveFeedPanel";
import { AlertPanel } from "@/components/AlertPanel";
import { StatsCards } from "@/components/StatsCards";
import { ActivityChart } from "@/components/ActivityChart";
import { TimelinePanel } from "@/components/TimelinePanel";

const Index = () => {
  return (
    <DashboardLayout>
      <StatsCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LiveFeedPanel />
          <ActivityChart />
        </div>
        <div className="space-y-4">
          <AlertPanel />
          <TimelinePanel />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
