import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ role: "employee", hydrated: true }));
const db = vi.hoisted(() => ({
  getVehicles: vi.fn(() => []),
  getEquipment: vi.fn(() => []),
  getInspections: vi.fn(() => []),
  saveMaintenanceProfile: vi.fn(),
  recordVehicleService: vi.fn(),
  recordMaintenanceReading: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    role: state.role,
    hydrated: state.hydrated,
    isTrueManager: state.role === "manager",
    user: { name: "Manager" },
  }),
}));
vi.mock("@/lib/db", () => ({ dbService: db }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>Chart</div> }));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
import AnalyticsPage from "@/app/settings/analytics/page";
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  state.role = "employee";
  vi.clearAllMocks();
  document.body.innerHTML = "";
});
async function render() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => root!.render(<AnalyticsPage />));
  return el;
}
it("blocks direct employee access without mounting or reading analytics data", async () => {
  const el = await render();
  expect(el.textContent).toContain(
    "Maintenance analytics is available to manager accounts.",
  );
  expect(db.getVehicles).not.toHaveBeenCalled();
});
it("keeps sample service edits isolated from database writes", async () => {
  state.role = "manager";
  const el = await render();
  const click = async (text: string) => {
    const button = Array.from(el.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(text),
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  await click("Try sample data");
  expect(el.textContent).toContain("Mav 1");
  await click("Log service");
  await click("Save sample change");
  expect(db.recordVehicleService).not.toHaveBeenCalled();
  expect(db.saveMaintenanceProfile).not.toHaveBeenCalled();
  expect(el.textContent).toContain("Sample change saved for this session.");
});
