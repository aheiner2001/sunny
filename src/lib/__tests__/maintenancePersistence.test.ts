import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  arrayUnion: vi.fn((item) => ({ append: item })),
}));
vi.mock("../firebase", () => ({
  db: {},
  ensureAuth: vi.fn().mockResolvedValue(null),
}));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: mocks.updateDoc,
  arrayUnion: mocks.arrayUnion,
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));
import { dbService } from "../db";
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("sunny_seeded_v2", "true");
  localStorage.setItem(
    "sunny_vehicles",
    JSON.stringify([
      {
        id: "v",
        vehicleNumber: "Mav 1",
        status: "in_use",
        currentUserId: "driver",
        odometer: 12000,
      },
    ]),
  );
  mocks.updateDoc.mockResolvedValue(undefined);
});
it("appends oil history while preserving assignment and mileage", async () => {
  const record = {
    id: "s",
    kind: "oil" as const,
    title: "Oil",
    date: "2026-01-01",
    odometer: 10000,
    recordedBy: "Manager",
  };
  await (dbService as any).recordVehicleService("v", record);
  expect(dbService.getVehicle("v")).toMatchObject({
    currentUserId: "driver",
    odometer: 12000,
    serviceHistory: [record],
  });
  expect(mocks.updateDoc).toHaveBeenCalledWith(
    { path: "vehicles", id: "v" },
    { serviceHistory: { append: record } },
  );
});
it("does not claim saved service history when Firestore rejects the write", async () => {
  mocks.updateDoc.mockRejectedValueOnce(new Error("permission denied"));
  await expect(
    (dbService as any).recordVehicleService("v", {
      id: "s",
      kind: "oil",
      title: "Oil",
      date: "2026-01-01",
      odometer: 10000,
      recordedBy: "Manager",
    }),
  ).rejects.toThrow("permission denied");
  expect(dbService.getVehicle("v")?.serviceHistory).toBeUndefined();
});
it("rejects decreasing mileage without changing vehicle state", async () => {
  await expect(
    (dbService as any).recordMaintenanceReading("v", {
      date: "2026-10-07",
      odometer: 11000,
    }),
  ).rejects.toThrow("previous");
  expect(dbService.getVehicle("v")?.odometer).toBe(12000);
});
