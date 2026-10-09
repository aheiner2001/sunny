import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  remote: new Map<string, any>(),
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
  runTransaction: mocks.runTransaction,
  arrayUnion: mocks.arrayUnion,
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));
import { dbService } from "../db";
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
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
  mocks.updateDoc.mockReset().mockResolvedValue(undefined);
  mocks.remote.clear();
  let transactionQueue = Promise.resolve();
  mocks.runTransaction.mockImplementation((_db, callback) => {
    const operation = transactionQueue.then(async () => {
      const writes: Array<{reference: {path:string,id:string}, patch:Record<string,any>}> = [];
      const result = await callback({
        get: async (reference: {path:string,id:string}) => {
          const key = `${reference.path}/${reference.id}`;
          const cached = JSON.parse(localStorage.getItem(reference.path === 'vehicles' ? 'sunny_vehicles' : 'sunny_equipment') || '[]').find((v:any)=>v.id===reference.id);
          const value = mocks.remote.get(key) || cached;
          return {exists:()=>!!value,data:()=>value};
        },
        update: (reference: {path:string,id:string}, patch:Record<string,any>) => writes.push({reference,patch}),
      });
      for (const {reference,patch} of writes) {
        await mocks.updateDoc(reference,patch);
        const key = `${reference.path}/${reference.id}`;
        const cached = JSON.parse(localStorage.getItem(reference.path === 'vehicles' ? 'sunny_vehicles' : 'sunny_equipment') || '[]').find((v:any)=>v.id===reference.id);
        const prior = mocks.remote.get(key) || cached;
        const next = {...prior};
        for (const [field,value] of Object.entries(patch)) next[field] = value && typeof value === 'object' && 'append' in value ? [...(prior[field] || []),value.append] : value;
        mocks.remote.set(key,next);
      }
      return result;
    });
    transactionQueue = operation.catch(()=>undefined);
    return operation;
  });
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
      date: "2026-10-08",
      odometer: 11000,
      confirmed: true,
    }),
  ).rejects.toThrow("previous");
  expect(dbService.getVehicle("v")?.odometer).toBe(12000);
});
afterEach(() => vi.useRealTimers());
it("appends service corrections with an audit trail and rejects replacement in place", async () => {
  const original = { id:"old",kind:"oil" as const,title:"Oil",date:"2026-01-01",odometer:10000,recordedBy:"Manager" };
  const v = dbService.getVehicle("v")!;
  localStorage.setItem("sunny_vehicles",JSON.stringify([{...v,serviceHistory:[original]}]));
  await dbService.correctVehicleService("v","old",{...original,id:"new",date:"2026-02-01"},"Invoice date corrected",{id:"boss",name:"Boss"});
  expect(dbService.getVehicle("v")?.serviceHistory).toEqual([original,{...original,id:"new",date:"2026-02-01",supersedesId:"old",correctionReason:"Invoice date corrected",recordedBy:"boss",recordedAt:"2026-10-08T12:00:00.000Z"}]);
  await expect(dbService.recordVehicleService("v",original)).rejects.toThrow(/already|existing/i);
  await expect(dbService.correctVehicleService("v","new",{...original,id:"third"},"",{id:"boss",name:"Boss"})).rejects.toThrow(/reason/i);
});
it("updates appointment status without dropping other appointments or assignment", async () => {
  const a = {id:"a",ruleId:"oil",title:"Oil",date:"2026-10-12",status:"booked" as const};
  const b = {...a,id:"b",date:"2026-10-14"};
  await dbService.saveMaintenanceAppointment("v",a);
  await dbService.saveMaintenanceAppointment("v",b);
  await dbService.saveMaintenanceAppointment("v",{...a,status:"canceled"});
  expect(dbService.getVehicle("v")).toMatchObject({currentUserId:"driver",maintenanceAppointments:[{...a,status:"canceled"},b]});
  await dbService.saveVehicleImage("v","data:image/jpeg;base64,abc");
  expect(dbService.getVehicle("v")).toMatchObject({currentUserId:"driver",imageUrl:"data:image/jpeg;base64,abc"});
});
it("requires explicit appointment service linkage and persists completion together", async () => {
  const a = {id:"a",ruleId:"oil",title:"Oil",date:"2026-10-08",status:"booked" as const};
  await dbService.saveMaintenanceAppointment("v",a);
  await expect(dbService.saveMaintenanceAppointment("v",{...a,status:"completed"})).rejects.toThrow(/service/i);
  await dbService.recordVehicleService("v",{id:"s",ruleId:"oil",kind:"oil",title:"Oil",date:"2026-10-08",odometer:12000,recordedBy:"Manager",appointmentId:"a"});
  expect(dbService.getVehicle("v")?.maintenanceAppointments).toEqual([{...a,status:"completed",serviceRecordId:"s"}]);
});
it("preserves equipment assignment and lifespan while recording actual hours and service", async () => {
  localStorage.setItem("sunny_equipment",JSON.stringify([{id:"e",name:"Washer",category:"equipment",status:"working",assignments:[{vehicleId:"v",vehicleNumber:"Van 1",quantity:1}],carsUsed:50}]));
  const rule = {id:"pump",title:"Pump",intervalHours:100,source:"Manual",confirmed:true};
  await dbService.saveEquipmentMaintenanceRules("e",[rule]);
  await dbService.recordEquipmentHours("e",{date:"2026-10-08",hours:120.5,recordedBy:"boss"});
  const record = {id:"s",ruleId:"pump",title:"Pump",date:"2026-10-08",hours:120,recordedBy:"boss",recordedAt:"2026-10-08T12:00:00.000Z"};
  await dbService.recordEquipmentService("e",record);
  expect(dbService.getEquipmentItem("e")).toMatchObject({carsUsed:50,operatingHours:120.5,serviceHistory:[record],maintenanceRules:[rule],assignments:[{vehicleId:"v",quantity:1}]});
  await expect(dbService.recordEquipmentHours("e",{date:"2026-10-08",hours:100,recordedBy:"boss"})).rejects.toThrow(/previous/i);
  mocks.updateDoc.mockRejectedValueOnce(new Error("network failure"));
  await expect(dbService.recordEquipmentHours("e",{date:"2026-10-08",hours:130,recordedBy:"boss"})).rejects.toThrow("network failure");
  expect(dbService.getEquipmentItem("e")?.operatingHours).toBe(120.5);
});
it("does not save drafts with invalid confirmed intervals", async () => {
  await expect(dbService.saveMaintenanceProfile("v",{rules:[{id:"x",title:"X",kind:"other",intervalMiles:0,source:"Manual",confirmed:true,recurrence:"after_service"}]})).rejects.toThrow(/interval|positive/i);
  expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it("rejects duplicate rule identifiers before remote mutation", async () => {
 const rule = {id:"x",title:"X",kind:"other" as const,intervalMiles:5000,source:"Manual",confirmed:true,recurrence:"after_service" as const};
 await expect(dbService.saveMaintenanceProfile("v",{rules:[rule,rule]})).rejects.toThrow(/unique/i);
 expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it("rejects unconfirmed measured readings", async () => {
 await expect(dbService.recordMaintenanceReading("v",{date:"2026-10-08",odometer:13000,confirmed:false})).rejects.toThrow(/confirm/i);
 expect(dbService.getVehicle("v")?.odometer).toBe(12000);
});
it("rejects correction lineage changes and malformed audit timestamps", async () => {
 const original = {id:"old",ruleId:"oil",kind:"oil" as const,title:"Oil",date:"2026-01-01",odometer:10000,recordedBy:"boss"};
 localStorage.setItem("sunny_vehicles",JSON.stringify([{...dbService.getVehicle("v"),serviceHistory:[original]}]));
 await expect(dbService.recordVehicleService("v",{...original,id:"new",ruleId:"coolant",supersedesId:"old",correctionReason:"wrong rule",recordedAt:"2026-10-08T12:00:00.000Z"})).rejects.toThrow(/rule/i);
 await expect(dbService.recordVehicleService("v",{...original,id:"new",supersedesId:"old",correctionReason:"date correction",recordedAt:"nonsense"})).rejects.toThrow(/timestamp/i);
 expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it("redirects completed appointment linkage through successive corrections", async () => {
 const a = {id:"a",ruleId:"oil",title:"Oil",date:"2026-10-08",status:"booked" as const};
 await dbService.saveMaintenanceAppointment("v",a);
 const original = {id:"s",ruleId:"oil",kind:"oil" as const,title:"Oil",date:"2026-10-08",odometer:12000,recordedBy:"boss",appointmentId:"a"};
 await dbService.recordVehicleService("v",original);
 await dbService.correctVehicleService("v","s",{...original,id:"s2",odometer:11900},"Invoice mileage",{id:"boss",name:"Boss"});
 await dbService.correctVehicleService("v","s2",{...original,id:"s3",odometer:11800},"Invoice rechecked",{id:"boss",name:"Boss"});
 expect(dbService.getVehicle("v")?.maintenanceAppointments).toEqual([{...a,status:"completed",serviceRecordId:"s3"}]);
 expect(dbService.getVehicle("v")?.serviceHistory?.map(s=>s.appointmentId)).toEqual(["a","a","a"]);
 await expect(dbService.saveMaintenanceAppointment("v",{...a,status:"canceled"})).rejects.toThrow(/completed/i);
});
it("saves incomplete unconfirmed vehicle and equipment rules as drafts", async () => {
 const draft = {id:"draft",title:"Draft",kind:"other" as const,source:"",confirmed:false,recurrence:"after_service" as const};
 await dbService.saveMaintenanceProfile("v",{rules:[draft]});
 expect(dbService.getVehicle("v")?.maintenance?.rules).toEqual([draft]);
 localStorage.setItem("sunny_equipment",JSON.stringify([{id:"e",name:"Washer",category:"equipment",status:"working"}]));
 const equipmentDraft = {id:"draft",title:"Draft",source:"",confirmed:false};
 await dbService.saveEquipmentMaintenanceRules("e",[equipmentDraft]);
 expect(dbService.getEquipmentItem("e")?.maintenanceRules).toEqual([equipmentDraft]);
 await expect(dbService.saveMaintenanceProfile("v",{rules:[{...draft,intervalMiles:-1}]})).rejects.toThrow(/positive/i);
 await expect(dbService.saveEquipmentMaintenanceRules("e",[{...equipmentDraft,baselineDate:"2026-10-09"}])).rejects.toThrow(/date/i);
});
it("merges bookings against authoritative remote history rather than stale local arrays", async () => {
 const existing = {id:"remote",ruleId:"oil",title:"Remote booking",date:"2026-10-12",status:"booked"};
 mocks.remote.set("vehicles/v",{...dbService.getVehicle("v"),maintenanceAppointments:[existing],currentUserId:"remote-driver"});
 await Promise.all([
   dbService.saveMaintenanceAppointment("v",{id:"a",ruleId:"oil",title:"A",date:"2026-10-13",status:"booked"}),
   dbService.saveMaintenanceAppointment("v",{id:"b",ruleId:"oil",title:"B",date:"2026-10-14",status:"booked"}),
 ]);
 expect(mocks.remote.get("vehicles/v").maintenanceAppointments.map((a:any)=>a.id)).toEqual(["remote","a","b"]);
 expect(mocks.remote.get("vehicles/v").currentUserId).toBe("remote-driver");
 expect(dbService.getVehicle("v")?.maintenanceAppointments?.map(a=>a.id)).toEqual(["remote","a","b"]);
});
it("checks current authoritative mileage and hours before committing concurrent readings", async () => {
 mocks.remote.set("vehicles/v",{...dbService.getVehicle("v"),odometer:15000});
 await expect(dbService.recordMaintenanceReading("v",{date:"2026-10-08",odometer:13000,confirmed:true})).rejects.toThrow(/previous/i);
 localStorage.setItem("sunny_equipment",JSON.stringify([{id:"e",name:"Washer",category:"equipment",status:"working",operatingHours:100}]));
 mocks.remote.set("equipment/e",{id:"e",name:"Washer",category:"equipment",status:"working",operatingHours:150});
 await expect(dbService.recordEquipmentHours("e",{date:"2026-10-08",hours:120,recordedBy:"boss"})).rejects.toThrow(/previous/i);
 const results=await Promise.allSettled([dbService.recordMaintenanceReading("v",{date:"2026-10-08",odometer:17000,confirmed:true}),dbService.recordMaintenanceReading("v",{date:"2026-10-08",odometer:16000,confirmed:true})]);
 expect(results.map(r=>r.status)).toEqual(["fulfilled","rejected"]);
 expect(mocks.remote.get("vehicles/v").odometer).toBe(17000);
});
it("serializes correction lineage and redirects every linked completed appointment at the boundary", async () => {
 const original={id:"s",ruleId:"oil",kind:"oil" as const,title:"Oil",date:"2026-10-08",odometer:12000,recordedBy:"boss"};
 const appointments=[{id:"a",ruleId:"oil",title:"A",date:"2026-10-08",status:"completed",serviceRecordId:"s"},{id:"b",ruleId:"oil",title:"B",date:"2026-10-08",status:"completed",serviceRecordId:"s"}];
 localStorage.setItem("sunny_vehicles",JSON.stringify([{...dbService.getVehicle("v"),serviceHistory:[original]}]));
 mocks.remote.set("vehicles/v",{...dbService.getVehicle("v"),maintenanceAppointments:appointments});
 const correction=(id:string)=>({...original,id,odometer:11900,supersedesId:"s",correctionReason:"Invoice",recordedAt:"2026-10-08T12:00:00.000Z"});
 const results=await Promise.allSettled([dbService.recordVehicleService("v",correction("s2")),dbService.recordVehicleService("v",correction("s3"))]);
 expect(results.map(r=>r.status)).toEqual(["fulfilled","rejected"]);
 expect(mocks.remote.get("vehicles/v").serviceHistory.map((s:any)=>s.id)).toEqual(["s","s2"]);
 expect(mocks.remote.get("vehicles/v").maintenanceAppointments.map((a:any)=>a.serviceRecordId)).toEqual(["s2","s2"]);
});
it("revalidates transaction retries against newer server readings without mutating cache", async () => {
 mocks.runTransaction.mockImplementationOnce(async (_db, callback) => {
   const prior = dbService.getVehicle("v")!;
   await callback({get:async()=>({exists:()=>true,data:()=>({...prior,odometer:15000})}),update:()=>undefined});
   expect(dbService.getVehicle("v")?.odometer).toBe(12000);
   return callback({get:async()=>({exists:()=>true,data:()=>({...prior,odometer:17000})}),update:()=>undefined});
 });
 await expect(dbService.recordMaintenanceReading("v",{date:"2026-10-08",odometer:16000,confirmed:true})).rejects.toThrow(/previous/i);
 expect(dbService.getVehicle("v")?.odometer).toBe(12000);
});
it("clears only the photo after remote acknowledgement and retains concurrent assignment changes", async () => {
 const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8xkAAAAASUVORK5CYII=";
 localStorage.setItem("sunny_vehicles",JSON.stringify([{...dbService.getVehicle("v"),imageUrl:photo}]));
 let acknowledge!: () => void;
 mocks.updateDoc.mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge=resolve; }));
 const saving = dbService.saveVehicleImage("v","");
 void saving.catch(() => undefined);
 await Promise.resolve(); await Promise.resolve();
 expect(dbService.getVehicle("v")?.imageUrl).toBe(photo);
 expect(mocks.updateDoc).toHaveBeenCalledWith({path:"vehicles",id:"v"},{imageUrl:""});
 localStorage.setItem("sunny_vehicles",JSON.stringify([{...dbService.getVehicle("v"),currentUserId:"other-driver",odometer:13000}]));
 acknowledge(); await saving;
 expect(dbService.getVehicle("v")).toMatchObject({imageUrl:"",currentUserId:"other-driver",odometer:13000});
});
it("retains the photo when remote clearing fails", async () => {
 localStorage.setItem("sunny_vehicles",JSON.stringify([{...dbService.getVehicle("v"),imageUrl:"existing-photo"}]));
 mocks.updateDoc.mockRejectedValueOnce(new Error("permission denied"));
 await expect(dbService.saveVehicleImage("v","")).rejects.toThrow("permission denied");
 expect(dbService.getVehicle("v")).toMatchObject({imageUrl:"existing-photo",currentUserId:"driver"});
});
it("still rejects whitespace-only photo values without a remote write", async () => {
 await expect(dbService.saveVehicleImage("v"," ")).rejects.toThrow(/image/i);
 expect(mocks.updateDoc).not.toHaveBeenCalled();
});
