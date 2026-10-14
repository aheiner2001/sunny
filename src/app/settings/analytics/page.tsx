"use client";
import { ManagerOnly } from "@/components/ManagerOnly";
import MaintenanceAnalytics from "@/components/analytics/MaintenanceAnalytics";
export default function AnalyticsPage() {
  return (
    <ManagerOnly
      title="Manager analytics"
      message="Maintenance analytics is available to manager accounts."
    >
      <MaintenanceAnalytics />
    </ManagerOnly>
  );
}
