"use client";
// Adapted from MengXi's MIT-licensed VisActor Next template. See THIRD_PARTY_NOTICES.md.
import { VChart } from "@visactor/react-vchart";
import type { IBarChartSpec } from "@visactor/vchart";
export default function MaintenanceChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  const spec: IBarChartSpec = {
    type: "bar",
    data: [{ id: "maintenance", values: data }],
    xField: "month",
    yField: "count",
    padding: [12, 12, 28, 36],
    color: ["#6470d5"],
    axes: [
      { orient: "left", min: 0, tick: { visible: false } },
      { orient: "bottom", tick: { visible: false } },
    ],
    bar: {
      style: { cornerRadius: [6, 6, 0, 0] },
      state: { hover: { fill: "#353e8f" } },
    },
    tooltip: { trigger: ["click", "hover"] },
    legends: { visible: false },
  };
  return (
    <div
      style={{ height: 260, width: "100%" }}
      role="img"
      aria-label={`Projected oil services by month: ${data.map((d) => `${d.month}: ${d.count}`).join(", ")}`}
    >
      <VChart spec={spec} />
    </div>
  );
}
