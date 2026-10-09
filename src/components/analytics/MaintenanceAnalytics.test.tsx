import React from "react";
import { act } from "react";
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
  saveMaintenanceAppointment:vi.fn(),correctVehicleService:vi.fn(),saveVehicleImage:vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    role: state.role,
    hydrated: state.hydrated,
    isTrueManager: state.role === "manager",
    user: { id:"manager-id", name: "Manager" },
  }),
}));
vi.mock("@/lib/db", () => ({ dbService: db }));
vi.mock("@/lib/imageUpload",async(importOriginal)=>({...await importOriginal<typeof import("@/lib/imageUpload")>(),prepareImageUpload:vi.fn(async()=>"data:image/jpeg;base64,SYNTHETIC")}));
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
  db.getVehicles.mockReturnValue([]);db.getInspections.mockReturnValue([]);
  vi.useRealTimers();
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

it("shows weekly actions and JSON export in isolated sample mode",async()=>{state.role="manager";const el=await render();const button=Array.from(el.querySelectorAll("button")).find(b=>b.textContent?.includes("Try sample data"))!;await act(async()=>button.click());expect(el.textContent).toContain("Priority actions");expect(el.textContent).toContain("Export report JSON");expect(el.textContent).toContain("Book appointment");});

async function clickText(el:HTMLElement,text:string){const button=Array.from(el.querySelectorAll('button')).find(b=>b.textContent?.includes(text));expect(button).toBeDefined();await act(async()=>button!.click());}
async function checkLabel(el:HTMLElement,label:string){const input=Array.from(el.querySelectorAll('label')).find(l=>l.textContent?.includes(label))!.querySelector('input')!;await act(async()=>input.click());}
async function setField(el:HTMLElement,label:string,value:string){const input=Array.from(el.querySelectorAll('label')).find(l=>l.textContent?.includes(label))!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('keeps sample mileage, booking and append-only corrections off every persistence API',async()=>{state.role='manager';const el=await render();await clickText(el,'Try sample data');await clickText(el,'Mileage');await checkLabel(el,'I measured');await clickText(el,'Save sample change');await clickText(el,'Book appointment');await clickText(el,'Save sample change');expect(el.textContent).toContain('booked');await clickText(el,'Append correction');await setField(el,'Correction reason','Synthetic receipt adjustment');await clickText(el,'Save sample change');expect(el.textContent).toContain('Synthetic receipt adjustment');expect(el.textContent).toContain('Superseded; retained for audit');expect(db.recordMaintenanceReading).not.toHaveBeenCalled();expect(db.saveMaintenanceAppointment).not.toHaveBeenCalled();expect(db.correctVehicleService).not.toHaveBeenCalled();expect(db.recordVehicleService).not.toHaveBeenCalled();});
it('retains a partially failed setup and retries without duplicating an acknowledged reading or service',async()=>{state.role='manager';vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));db.getVehicles.mockReturnValue([{id:'live',vehicleNumber:'Truck',name:'Truck',licensePlate:'',qrCodeToken:'',status:'active',odometer:1000}] as never[]);db.saveMaintenanceProfile.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue(undefined);const el=await render();await clickText(el,'Vehicle & schedule setup');await clickText(el,'Next');await checkLabel(el,'I measured');await checkLabel(el,'Record the actual last completed oil service');await setField(el,'Last oil service date','2026-10-01');await setField(el,'Last oil service odometer','900');await checkLabel(el,'I checked this completed service');await clickText(el,'Save record');expect(el.textContent).toContain('Setup is not fully saved');expect(el.querySelector('[role="dialog"]')).not.toBeNull();expect(el.textContent).not.toContain('Maintenance record saved.');await clickText(el,'Save record');expect(db.recordMaintenanceReading).toHaveBeenCalledTimes(1);expect(db.recordVehicleService).toHaveBeenCalledTimes(1);expect(db.saveMaintenanceProfile).toHaveBeenCalledTimes(2);expect(db.recordMaintenanceReading.mock.calls[0][1]).toMatchObject({confirmed:true,recordedBy:'manager-id'});expect(el.textContent).toContain('Maintenance record saved.');});

it('isolates a resized sample photo from fleet persistence',async()=>{state.role='manager';const el=await render();await clickText(el,'Try sample data');const file=el.querySelector<HTMLInputElement>('[aria-label="Upload Mav 1 photo"]')!;Object.defineProperty(file,'files',{value:[new File(['image'],'photo.jpg',{type:'image/jpeg'})]});await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));expect(el.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,SYNTHETIC');expect(db.saveVehicleImage).not.toHaveBeenCalled();expect(el.textContent).toContain('Sample photo saved for this session.');});
it('exports confirmed inspection measurements with embedded rows for the Python report',async()=>{state.role='manager';const vehicle={id:'v',vehicleNumber:'Truck',name:'Truck',licensePlate:'',qrCodeToken:'',status:'active',odometer:1000,maintenanceReadings:[{date:'2026-10-01',odometer:900,confirmed:true}]};db.getVehicles.mockReturnValue([vehicle] as never[]);db.getInspections.mockReturnValue([{vehicleId:'v',dateString:'2026-10-08',odometer:1000,odometerConfirmed:true,status:'approved'},{vehicleId:'v',dateString:'2026-10-07',odometer:950,odometerConfirmed:false,status:'approved'},{vehicleId:'v',dateString:'2026-10-06',odometer:940,odometerConfirmed:true,status:'rejected'}] as never[]);let exported:Blob|undefined;vi.stubGlobal('URL',{createObjectURL:(blob:Blob)=>{exported=blob;return 'blob:report';},revokeObjectURL:()=>{}});const link=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});try{const el=await render();await clickText(el,'Export report JSON');const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=reject;reader.readAsText(exported!);});const data=JSON.parse(content);expect(data.vehicles[0].maintenanceReadings).toEqual(vehicle.maintenanceReadings);expect(data.readings.v).toEqual([{date:'2026-10-08',odometer:1000,confirmed:true,source:'Confirmed inspection'}]);}finally{link.mockRestore();vi.unstubAllGlobals();}});
it('requires an audited correction when a saved baseline is edited after partial setup failure',async()=>{state.role='manager';vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));db.getVehicles.mockReturnValue([{id:'live',vehicleNumber:'Truck',name:'Truck',licensePlate:'',qrCodeToken:'',status:'active',odometer:1000}] as never[]);db.saveMaintenanceProfile.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue(undefined);const el=await render();await clickText(el,'Vehicle & schedule setup');await clickText(el,'Next');await checkLabel(el,'Record the actual last completed oil service');await setField(el,'Last oil service date','2026-10-01');await setField(el,'Last oil service odometer','900');await checkLabel(el,'I checked this completed service');await clickText(el,'Save record');await setField(el,'Last oil service odometer','950');await checkLabel(el,'I checked this completed service');await clickText(el,'Save record');expect(el.textContent).toContain('already saved; append a correction');expect(el.textContent).not.toContain('Maintenance record saved.');expect(db.saveMaintenanceProfile).toHaveBeenCalledTimes(1);});
it('opens the independent rule controls from the dashboard baseline action',async()=>{state.role='manager';db.getVehicles.mockReturnValue([{id:'live',vehicleNumber:'Truck',name:'Truck',licensePlate:'',qrCodeToken:'',status:'active',maintenance:{rules:[{id:'cabin',title:'Cabin filter',kind:'filters',intervalMonths:12,source:'Manual',confirmed:true,recurrence:'after_service'}]}}] as never[]);const el=await render();await clickText(el,'Verify service baseline');const dialog=el.querySelector('[role="dialog"]')!;expect(dialog.textContent).toContain('Step 3 of 3');expect(dialog.textContent).not.toContain('Last oil service date');const rule=dialog.querySelector('[data-maintenance-rule="cabin"]');expect(rule?.getAttribute('data-selected-rule')).toBe('true');expect(rule?.textContent).toContain('Actual baseline date');expect(document.activeElement).toBe(rule);});
it('resolves unknown history through step 2 and uses the confirmed independent baseline',async()=>{state.role='manager';vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));const vehicle={id:'live',vehicleNumber:'Truck',name:'Truck',licensePlate:'',qrCodeToken:'',status:'active',maintenance:{baselineUnknown:true,make:'Ford',model:'Maverick',year:2023,engine:'Hybrid',operatingProfile:'Normal use',rules:[{id:'cabin',title:'Cabin filter',kind:'filters',intervalMonths:12,source:'Verified receipt and manual',confirmed:true,recurrence:'after_service',baselineDate:'2026-10-01'}]}};db.getVehicles.mockReturnValue([vehicle] as never[]);db.saveMaintenanceProfile.mockImplementationOnce(async(_id,profile)=>{db.getVehicles.mockReturnValue([{...vehicle,maintenance:profile}] as never[]);window.dispatchEvent(new Event('sunny_db_update'));});const el=await render();expect(el.textContent).toContain('prior service is unknown');await clickText(el,'Verify service history');const dialog=el.querySelector('[role="dialog"]')!;expect(dialog.textContent).toContain('Step 2 of 3');const unknown=Array.from(dialog.querySelectorAll('label')).find(label=>label.textContent?.includes('Service history is unknown'))!.querySelector<HTMLInputElement>('input')!;expect(unknown.checked).toBe(true);await checkLabel(el,'Service history is unknown');await clickText(el,'Save record');expect(el.textContent).not.toContain('prior service is unknown');expect(el.querySelector('[aria-label="Cabin filter forecast"]')?.textContent).toContain('On track');expect(el.querySelector('[aria-label="Cabin filter forecast"]')?.textContent).toContain('Manager supplied baseline 2026-10-01');expect(db.recordVehicleService).not.toHaveBeenCalled();});
