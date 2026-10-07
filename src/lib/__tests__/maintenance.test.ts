import { describe, expect, it } from "vitest";
import {
  forecastOil,
  validateService,
  decodeVinResult,
  buildOilTimeline,
  mileageRate,
} from "../maintenance";
import type { Vehicle } from "@/types";
const truck = (extra: Partial<Vehicle> = {}): Vehicle => ({
  id: "v1",
  name: "Maverick",
  vehicleNumber: "Mav 1",
  licensePlate: "",
  qrCodeToken: "v1",
  status: "active",
  odometer: 12000,
  maintenance: {
    oilIntervalMiles: 5000,
    oilIntervalMonths: 6,
    scheduleConfirmed: true,
    scheduleSource: "Manager verified manual",
  },
  serviceHistory: [
    {
      id: "s1",
      kind: "oil",
      title: "Oil and filter",
      date: "2026-01-01",
      odometer: 10000,
      recordedBy: "Manager",
    },
  ],
  ...extra,
});
const now = new Date("2026-05-01T12:00:00Z");
describe("maintenance planning", () => {
  it("uses the earlier time deadline when mileage service is farther away", () => {
    const result = forecastOil(
      truck(),
      [
        { date: "2026-04-01", odometer: 11000 },
        { date: "2026-05-01", odometer: 12000 },
      ],
      now,
    );
    expect(result.dueDate).toBe("2026-07-01");
    expect(result.dueOdometer).toBe(15000);
    expect(result.status).toBe("scheduled");
  });
  it("flags reached mileage thresholds as overdue even if the time deadline is later", () => {
    expect(forecastOil(truck({ odometer: 15000 }), [], now).status).toBe(
      "overdue",
    );
  });
  it("does not invent a last oil change or use an unconfirmed schedule", () => {
    expect(forecastOil(truck({ serviceHistory: [] }), [], now).status).toBe(
      "needs_setup",
    );
    expect(
      forecastOil(truck({ maintenance: { oilIntervalMiles: 5000 } }), [], now)
        .status,
    ).toBe("needs_setup");
  });
  it("does not extrapolate decreasing or stale odometers", () => {
    expect(
      mileageRate(
        [
          { date: "2026-04-01", odometer: 12000 },
          { date: "2026-05-01", odometer: 11000 },
        ],
        now,
      ),
    ).toBeNull();
    expect(
      mileageRate(
        [
          { date: "2026-01-01", odometer: 10000 },
          { date: "2026-02-01", odometer: 11000 },
        ],
        now,
      ),
    ).toBeNull();
  });
  it("rejects service mileage beyond the current reading and invalid calendar dates", () => {
    expect(
      validateService(
        { date: "2026-04-01", odometer: 13000, title: "Oil" },
        12000,
        now,
      ),
    ).toContain("current");
    expect(
      validateService(
        { date: "2026-02-30", odometer: 10000, title: "Oil" },
        12000,
        now,
      ),
    ).toContain("date");
    expect(
      validateService(
        { date: "2026-04-01", odometer: 10000, title: "Oil" },
        12000,
        now,
      ),
    ).toBeNull();
  });
  it("keeps future recurring appointments explicitly projected and clamps month-end dates", () => {
    const v = truck({
      serviceHistory: [
        {
          id: "s",
          kind: "oil",
          title: "Oil",
          date: "2026-01-31",
          odometer: 10000,
          recordedBy: "Manager",
        },
      ],
      maintenance: {
        oilIntervalMiles: 5000,
        oilIntervalMonths: 1,
        scheduleConfirmed: true,
        scheduleSource: "test",
      },
    });
    const events = buildOilTimeline(v, [], new Date("2026-02-01T12:00:00Z"));
    expect(events[0].date).toBe("2026-02-28");
    expect(events.every((e) => e.projected)).toBe(true);
    expect(events.length).toBeGreaterThan(1);
  });
  it("rejects partial VIN decode errors instead of accepting guessed identity", () => {
    expect(() =>
      decodeVinResult({
        Results: [{ ErrorCode: "1", Make: "FORD", ModelYear: "2023" }],
      }),
    ).toThrow();
    expect(
      decodeVinResult({
        Results: [
          {
            ErrorCode: "0",
            Make: "FORD",
            Model: "Maverick",
            ModelYear: "2023",
            DriveType: "AWD",
          },
        ],
      }),
    ).toMatchObject({
      make: "FORD",
      model: "Maverick",
      year: 2023,
      drivetrain: "AWD",
    });
  });
});
