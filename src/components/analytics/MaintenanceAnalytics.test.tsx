import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ role: "employee", hydrated: true, managerId: "manager-id" }));
const db = vi.hoisted(() => ({
  getVehicles: vi.fn(() => []),
  getEquipment: vi.fn(() => []),
  getInspections: vi.fn(() => []),
  saveMaintenanceProfile: vi.fn(),
  recordVehicleService: vi.fn(),
  recordMaintenanceReading: vi.fn(),
  saveMaintenanceAppointment:vi.fn(),correctVehicleService:vi.fn(),saveVehicleImage:vi.fn(),
  saveEquipmentMaintenanceRules:vi.fn(),recordEquipmentHours:vi.fn(),recordEquipmentService:vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    role: state.role,
    hydrated: state.hydrated,
    isTrueManager: state.role === "manager",
    user: { id:state.managerId, name: "Manager" },
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
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  state.role = "employee";
  state.managerId = "manager-id";
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(prepareImageUpload).mockReset().mockResolvedValue("data:image/jpeg;base64,SYNTHETIC");
  db.saveVehicleImage.mockReset();
  db.getVehicles.mockReturnValue([]);db.getInspections.mockReturnValue([]);db.getEquipment.mockReturnValue([]);
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


import { analyticsPreferenceKey } from "@/lib/analyticsPreferences";
const widgetOrder = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-analytics-widget]')).map(node => node.getAttribute('data-analytics-widget'));
async function clickLabel(el: HTMLElement, label: string) { const control = el.querySelector<HTMLElement>(`[aria-label="${label}"]`); expect(control).not.toBeNull(); await act(async () => control!.click()); }
async function fieldLabel(el: HTMLElement, label: string, value: string) { const input = el.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; expect(input).not.toBeNull(); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function exportData(el: HTMLElement) { let exported: Blob | undefined; vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { exported = blob; return 'blob:report'; }, revokeObjectURL: () => { } }); const link = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { }); try {
    await clickText(el, 'Export report JSON');
    return JSON.parse(await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(exported!); }));
}
finally {
    link.mockRestore();
    vi.unstubAllGlobals();
} }
it('renders overview widgets in persisted DOM order and keyboard changes that order', async () => { state.role = 'manager'; localStorage.setItem(analyticsPreferenceKey(state.managerId), JSON.stringify({ version: 1, order: ['equipment', 'vehicles', 'outlook', 'metrics'], hidden: ['outlook'] })); const stored = localStorage.getItem(analyticsPreferenceKey(state.managerId)); const el = await render(); expect(widgetOrder(el)).toEqual(['equipment', 'vehicles', 'metrics']); expect(localStorage.getItem(analyticsPreferenceKey(state.managerId))).toBe(stored); await clickLabel(el, 'Move Vehicle overview up'); expect(widgetOrder(el)).toEqual(['vehicles', 'equipment', 'metrics']); await clickLabel(el, 'Show Vehicle overview'); expect(widgetOrder(el)).toEqual(['equipment', 'metrics']); });
it('keeps vehicle urgency and identity setup fleetwide when ordinary widgets are hidden or search excludes a truck', async () => { state.role = 'manager'; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T12:00:00Z')); db.getVehicles.mockReturnValue([{ id: 'urgent', vehicleNumber: 'Urgent truck', name: 'Truck', licensePlate: '', qrCodeToken: '', status: 'active', odometer: 2000, maintenanceReadings: [{ date: '2026-10-09', odometer: 2000, confirmed: true, source: 'Actual measurement' }], maintenance: { rules: [{ id: 'oil', title: 'Oil service', kind: 'oil', intervalMiles: 1000, source: 'Verified manual', confirmed: true, recurrence: 'after_service', baselineOdometer: 0, baselineDate: '2026-10-01' }] } }] as never[]); const el = await render(); await fieldLabel(el, 'Search trucks', 'unmatched'); const pinned = el.querySelector('[aria-label="Weekly maintenance actions"]')!; expect(pinned.textContent).toContain('Urgent truck'); expect(pinned.textContent).toContain('Due now'); const identity = el.querySelector('[aria-label="Vehicle identity setup"]'); expect(identity?.textContent).toContain('Urgent truck'); await clickLabel(el, 'Show Vehicle overview'); expect(el.querySelector('[data-analytics-widget="vehicles"]')).toBeNull(); await clickText(identity as HTMLElement, 'Add identity detail'); expect(el.querySelector('[role="dialog"]')?.textContent).toContain('Step 1 of 3'); });
it('keeps independent equipment service and replacement obligations actionable outside a hidden widget', async () => { state.role = 'manager'; db.getEquipment.mockReturnValue([{ id: 'pump', name: 'Pressure pump', status: 'working', category: 'equipment', lifespanEnabled: true, lifespanMode: 'usage', expectedCars: 100, carsUsed: 110, operatingHours: 150, maintenanceRules: [{ id: 'pump-oil', title: 'Pump oil', intervalHours: 100, confirmed: true, source: 'Actual manual', baselineHours: 0 }] }, { id: 'soon', name: 'Upcoming pump', status: 'working', category: 'equipment', operatingHours: 95, maintenanceRules: [{ id: 'pump-oil', title: 'Upcoming oil', intervalHours: 100, confirmed: true, source: 'Verified pump manual', baselineHours: 0 }] }, { id: 'brush', name: 'Detail brush', status: 'working', category: 'equipment', lifespanEnabled: true, lifespanMode: 'usage', expectedCars: 100, carsUsed: 90 }] as never[]); const el = await render(); await clickLabel(el, 'Show Equipment service'); expect(el.querySelector('[data-analytics-widget="equipment"]')).toBeNull(); const service = el.querySelector('[aria-label="Equipment maintenance actions"]')!; expect(service.textContent).toContain('Pressure pump'); expect(service.textContent).toContain('Pump oil'); expect(service.textContent).toContain('Due now'); expect(service.textContent).toContain('Upcoming pump'); expect(service.textContent).toContain('Due soon'); expect(service.textContent).toContain('Detail brush'); expect(service.textContent).toContain('Needs setup'); const replacement = el.querySelector('[aria-label="Equipment replacement reviews"]')!; expect(replacement.textContent).toContain('Pressure pump'); expect(replacement.textContent).toContain('Review now'); expect(replacement.textContent).toContain('Detail brush'); expect(replacement.textContent).toContain('Getting low'); await clickText(service as HTMLElement, 'Review equipment service'); expect(el.querySelector('[aria-label="Equipment service"]')?.textContent).toContain('Actual manual'); });
it('separates manager layouts and reset removes only the active key', async () => { state.role = 'manager'; localStorage.setItem(analyticsPreferenceKey('second-manager'), JSON.stringify({ version: 1, order: ['vehicles', 'metrics', 'outlook', 'equipment'], hidden: ['metrics'] })); const el = await render(); await clickLabel(el, 'Show Equipment service'); const first = localStorage.getItem(analyticsPreferenceKey('manager-id')); state.managerId = 'second-manager'; await act(async () => root!.render(<AnalyticsPage />)); expect(widgetOrder(el)).toEqual(['vehicles', 'outlook', 'equipment']); await clickText(el, 'Reset layout'); expect(widgetOrder(el)).toEqual(['metrics', 'outlook', 'vehicles', 'equipment']); expect(localStorage.getItem(analyticsPreferenceKey('second-manager'))).toBeNull(); expect(localStorage.getItem(analyticsPreferenceKey('manager-id'))).toBe(first); });
it('explains blocked storage on load changes and reset while applying session layout', async () => { state.role = 'manager'; const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }); const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); }); const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); }); try {
    const el = await render();
    expect(el.textContent).toContain('browser storage is unavailable');
    await clickLabel(el, 'Show Equipment service');
    expect(widgetOrder(el)).toEqual(['metrics', 'outlook', 'vehicles']);
    expect(el.textContent).toContain('browser storage is unavailable');
    await clickText(el, 'Reset layout');
    expect(widgetOrder(el)).toEqual(['metrics', 'outlook', 'vehicles', 'equipment']);
    expect(el.textContent).toContain('browser storage is unavailable');
}
finally {
    get.mockRestore();
    set.mockRestore();
    remove.mockRestore();
} });
it('updates and exports stateful sample equipment and resets it on reentry without writes', async () => { state.role = 'manager'; const el = await render(); await clickText(el, 'Try sample data'); const panel = el.querySelector('[aria-label="Equipment service"]') as HTMLElement; expect(panel).not.toBeNull(); await fieldLabel(panel, 'Measured operating hours', '170'); await clickText(panel, 'Save measured hours'); const data = await exportData(el); expect(data.equipment[0].operatingHours).toBe(170); expect(data.equipment[0].maintenanceRules[0].source).toContain('Synthetic sample policy only'); expect(data.equipment[0].serviceHistory[0].recordedBy).toBe('synthetic-manager'); expect(data.equipment[0].hoursReadings.at(-1).recordedBy).toBe('synthetic-manager'); expect(data.equipment[0]).toMatchObject({ expectedCars: 300, carsUsed: 260, lifespanMode: 'usage' }); expect(db.recordEquipmentHours).not.toHaveBeenCalled(); expect(db.saveEquipmentMaintenanceRules).not.toHaveBeenCalled(); expect(db.recordEquipmentService).not.toHaveBeenCalled(); await clickText(el, 'Use fleet data'); await clickText(el, 'Try sample data'); const reset = await exportData(el); expect(reset.equipment[0].operatingHours).not.toBe(170); });
it('removes and restores sample photos without fleet writes', async () => { state.role = 'manager'; const el = await render(); await clickText(el, 'Try sample data'); const file = el.querySelector<HTMLInputElement>('[aria-label="Upload Mav 1 photo"]')!; Object.defineProperty(file, 'files', { value: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] }); await act(async () => file.dispatchEvent(new Event('change', { bubbles: true }))); await clickLabel(el, 'Remove Mav 1 photo'); expect(el.querySelector('img[alt="Mav 1 vehicle"]')).toBeNull(); await clickLabel(el, 'Restore Mav 1 photo'); expect(el.querySelector('img[alt="Mav 1 vehicle"]')?.getAttribute('src')).toBe('data:image/jpeg;base64,SYNTHETIC'); expect(db.saveVehicleImage).not.toHaveBeenCalled(); });
it('awaits live photo removal and preserves restore state through failures', async () => { state.role = 'manager'; const vehicle = { id: 'live', vehicleNumber: 'Truck', name: 'Truck', licensePlate: '', qrCodeToken: '', status: 'active', imageUrl: 'data:image/jpeg;base64,OLD' }; db.getVehicles.mockReturnValue([vehicle] as never[]); let resolve: () => void = () => { }; db.saveVehicleImage.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; })); const el = await render(); await clickLabel(el, 'Remove Truck photo'); expect(el.textContent).toContain('Saving photo…'); expect(el.querySelector('img')?.getAttribute('src')).toBe(vehicle.imageUrl); await act(async () => resolve()); expect(db.saveVehicleImage).toHaveBeenCalledWith('live', ''); expect(el.querySelector('img')).toBeNull(); db.saveVehicleImage.mockRejectedValueOnce(new Error('Restore offline')); await clickLabel(el, 'Restore Truck photo'); expect(el.textContent).toContain('Restore offline'); expect(el.querySelector('img')).toBeNull(); db.saveVehicleImage.mockResolvedValueOnce(undefined); await clickLabel(el, 'Restore Truck photo'); expect(el.querySelector('img')?.getAttribute('src')).toBe(vehicle.imageUrl); expect(db.saveVehicleImage).toHaveBeenLastCalledWith('live', vehicle.imageUrl); });

import { prepareImageUpload } from "@/lib/imageUpload";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {resolve = done; reject = fail;});
  return {promise, resolve, reject};
}
async function startPhotoUpload(el: HTMLElement, truck = "Truck") {
  const input = el.querySelector<HTMLInputElement>(`[aria-label="Upload ${truck} photo"]`)!;
  Object.defineProperty(input, "files", {configurable: true, value: [new File(["image"], "photo.jpg", {type: "image/jpeg"})]});
  await act(async () => input.dispatchEvent(new Event("change", {bubbles: true})));
}
function livePhotoFixture() {
  db.getVehicles.mockReturnValue([{id: "live", vehicleNumber: "Truck", name: "Truck", licensePlate: "", qrCodeToken: "", status: "active", imageUrl: "data:image/jpeg;base64,OLD"}] as never[]);
}
function modeButton(el: HTMLElement) {
  return Array.from(el.querySelectorAll("button")).find(button => /Try sample data|Use fleet data/.test(button.textContent || ""))!;
}
it.each(["resolve", "reject"] as const)("keeps mode locked during live photo removal until %s", async outcome => {
  state.role = "manager";
  livePhotoFixture();
  const save = deferred<void>();
  db.saveVehicleImage.mockImplementationOnce(() => save.promise);
  const el = await render();
  await clickLabel(el, "Remove Truck photo");
  expect(modeButton(el).disabled).toBe(true);
  await act(async () => modeButton(el).click());
  expect(el.textContent).not.toContain("Sample mode.");
  await act(async () => outcome === "resolve" ? save.resolve() : save.reject(new Error("Removal offline")));
  expect(modeButton(el).disabled).toBe(false);
  expect(el.textContent).toContain(outcome === "resolve" ? "Vehicle photo removed." : "Removal offline");
  await clickText(el, "Try sample data");
  expect(el.textContent).not.toContain("Vehicle photo removed.");
  expect(el.textContent).not.toContain("Removal offline");
  expect(el.querySelector('[aria-label="Restore Mav 1 photo"]')).toBeNull();
});
it.each(["resolve", "reject"] as const)("keeps sample mode locked during image preparation until %s", async outcome => {
  state.role = "manager";
  const prepare = deferred<string>();
  vi.mocked(prepareImageUpload).mockImplementationOnce(() => prepare.promise);
  const el = await render();
  await clickText(el, "Try sample data");
  await startPhotoUpload(el, "Mav 1");
  expect(modeButton(el).disabled).toBe(true);
  await act(async () => modeButton(el).click());
  expect(el.textContent).toContain("Sample mode.");
  await act(async () => outcome === "resolve" ? prepare.resolve("data:image/jpeg;base64,PREVIOUS") : prepare.reject(new Error("Preparation failed")));
  expect(modeButton(el).disabled).toBe(false);
  await clickText(el, "Use fleet data");
  await clickText(el, "Try sample data");
  expect(el.querySelector('img[alt="Mav 1 vehicle"]')).toBeNull();
  expect(el.textContent).not.toContain("Preparation failed");
  expect(db.saveVehicleImage).not.toHaveBeenCalled();
});
it.each(["resolve", "reject"] as const)("ignores old-manager preparation %s and keeps the new request busy", async outcome => {
  state.role = "manager";
  livePhotoFixture();
  const oldPrepare = deferred<string>();
  const newPrepare = deferred<string>();
  vi.mocked(prepareImageUpload).mockImplementationOnce(() => oldPrepare.promise).mockImplementationOnce(() => newPrepare.promise);
  const el = await render();
  await startPhotoUpload(el);
  state.managerId = "second-manager";
  await act(async () => root!.render(<AnalyticsPage />));
  expect(modeButton(el).disabled).toBe(false);
  await startPhotoUpload(el);
  await act(async () => outcome === "resolve" ? oldPrepare.resolve("data:image/jpeg;base64,OLD-MANAGER") : oldPrepare.reject(new Error("Old preparation failed")));
  expect(db.saveVehicleImage).not.toHaveBeenCalled();
  expect(el.textContent).not.toContain("Old preparation failed");
  expect(el.querySelector('img')?.getAttribute('src')).toBe("data:image/jpeg;base64,OLD");
  expect(modeButton(el).disabled).toBe(true);
  db.saveVehicleImage.mockResolvedValueOnce(undefined);
  await act(async () => newPrepare.resolve("data:image/jpeg;base64,NEW-MANAGER"));
  expect(el.querySelector('img')?.getAttribute('src')).toBe("data:image/jpeg;base64,NEW-MANAGER");
});
it.each(["resolve", "reject"] as const)("ignores old-manager live removal %s after identity change", async outcome => {
  state.role = "manager";
  livePhotoFixture();
  const save = deferred<void>();
  db.saveVehicleImage.mockImplementationOnce(() => save.promise);
  const el = await render();
  await clickLabel(el, "Remove Truck photo");
  state.managerId = "second-manager";
  await act(async () => root!.render(<AnalyticsPage />));
  await act(async () => outcome === "resolve" ? save.resolve() : save.reject(new Error("Old removal failed")));
  expect(el.querySelector('img')?.getAttribute('src')).toBe("data:image/jpeg;base64,OLD");
  expect(el.querySelector('[aria-label="Restore Truck photo"]')).toBeNull();
  expect(el.textContent).not.toContain("Vehicle photo removed.");
  expect(el.textContent).not.toContain("Old removal failed");
  expect(modeButton(el).disabled).toBe(false);
});
it.each(["resolve", "reject"] as const)("does not begin persistence after unmounted preparation %s", async outcome => {
  state.role = "manager";
  livePhotoFixture();
  const prepare = deferred<string>();
  vi.mocked(prepareImageUpload).mockImplementationOnce(() => prepare.promise);
  await startPhotoUpload(await render());
  await act(async () => root!.unmount());
  root = undefined;
  await act(async () => outcome === "resolve" ? prepare.resolve("data:image/jpeg;base64,UNMOUNTED") : prepare.reject(new Error("Unmounted failure")));
  expect(db.saveVehicleImage).not.toHaveBeenCalled();
});
it.each(["resolve", "reject"] as const)("does not carry unmounted live removal %s into a new dashboard", async outcome => {
  state.role = "manager";
  livePhotoFixture();
  const save = deferred<void>();
  db.saveVehicleImage.mockImplementationOnce(() => save.promise);
  const el = await render();
  await clickLabel(el, "Remove Truck photo");
  await act(async () => root!.unmount());
  root = undefined;
  const next = await render();
  await act(async () => outcome === "resolve" ? save.resolve() : save.reject(new Error("Unmounted removal failed")));
  expect(next.querySelector('img')?.getAttribute('src')).toBe("data:image/jpeg;base64,OLD");
  expect(next.querySelector('[aria-label="Restore Truck photo"]')).toBeNull();
  expect(next.textContent).not.toContain("Vehicle photo removed.");
  expect(next.textContent).not.toContain("Unmounted removal failed");
});
it.each(["resolve", "reject"] as const)("ignores old sample preparation %s after manager change", async outcome => {
  state.role = "manager";
  const oldPrepare = deferred<string>();
  const newPrepare = deferred<string>();
  vi.mocked(prepareImageUpload).mockImplementationOnce(() => oldPrepare.promise).mockImplementationOnce(() => newPrepare.promise);
  const el = await render();
  await clickText(el, "Try sample data");
  await startPhotoUpload(el, "Mav 1");
  state.managerId = "second-manager";
  await act(async () => root!.render(<AnalyticsPage />));
  expect(modeButton(el).disabled).toBe(false);
  await startPhotoUpload(el, "Mav 1");
  await act(async () => outcome === "resolve" ? oldPrepare.resolve("data:image/jpeg;base64,OLD-SAMPLE") : oldPrepare.reject(new Error("Old sample failed")));
  expect(el.querySelector('img[alt="Mav 1 vehicle"]')).toBeNull();
  expect(el.textContent).not.toContain("Old sample failed");
  expect(el.textContent).not.toContain("Sample photo saved for this session.");
  expect(modeButton(el).disabled).toBe(true);
  await act(async () => newPrepare.resolve("data:image/jpeg;base64,NEW-SAMPLE"));
  expect(el.querySelector('img[alt="Mav 1 vehicle"]')?.getAttribute('src')).toBe("data:image/jpeg;base64,NEW-SAMPLE");
  expect(db.saveVehicleImage).not.toHaveBeenCalled();
});
