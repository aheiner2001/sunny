#!/usr/bin/env node
/**
 * Isolated manager walkthrough. NEVER use this synthetic session on a deployment.
 * Usage: npm run dev -- --hostname 127.0.0.1 --port 3100
 *   node scripts/check-manager-analytics.mjs --base-url http://127.0.0.1:3100 --smoke
 * Install Playwright locally with `npm install --no-save playwright`, or set
 * PLAYWRIGHT_MODULE_PATH. Optional PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH and
 * PLAYWRIGHT_CHROMIUM_ARGS_MODULE_PATH select an existing browser installation.
 * Full mode exercises sample React state only. Artifacts are ignored scratch.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const cli = process.argv.slice(2);
const option = (name, fallback) => {
  const index = cli.indexOf(name);
  return index >= 0 ? cli[index + 1] : fallback;
};
const base = new URL(option('--base-url', process.env.MANAGER_ANALYTICS_BASE_URL || 'http://127.0.0.1:3100'));
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Refusing synthetic manager session: base URL must use localhost/127.0.0.1/::1.');
assert(['http:', 'https:'].includes(base.protocol), 'Only HTTP(S) loopback URLs are supported.');
assert(!base.username && !base.password, 'Base URL must not contain credentials.');
const smoke = cli.includes('--smoke');
const artifactDir = path.resolve(option('--artifacts', '.superpowers/sdd/manager-quality/browser'));
assert(artifactDir.includes(`${path.sep}.superpowers${path.sep}`), 'Artifacts must remain in ignored .superpowers scratch.');
await fs.mkdir(artifactDir, { recursive: true });
const fixedDate = option('--date', '2026-10-08T12:00:00.000Z');
assert(Number.isFinite(Date.parse(fixedDate)), 'Invalid walkthrough date.');
const userId = 'browser-synthetic-manager';
const fixtureKeys = ['sunny_users', 'sunny_vehicles', 'sunny_equipment', 'sunny_inspections', 'sunny_issues', 'sunny_tasks', 'sunny_vehicle_assignments', 'sunny_vehicle_day_logs', 'sunny_vehicle_damage'];
const fixture = Object.fromEntries(fixtureKeys.map(key => [key, JSON.stringify([])]));
fixture.sunny_users = JSON.stringify([{ id: userId, name: 'Synthetic walkthrough manager', role: 'manager', status: 'active' }]);
fixture.sunny_seeded_v2 = 'true';
fixture.sunny_session = JSON.stringify({ userId, role: 'manager', issuedAt: fixedDate, expiresAt: new Date(Date.parse(fixedDate) + 12 * 3600000).toISOString() });
fixture.sunny_current_user_id = userId;

const report = { mode: smoke ? 'smoke' : 'full', origin: base.origin, browserDate: fixedDate, startedAt: new Date().toISOString(), checks: [], blockedRequests: [], console: { expectedSdkStartup: [], expectedBlockedResources: [], unexpected: [], warnings: [] }, pageErrors: [], allowedLiveWrites: 0, failures: [] };
report.downloads = [];
let stage = 'startup';
let browser;
let page;
let server;
let serverLog = '';
const isWrite = request => /(?:\/|%2f)(?:Write|Commit)(?:[/?]|$)|documents:commit|documents:batchWrite/i.test(request.url()) || /"(?:writes|commit)"\s*:/.test(request.postData() || '');
const writeAttempts = () => report.blockedRequests.filter(request => request.write).length;
async function fixtureSnapshot() {
  return page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), fixtureKeys);
}
async function check(name, run) {
  stage = name;
  const beforeWrites = writeAttempts();
  const beforeCache = await fixtureSnapshot();
  await run();
  assert.equal(writeAttempts(), beforeWrites, `${name}: unexpected Firestore Write/Commit attempt`);
  assert.deepEqual(await fixtureSnapshot(), beforeCache, `${name}: modified fleet cache instead of sample state`);
  report.checks.push({ name, passed: true, writeAttempts: 0, fleetCacheUnchanged: true });
  console.log(`PASS ${name}`);
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
}
async function layout(name) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const containedByScroll = element => {
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (!['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowX)) continue;
        const rect = ancestor.getBoundingClientRect();
        if (rect.left >= -1 && rect.right <= width + 1) return true;
      }
      return false;
    };
    const outside = [...document.querySelectorAll('h1, header, [role="tablist"], form, dialog, [role="dialog"]')].filter(element => !containedByScroll(element)).map(element => ({ text: element.textContent?.slice(0, 100), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })).filter(rect => rect.left < -1 || rect.right > width + 1);
    const timeline = document.querySelector('[aria-label="Synchronized truck timelines"]');
    const timelineScroll = timeline ? { clientWidth: timeline.clientWidth, scrollWidth: timeline.scrollWidth, overflowX: getComputedStyle(timeline).overflowX } : null;
    return { width, documentWidth: document.documentElement.scrollWidth, outside, timelineScroll };
  });
  assert(result.documentWidth <= result.width + 1, `${name}: document horizontal overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.outside, [], `${name}: heading/control containers extend outside viewport`);
  report.checks.push({ name, passed: true, ...result });
}
async function enterSample() {
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await page.getByText('Sample mode.', { exact: true }).waitFor();
}
async function heroContrast() {
  const result = await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).evaluate(heading => {
    const hero = heading.closest('header');
    const style = getComputedStyle(hero);
    const color = getComputedStyle(heading).color;
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const luminance = channels => channels.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const backgrounds = [style.backgroundColor, ...(style.backgroundImage.match(/rgba?\([^)]+\)/g) || [])].filter(value => rgb(value).length < 4 || rgb(value)[3] === 1);
    const text = luminance(rgb(color));
    const ratios = backgrounds.map(value => { const background = luminance(rgb(value)); return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05); });
    return { color, backgrounds, minimumContrast: Math.min(...ratios) };
  });
  assert(result.minimumContrast >= 4.5, `Hero heading contrast is too low: ${JSON.stringify(result)}`);
  report.checks.push({ name: 'hero-heading-contrast', passed: true, ...result });
}

try {
  // --serve is useful in runtimes where commands have isolated network namespaces.
  // It keeps Next and the browser in the same process tree and stops Next on exit.
  if (cli.includes('--serve')) {
    assert(base.protocol === 'http:', '--serve requires an HTTP base URL.');
    server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', base.hostname, '--port', base.port || '80'], { cwd: process.cwd(), env: { ...process.env, VERCEL: '1', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk.toString(); });
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 60000;
      const poll = async () => {
        if (server.exitCode !== null) return reject(new Error(`Local Next server exited ${server.exitCode}: ${serverLog}`));
        try {
          const response = await fetch(base.origin, { signal: AbortSignal.timeout(10000) });
          if (response.status < 500) return resolve();
        } catch {}
        if (Date.now() >= deadline) return reject(new Error(`Local Next server did not become ready: ${serverLog}`));
        setTimeout(poll, 300);
      };
      poll();
    });
    const ready = await fetch(new URL('/settings/analytics', base), { signal: AbortSignal.timeout(60000) });
    assert(ready.ok, `Local analytics page failed to compile: HTTP ${ready.status}`);
  }
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  let args;
  if (process.env.PLAYWRIGHT_CHROMIUM_ARGS_MODULE_PATH) {
    const imported = await import(pathToFileURL(process.env.PLAYWRIGHT_CHROMIUM_ARGS_MODULE_PATH).href);
    args = (imported.default || imported).args;
    assert(Array.isArray(args), 'Chromium args module must export args.');
  }
  if (process.env.PLAYWRIGHT_CHROMIUM_ARGS) {
    args = JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS);
    assert(Array.isArray(args), 'PLAYWRIGHT_CHROMIUM_ARGS must be a JSON array.');
  }
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', serviceWorkers: 'block', acceptDownloads: true });
  // Install route guard BEFORE a page exists; external auth, reads and writes abort.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base.origin) {
      assert(!isWrite(request), 'Refusing a write endpoint even on local origin.');
      return route.continue();
    }
    // Blob/data resources stay local to this document and do not reach a host.
    if (['blob:', 'data:'].includes(url.protocol)) return route.continue();
    report.blockedRequests.push({ origin: url.origin, path: url.pathname, method: request.method(), stage, write: isWrite(request) });
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(({ fixture, fixedDate, origin }) => {
    if (location.origin !== origin) return;
    const RealDate = Date;
    const timestamp = RealDate.parse(fixedDate);
    class FixtureDate extends RealDate { constructor(...args) { super(...(args.length ? args : [timestamp])); } static now() { return timestamp; } }
    window.Date = FixtureDate;
    // Reload keeps preferences, while session issuance remains reproducible.
    if (localStorage.getItem('sunny_walkthrough_seeded') !== 'true') {
      localStorage.clear();
      Object.entries(fixture).forEach(([key, value]) => localStorage.setItem(key, value));
      localStorage.setItem('sunny_walkthrough_seeded', 'true');
    }
  }, { fixture, fixedDate, origin: base.origin });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push({ stage, message: error.message }));
  page.on('console', message => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = message.text();
    const location = message.location();
    const entry = { stage, type: message.type(), text, location };
    const externalBlocked = location.url && !location.url.startsWith(base.origin) && report.blockedRequests.some(request => location.url.startsWith(request.origin));
    if (/Firebase anonymous sign-in failed|Failed to initialize Firebase|Firestore.*(?:offline|transport|connection)/i.test(text)) report.console.expectedSdkStartup.push(entry);
    else if (/net::ERR_(?:BLOCKED_BY_CLIENT|FAILED)/i.test(text) && externalBlocked) report.console.expectedBlockedResources.push(entry);
    else if (message.type() === 'error') report.console.unexpected.push(entry);
    else report.console.warnings.push(entry);
  });
  await page.goto(new URL('/settings/analytics', base).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).waitFor();
  await check('enter-isolated-sample', enterSample);
  await heroContrast();
  await layout('desktop-overview');
  await screenshot('desktop-overview');
  await check('timeline-smoke', async () => {
    await page.getByRole('tab', { name: 'Maintenance timeline', exact: true }).click();
    await page.getByRole('tabpanel').waitFor();
  });
  await layout('desktop-timeline');
  await page.getByLabel('Synchronized truck timelines', { exact: true }).scrollIntoViewIfNeeded();
  await screenshot('desktop-timeline');
  if (!smoke) await fullWalkthrough();
  await page.setViewportSize({ width: 390, height: 844 });
  await layout('mobile-timeline');
  await page.getByLabel('Synchronized truck timelines', { exact: true }).scrollIntoViewIfNeeded();
  await screenshot('mobile-timeline');
  await page.getByRole('tab', { name: 'Fleet overview', exact: true }).click();
  await layout('mobile-overview');
  await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).scrollIntoViewIfNeeded();
  await screenshot('mobile-overview');
  assert.deepEqual(report.pageErrors, [], 'Unexpected browser exceptions');
  assert.deepEqual(report.console.unexpected, [], 'Unexpected application console errors');
  assert.equal(report.allowedLiveWrites, 0);
  assert.equal(writeAttempts(), 0, 'No Firestore Write/Commit attempts are allowed, including startup');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failures.push({ stage, message: error.message, stack: error.stack });
  if (page) {
    await screenshot('failure').catch(() => {});
    await page.content().then(content => fs.writeFile(path.join(artifactDir, 'failure.html'), content)).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill('SIGTERM');
    await fs.writeFile(path.join(artifactDir, 'dev-server.log'), serverLog);
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(artifactDir, 'walkthrough.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, mode: report.mode, checks: report.checks.length, blockedExternalRequests: report.blockedRequests.length, writeAttempts: writeAttempts(), allowedLiveWrites: 0, unexpectedConsoleErrors: report.console.unexpected.length, pageErrors: report.pageErrors.length, failures: report.failures.map(failure => ({ stage: failure.stage, message: failure.message })), artifacts: artifactDir }, null, 2));
}

async function fullWalkthrough() {
  const { vehicle, dialog, overview, close, save, snapshot, booking } = workflowHelpers();
  await overview();
  const initial = await snapshot('initial');
  assert.equal(initial.vehicles.length, 3);
  assert.equal(initial.equipment.length, 2);
  const initialBrush = initial.equipment.find(item => item.id === 'sample-brush');
  await check('priority-actions-and-specific-identity-gap', async () => {
    const priority = page.getByRole('region', { name: 'Weekly maintenance actions', exact: true });
    const badges = await priority.locator('li').allTextContents();
    assert(badges.some(text => text.includes('Due now')) && badges.some(text => text.includes('Due soon')));
    assert(badges.findIndex(text => text.includes('Due now')) < badges.findIndex(text => text.includes('Due soon')));
    await vehicle(0).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByLabel('Engine / configuration', { exact: true }).fill('');
    await dialog().getByRole('button', { name: 'Save draft', exact: true }).click();
    await dialog().waitFor({ state: 'hidden' });
    const gap = page.getByRole('region', { name: 'Vehicle identity setup', exact: true });
    assert.match(await gap.textContent(), /Enter engine\/configuration/);
    await gap.getByRole('button', { name: /Add identity detail/ }).click();
    assert.match(await dialog().locator('[data-step-heading]').textContent(), /Step 1 of 3/);
    await dialog().getByLabel('Engine / configuration', { exact: true }).fill('2.5L Hybrid');
    await dialog().getByLabel(/^Operating conditions/).selectOption({ label: 'Normal use' });
    await dialog().getByRole('button', { name: 'Next', exact: true }).click();
    assert.match(await dialog().locator('[data-step-heading]').textContent(), /Measured baseline/);
    await dialog().getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await dialog().getByLabel('Engine / configuration', { exact: true }).inputValue(), '2.5L Hybrid');
    assert.equal(await dialog().getByRole('button', { name: 'Decode VIN', exact: true }).isDisabled(), true);
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await dialog().getByRole('button', { name: 'Review 2023 Maverick normal oil draft', exact: true }).click();
    assert.equal(await dialog().getByLabel(/I checked oil intervals/).isChecked(), false);
    assert.match(await dialog().getByLabel('Oil schedule source / reference', { exact: true }).inputValue(), /^https:\/\/www.fordservicecontent.com\//);
    assert.match(await dialog().getByRole('link', { name: /Review oil schedule source/ }).getAttribute('href'), /fordservicecontent/);
    await dialog().getByLabel('Oil interval (miles)', { exact: true }).fill('5000');
    await dialog().getByLabel('Oil interval (months)', { exact: true }).fill('6');
    await dialog().getByLabel('Oil schedule source / reference', { exact: true }).fill('Synthetic browser policy only; hybrid normal-use fixture');
    await dialog().getByLabel(/I checked oil intervals/).check();
    await dialog().getByRole('button', { name: '1. Identity', exact: true }).click();
    await dialog().getByLabel('Engine / configuration', { exact: true }).fill('Synthetic hybrid configuration');
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    assert.equal(await dialog().getByLabel(/I checked oil intervals/).isChecked(), false, 'Identity edit must invalidate rule confirmation');
    await dialog().getByLabel(/I checked oil intervals/).check();
    await save();
    assert.equal(await gap.count(), 0);
  });
  await check('unknown-history-and-field-specific-action', async () => {
    await vehicle(0).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByRole('button', { name: '2. Measured baseline', exact: true }).click();
    await dialog().getByLabel(/Service history is unknown/).check();
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await dialog().getByRole('button', { name: 'Add independent service rule', exact: true }).click();
    let unknownRule = dialog().getByRole('group', { name: 'New service rule', exact: true });
    await unknownRule.getByLabel('Rule title', { exact: true }).fill('Synthetic unknown history');
    unknownRule = dialog().getByRole('group', { name: 'Synthetic unknown history', exact: true });
    await unknownRule.getByLabel(/^Service category/).selectOption('filters');
    await unknownRule.getByLabel('Recurring months', { exact: true }).fill('6');
    await save();
    assert.match(await vehicle(0).textContent(), /Needs setup|unknown/i);
    const unknown = (await snapshot('unknown-history')).vehicles[0];
    assert.equal(unknown.maintenance.baselineUnknown, true);
    assert.equal(unknown.serviceHistory.length, initial.vehicles[0].serviceHistory.length);
    await vehicle(0).getByRole('region', { name: 'Synthetic unknown history forecast', exact: true }).getByRole('button', { name: /Verify service history/ }).first().click();
    assert.match(await dialog().locator('[data-step-heading]').textContent(), /Step 2 of 3/);
    await close();
    await vehicle(0).getByRole('region', { name: 'Synthetic unknown history forecast', exact: true }).getByRole('button', { name: /Verify rule source/ }).first().click();
    assert.match(await dialog().locator('[data-step-heading]').textContent(), /Step 3 of 3/);
    await close();
  });
  await check('wizard-measured-current-and-actual-oil-baseline', async () => {
    await vehicle(0).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByRole('button', { name: '2. Measured baseline', exact: true }).click();
    await dialog().getByLabel(/Service history is unknown/).uncheck();
    await dialog().getByLabel('Current odometer (miles)', { exact: true }).fill('28500');
    await dialog().getByLabel(/I measured this mileage/).check();
    await dialog().getByLabel('Record the actual last completed oil service', { exact: true }).check();
    await dialog().getByLabel('Last oil service date', { exact: true }).fill('2026-09-01');
    await dialog().getByLabel('Last oil service odometer', { exact: true }).fill('27000');
    await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click();
    assert.match(await dialog().getByRole('alert').textContent(), /confirm.*actual service records/i);
    await dialog().getByLabel(/I checked this completed service/).check();
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await dialog().getByRole('group', { name: 'Synthetic unknown history', exact: true }).getByRole('button', { name: 'Remove rule', exact: true }).click();
    await dialog().getByLabel(/I checked oil intervals/).check();
    await save();
    const current = (await snapshot('measured-baseline')).vehicles[0];
    assert.equal(current.odometer, 28500);
    assert.equal(current.maintenanceReadings.at(-1).confirmed, true);
    assert.equal(current.maintenanceReadings.at(-1).source, 'Manager measured odometer');
    assert.equal(current.serviceHistory.at(-1).odometer, 27000);
    assert(current.serviceHistory.at(-1).recordedBy && current.serviceHistory.at(-1).recordedAt);
  });
  await check('independent-rule-draft-missing-baseline-and-initial-cadence', async () => {
    await vehicle(0).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await dialog().getByRole('button', { name: 'Add independent service rule', exact: true }).click();
    let rule = dialog().getByRole('group', { name: 'New service rule', exact: true });
    await rule.getByLabel('Rule title', { exact: true }).fill('Synthetic tire rotation');
    rule = dialog().getByRole('group', { name: /^Synthetic tire rotation(?: · Selected rule)?$/ });
    await rule.getByLabel(/^Service category/).selectOption('tires');
    await rule.getByLabel('Recurring miles', { exact: true }).fill('6000');
    await rule.getByLabel('Recurring months', { exact: true }).fill('6');
    await rule.getByLabel('Rule source / baseline reference', { exact: true }).fill('Synthetic tires fixture policy; no real manual applicability');
    await save();
    const forecast = vehicle(0).getByRole('region', { name: 'Synthetic tire rotation forecast', exact: true });
    assert.match(await forecast.textContent(), /Needs setup/);
    await forecast.getByRole('button', { name: /Verify service baseline/ }).first().click();
    assert.match(await dialog().locator('[data-step-heading]').textContent(), /Step 3 of 3/);
    rule = dialog().getByRole('group', { name: /^Synthetic tire rotation(?: · Selected rule)?$/ });
    await rule.getByLabel('Actual baseline date', { exact: true }).fill('2026-09-01');
    await rule.getByLabel('Actual baseline odometer', { exact: true }).fill('27000');
    await rule.getByLabel(/I verified this rule/).check();
    await rule.getByLabel('Rule source / baseline reference', { exact: true }).fill('Synthetic tires fixture policy; verified local baseline');
    assert.equal(await rule.getByLabel(/I verified this rule/).isChecked(), false);
    await rule.getByLabel(/I verified this rule/).check();
    await dialog().getByRole('button', { name: '2. Measured baseline', exact: true }).click();
    await dialog().getByLabel('Actual in-service date (optional)', { exact: true }).fill('2023-01-01');
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await dialog().getByLabel(/I checked oil intervals/).check();
    await dialog().getByRole('button', { name: 'Add independent service rule', exact: true }).click();
    rule = dialog().getByRole('group', { name: 'New service rule', exact: true });
    await rule.getByLabel('Rule title', { exact: true }).fill('Synthetic coolant');
    rule = dialog().getByRole('group', { name: 'Synthetic coolant', exact: true });
    await rule.getByLabel(/^Cadence/).selectOption('initial_then_recurring');
    await rule.getByLabel('Recurring miles', { exact: true }).fill('10000');
    await rule.getByLabel('Recurring months', { exact: true }).fill('12');
    await rule.getByLabel('First-service odometer threshold', { exact: true }).fill('30000');
    await rule.getByLabel('Initial months from in-service date', { exact: true }).fill('120');
    await rule.getByLabel('Rule source / baseline reference', { exact: true }).fill('Synthetic coolant first/recurring policy only');
    await rule.getByLabel(/I verified this rule/).check();
    await save();
    assert.match(await vehicle(0).getByRole('region', { name: 'Synthetic coolant forecast', exact: true }).textContent(), /Initial interval/);
    assert.match(await forecast.textContent(), /33,000 mi limit/);
    await screenshot('desktop-independent-rules');
  });
  await check('mileage-prefill-confirmation-and-monotonic-validation', async () => {
    await vehicle(0).getByRole('button', { name: 'Mileage', exact: true }).click();
    await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click();
    assert.match(await dialog().getByRole('alert').textContent(), /Confirm that this mileage was measured/);
    await dialog().getByLabel('Current odometer (miles)', { exact: true }).fill('28000');
    await dialog().getByLabel(/I measured this mileage/).check();
    await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click();
    assert.match(await dialog().getByRole('alert').textContent(), /at least as large as the previous mileage/);
    await dialog().getByLabel('Current odometer (miles)', { exact: true }).fill('28600');
    assert.equal(await dialog().getByLabel(/I measured this mileage/).isChecked(), false);
    await dialog().getByLabel(/I measured this mileage/).check();
    await save();
    assert.match(await vehicle(0).textContent(), /28,600/);
  });
  await check('booked-estimate-and-cancel-are-distinct', async () => {
    await booking('Synthetic canceled oil visit', '2026-10-12');
    await page.getByRole('tab', { name: 'Maintenance timeline', exact: true }).click();
    const booked = page.getByRole('button').filter({ hasText: 'Synthetic canceled oil visit' });
    assert.match(await booked.textContent(), /Booked appointment/);
    assert(await page.getByRole('button').filter({ hasText: 'Estimated' }).count());
    await booked.click();
    assert.equal(await dialog().getByRole('heading', { name: 'Manage service appointment', exact: true }).count(), 1);
    await dialog().getByLabel(/^Appointment status/).selectOption('canceled');
    await save();
    assert.equal(await page.getByRole('button').filter({ hasText: 'Synthetic canceled oil visit' }).count(), 0);
    await overview();
    const canceled = (await snapshot('canceled-appointment')).vehicles[0].maintenanceAppointments.find(a => a.title === 'Synthetic canceled oil visit');
    assert.equal(canceled.status, 'canceled');
    assert.equal(canceled.serviceRecordId, undefined);
  });
  await check('completion-requires-actual-service-and-explicit-link', async () => {
    await booking('Synthetic linked oil visit', '2026-10-08');
    await openAppointment('Synthetic linked oil visit');
    await dialog().getByLabel(/^Appointment status/).selectOption('completed');
    await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click();
    assert.match(await dialog().getByRole('alert').textContent(), /Link a recorded completed service/);
    await close();
    await vehicle(0).getByRole('button', { name: 'Log service', exact: true }).click();
    await dialog().getByLabel('Description', { exact: true }).fill('Synthetic completed oil visit');
    await dialog().getByLabel('Completed on', { exact: true }).fill('2026-10-08');
    await dialog().getByLabel('Odometer at service (miles)', { exact: true }).fill('28600');
    await dialog().getByLabel(/^Complete booked appointment/).selectOption({ label: '2026-10-08 · Synthetic linked oil visit' });
    await save();
    const data = await snapshot('completed-appointment');
    const current = data.vehicles[0];
    const a = current.maintenanceAppointments.find(a => a.title === 'Synthetic linked oil visit');
    const s = current.serviceHistory.find(s => s.title === 'Synthetic completed oil visit');
    assert.equal(a.status, 'completed');
    assert.equal(a.serviceRecordId, s.id);
    assert.equal(s.appointmentId, a.id);
    await openAppointment('Synthetic linked oil visit');
    assert.equal(await dialog().getByLabel(/^Appointment status/).isDisabled(), true);
    await close();
    await booking('Synthetic retrospective link', '2026-10-08');
    await openAppointment('Synthetic retrospective link');
    await dialog().getByLabel(/^Appointment status/).selectOption('completed');
    await dialog().getByLabel(/^Recorded completed service/).selectOption(s.id);
    await save();
  });
  await check('append-only-service-correction-audit-and-linked-booking', async () => {
    await openHistory();
    const entry = vehicle(0).locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Service history' }) }).locator('div').filter({ has: page.locator('strong').filter({ hasText: /^Synthetic completed oil visit$/ }) });
    await entry.getByRole('button', { name: /Append correction/ }).click();
    await dialog().getByLabel('Description', { exact: true }).fill('Synthetic corrected oil visit');
    await dialog().getByLabel('Odometer at service (miles)', { exact: true }).fill('28550');
    await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click();
    assert.match(await dialog().getByRole('alert').textContent(), /Enter the correction reason/);
    await dialog().getByLabel('Correction reason', { exact: true }).fill('Synthetic transcription correction; original retained');
    await save();
    const current = (await snapshot('correction-audit')).vehicles[0];
    const original = current.serviceHistory.find(s => s.title === 'Synthetic completed oil visit');
    const correction = current.serviceHistory.find(s => s.title === 'Synthetic corrected oil visit');
    assert(original && correction && original.id !== correction.id);
    assert.equal(original.odometer, 28600);
    assert.equal(correction.supersedesId, original.id);
    assert.equal(correction.odometer, 28550);
    assert.match(correction.correctionReason, /original retained/);
    assert(correction.recordedBy && correction.recordedAt);
    for (const a of current.maintenanceAppointments.filter(a => a.status === 'completed')) assert.equal(a.serviceRecordId, correction.id);
    assert.match(await vehicle(0).textContent(), /Superseded; retained for audit/);
    assert.match(await vehicle(0).textContent(), /Synthetic transcription correction/);
    assert.match(await vehicle(0).getByRole('region', { name: 'Synthetic tire rotation forecast', exact: true }).textContent(), /33,000 mi limit/);
    await screenshot('desktop-correction-audit');
  });
  await check('non-oil-completion-switches-initial-to-recurring', async () => {
    await vehicle(0).getByRole('button', { name: 'Log service', exact: true }).click();
    await dialog().getByLabel(/^Service rule/).selectOption({ label: 'Synthetic coolant' });
    await dialog().getByLabel('Completed on', { exact: true }).fill('2026-10-08');
    await dialog().getByLabel('Odometer at service (miles)', { exact: true }).fill('28600');
    await save();
    const coolant = vehicle(0).getByRole('region', { name: 'Synthetic coolant forecast', exact: true });
    assert.match(await coolant.textContent(), /Recurring interval/);
    assert.match(await coolant.textContent(), /38,600 mi limit/);
  });
  await check('formula-like-booking-remains-separate-and-csv-safe', async () => {
    await booking(' =1+1', '2026-10-12');
  });
  await photoWorkflow(vehicle, snapshot);
  await equipmentWorkflow(snapshot, initialBrush);
  await check('json-and-csv-downloads-preserve-audited-sample-state', async () => {
    const data = await snapshot('final-edited-sample');
    const current = data.vehicles[0];
    assert.equal(current.odometer, 28600);
    assert.equal(current.maintenance.rules.length, 2);
    assert(current.maintenanceReadings.every(reading => reading.confirmed === true));
    assert(current.serviceHistory.some(service => service.supersedesId));
    assert(current.maintenanceAppointments.some(a => a.status === 'canceled'));
    assert(current.maintenanceAppointments.some(a => a.status === 'completed'));
    const csvPath = await download('Export plan', 'final-plan.csv');
    const csv = await fs.readFile(csvPath, 'utf8');
    assert(csv.startsWith('"Vehicle","Service","Planning date","Status","Basis"'));
    assert(csv.includes('Estimate') && csv.includes('Booked appointment') && csv.includes('Synthetic coolant'));
    assert(csv.includes('"\' =1+1"'), 'CSV must prefix spreadsheet-formula-like title with an apostrophe');
    report.exportedFixture = path.join(artifactDir, 'final-edited-sample.json');
  });
  await timelineWorkflow();
  await check('mobile-setup-dialog-focus-and-escape', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await overview();
    const opener = vehicle(0).getByRole('button', { name: /Vehicle & schedule setup/ });
    await opener.click();
    await dialog().getByRole('button', { name: '3. Verified rules', exact: true }).click();
    await layout('mobile-setup-step-three');
    await screenshot('mobile-setup-step-three');
    const first = dialog().getByRole('button', { name: 'Close maintenance form', exact: true });
    const last = dialog().getByRole('button', { name: 'Save sample change', exact: true });
    await last.focus();
    await page.keyboard.press('Tab');
    assert.equal(await first.evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'hidden' });
    assert.equal(await opener.evaluate(element => document.activeElement === element), true);
  });
  await preferencesWorkflow(snapshot);
  // The shared smoke tail captures a contained mobile comparison in calendar mode.
  await page.getByRole('tab', { name: 'Maintenance timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  async function openHistory() {
    const detail = vehicle(0).locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Service history' }) });
    if (!await detail.evaluate(element => element.open)) await detail.locator('summary').click();
  }
  async function openAppointment(title) {
    const detail = vehicle(0).locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Appointments (' }) });
    if (!await detail.evaluate(element => element.open)) await detail.locator('summary').click();
    const entry = detail.locator('div').filter({ has: page.locator('strong').filter({ hasText: title }) });
    await entry.getByRole('button', { name: /Review booking/ }).click();
  }
}

function workflowHelpers() {
  // Upload is a file input, so scope cards by its observed aria-label.
  const scopedVehicle = index => page.locator('[data-analytics-widget="vehicles"] article').filter({ has: page.getByLabel(`Upload Mav ${index + 1} photo`, { exact: true }) });
  const dialog = () => page.getByRole('dialog');
  const overview = async () => { await page.getByRole('tab', { name: 'Fleet overview', exact: true }).click(); await page.getByRole('region', { name: 'Weekly maintenance actions', exact: true }).waitFor(); };
  const close = async () => { await dialog().getByRole('button', { name: 'Close maintenance form', exact: true }).click(); await dialog().waitFor({ state: 'hidden' }); };
  const save = async () => { await dialog().getByRole('button', { name: 'Save sample change', exact: true }).click(); await dialog().waitFor({ state: 'hidden' }); };
  const snapshot = async name => JSON.parse(await fs.readFile(await download('Export report JSON', `${name}.json`), 'utf8'));
  const booking = async (title, date) => {
    await scopedVehicle(0).getByRole('button', { name: 'Book appointment', exact: true }).click();
    await dialog().getByLabel('Appointment title', { exact: true }).fill(title);
    await dialog().getByLabel('Booked date', { exact: true }).fill(date);
    await save();
  };
  return { vehicle: scopedVehicle, dialog, overview, close, save, snapshot, booking };
}
async function download(button, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const result = await pending;
  const target = path.join(artifactDir, name);
  await result.saveAs(target);
  assert.equal(await result.failure(), null, `Download ${button} failed`);
  assert(result.suggestedFilename().startsWith('sample-maintenance-') && result.suggestedFilename().includes(fixedDate.slice(0, 10)), 'Download must be explicitly labeled sample and use the fixed browser date');
  report.downloads.push({ action: button, suggestedFilename: result.suggestedFilename(), artifact: name });
  return target;
}
async function assertText(locator, pattern) {
  const matching = locator.filter({ hasText: pattern });
  await matching.waitFor();
  assert.match(await matching.textContent(), pattern);
}

async function photoWorkflow(vehicle, snapshot) {
  let imageBuffer;
  await check('actual-photo-upload-resize-and-local-fallback', async () => {
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
      const context = canvas.getContext('2d'); context.fillStyle = '#123456'; context.fillRect(0, 0, 1600, 900);
      context.fillStyle = '#f0f0f0'; context.font = '70px sans-serif'; context.fillText('Synthetic manager photo', 80, 400);
      return canvas.toDataURL('image/png');
    });
    imageBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    await vehicle(0).getByLabel('Upload Mav 1 photo', { exact: true }).setInputFiles({ name: 'synthetic-manager.png', mimeType: 'image/png', buffer: imageBuffer });
    await page.getByRole('status').filter({ hasText: 'Sample photo saved for this session.' }).waitFor();
    const image = vehicle(0).getByRole('img', { name: 'Mav 1 vehicle', exact: true });
    await page.waitForFunction(() => document.querySelector('img[alt="Mav 1 vehicle"]')?.naturalWidth > 0);
    const size = await image.evaluate(element => ({ width: element.naturalWidth, height: element.naturalHeight, src: element.src }));
    assert(Math.max(size.width, size.height) <= 640 && size.width > 0);
    assert(size.src.length <= 300 * 1024 && size.src.startsWith('data:image/jpeg'));
    await image.evaluate(element => { element.src = 'data:image/png;base64,aW52YWxpZCBwaXhlbHM='; });
    await page.waitForFunction(() => document.querySelector('img[alt="Mav 1 vehicle"]')?.src.startsWith('data:image/svg+xml'));
    assert.match(decodeURIComponent(await image.getAttribute('src')), /No photo/);
    await image.scrollIntoViewIfNeeded();
    await screenshot('desktop-photo-fallback');
    const saved = (await snapshot('photo-upload')).vehicles[0].imageUrl;
    assert(saved.startsWith('data:image/jpeg'), 'Rendered fallback must not overwrite stored sample photo');
  });
  await check('invalid-photo-keeps-existing-and-reversible-remove-restore', async () => {
    const before = (await snapshot('before-invalid-photo')).vehicles[0].imageUrl;
    await vehicle(0).getByLabel('Upload Mav 1 photo', { exact: true }).setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid pixels') });
    await assertText(page.getByRole('alert'), /Could not decode this image/);
    assert.equal((await snapshot('after-invalid-photo')).vehicles[0].imageUrl, before);
    await vehicle(0).getByLabel('Upload Mav 1 photo', { exact: true }).setInputFiles({ name: 'unsupported.gif', mimeType: 'image/gif', buffer: imageBuffer });
    await assertText(page.getByRole('alert'), /Choose a JPEG, PNG, or WebP/);
    await vehicle(0).getByLabel('Upload Mav 1 photo', { exact: true }).setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await assertText(page.getByRole('alert'), /no larger than 5MB/);
    await vehicle(0).getByRole('button', { name: 'Remove Mav 1 photo', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Sample photo removed for this session.' }).waitFor();
    assert.equal(await vehicle(0).getByRole('img', { name: 'Mav 1 vehicle', exact: true }).count(), 0);
    assert.equal((await snapshot('photo-removed')).vehicles[0].imageUrl, '');
    await vehicle(0).getByRole('button', { name: 'Restore Mav 1 photo', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Sample photo restored for this session.' }).waitFor();
    assert.equal((await snapshot('photo-restored')).vehicles[0].imageUrl, before);
    await vehicle(0).getByRole('img', { name: 'Mav 1 vehicle', exact: true }).scrollIntoViewIfNeeded();
    await screenshot('desktop-own-photo');
  });
}

async function equipmentWorkflow(snapshot, originalBrush) {
  const equipment = () => page.getByRole('region', { name: 'Equipment service', exact: true });
  await check('equipment-unknown-draft-baseline-source-and-hours', async () => {
    const action = page.getByRole('region', { name: 'Equipment maintenance actions', exact: true }).locator('li').filter({ hasText: 'Pressure washer hose' });
    await action.getByRole('button', { name: /Review equipment service/ }).click();
    const region = equipment();
    assert.equal(await region.getByLabel('Equipment', { exact: true }).inputValue(), 'sample-hose');
    assert.match(await region.textContent(), /Service schedule and history are unknown/);
    await region.getByRole('button', { name: 'Save measured hours', exact: true }).click();
    assert.match(await region.getByRole('alert').textContent(), /actual measured operating hours/);
    await region.getByLabel('Measured operating hours', { exact: true }).fill('20');
    await region.getByRole('button', { name: 'Save measured hours', exact: true }).click();
    await region.getByRole('status').filter({ hasText: 'Measured hours saved.' }).waitFor();
    await region.getByLabel('Measured operating hours', { exact: true }).fill('19');
    await region.getByRole('button', { name: 'Save measured hours', exact: true }).click();
    assert.match(await region.getByRole('alert').textContent(), /less than the previous/);
    await region.getByRole('button', { name: 'Add service rule', exact: true }).click();
    await region.getByLabel('Rule title', { exact: true }).fill('Synthetic hose check');
    await region.getByLabel('Rule interval hours', { exact: true }).fill('100');
    await region.getByRole('button', { name: 'Save rule draft', exact: true }).click();
    await region.getByRole('button', { name: 'Edit Synthetic hose check rule', exact: true }).waitFor();
    assert.match(await region.textContent(), /needs setup|needs_setup/);
    await region.getByRole('button', { name: 'Edit Synthetic hose check rule', exact: true }).click();
    await region.getByLabel('Rule source', { exact: true }).fill('Synthetic hose fixture policy only');
    await region.getByLabel('Baseline date', { exact: true }).fill('2026-09-01');
    await region.getByLabel('Baseline hours', { exact: true }).fill('0');
    await region.getByLabel(/I verified this schedule/).check();
    await region.getByLabel('Baseline hours', { exact: true }).fill('1');
    assert.equal(await region.getByLabel(/I verified this schedule/).isChecked(), false);
    await region.getByLabel(/I verified this schedule/).check();
    await region.getByRole('button', { name: 'Save verified rule', exact: true }).click();
    await region.getByRole('button', { name: 'Edit Synthetic hose check rule', exact: true }).waitFor();
    assert.match(await region.textContent(), /Due at 101 operating hours/);
  });
  await check('equipment-hour-service-history-and-replacement-independence', async () => {
    const region = equipment();
    await region.getByLabel('Equipment', { exact: true }).selectOption('sample-brush');
    await region.getByLabel('Measured operating hours', { exact: true }).fill('160');
    await region.getByRole('button', { name: 'Save measured hours', exact: true }).click();
    await region.getByRole('status').filter({ hasText: 'Measured hours saved.' }).waitFor();
    await region.getByRole('button', { name: 'Record completed service', exact: true }).click();
    await region.getByRole('button', { name: 'Save completed service', exact: true }).click();
    assert.match(await region.getByRole('alert').textContent(), /Record measured service hours/);
    await region.getByLabel('Service measured hours', { exact: true }).fill('155');
    await region.getByLabel('Service date', { exact: true }).fill('2026-10-09');
    assert.equal(await region.getByLabel('Service date', { exact: true }).evaluate(element => element.validity.rangeOverflow), true);
    await region.getByRole('button', { name: 'Save completed service', exact: true }).click();
    assert.equal(await region.getByLabel('Service date', { exact: true }).count(), 1, 'Native date validation must keep future service form open');
    await region.getByLabel('Service date', { exact: true }).fill('2026-10-08');
    await region.getByLabel('Service measured hours', { exact: true }).fill('161');
    await region.getByRole('button', { name: 'Save completed service', exact: true }).click();
    assert.match(await region.getByRole('alert').textContent(), /Record current operating hours/);
    await region.getByLabel('Service measured hours', { exact: true }).fill('155');
    await region.getByLabel('Service date', { exact: true }).fill('2026-10-08');
    await region.getByRole('button', { name: 'Save completed service', exact: true }).click();
    await region.getByRole('status').filter({ hasText: 'Completed service saved.' }).waitFor();
    assert.match(await region.textContent(), /Due at 255 operating hours/);
    const brush = (await snapshot('equipment-serviced')).equipment.find(item => item.id === 'sample-brush');
    assert.equal(brush.operatingHours, 160);
    assert.equal(brush.serviceHistory.length, originalBrush.serviceHistory.length + 1);
    assert.equal(brush.serviceHistory.at(-1).hours, 155);
    assert(brush.serviceHistory.at(-1).recordedAt && brush.serviceHistory.at(-1).recordedBy);
    for (const key of ['carsUsed', 'expectedCars', 'lifespanEnabled', 'lifespanMode']) assert.equal(brush[key], originalBrush[key]);
    await region.scrollIntoViewIfNeeded();
    await screenshot('desktop-equipment-service');
    await page.setViewportSize({ width: 390, height: 844 });
    await region.getByRole('button', { name: 'Edit Synthetic cleaning service rule', exact: true }).click();
    await layout('mobile-equipment-rule');
    await region.getByLabel('Rule title', { exact: true }).scrollIntoViewIfNeeded();
    await screenshot('mobile-equipment-rule');
    await region.getByRole('button', { name: 'Cancel rule', exact: true }).click();
    // Leave an explicit unconfirmed draft to exercise pinned unresolved equipment work.
    await region.getByRole('button', { name: 'Add service rule', exact: true }).click();
    await region.getByLabel('Rule title', { exact: true }).fill('Synthetic pending equipment rule');
    await region.getByRole('button', { name: 'Save rule draft', exact: true }).click();
    await region.getByRole('button', { name: 'Edit Synthetic pending equipment rule rule', exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: 'Fleet overview', exact: true }).click();
  });
}

async function timelineWorkflow() {
  const { dialog, close } = workflowHelpers();
  await check('timeline-current-calendar-mileage-and-booking-actions', async () => {
    await page.getByRole('tab', { name: 'Maintenance timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByRole('button', { name: /^28,600 mi · current$/ }).click();
    assert.equal(await dialog().getByRole('heading', { name: 'Confirm current mileage', exact: true }).count(), 1);
    await close();
    await page.getByRole('button').filter({ hasText: 'Today · 2026-10-08' }).first().click();
    assert.equal(await dialog().getByRole('heading', { name: 'Confirm current mileage', exact: true }).count(), 1);
    await close();
    await page.getByRole('button', { name: 'Mileage', exact: true }).click();
    await page.getByTitle(/^Current reading: 28,600 mi/).click();
    assert.equal(await dialog().getByRole('heading', { name: 'Confirm current mileage', exact: true }).count(), 1);
    await close();
    const completed = page.getByTitle(/^Completed: Synthetic coolant:/);
    await completed.click();
    assert.equal(await dialog().getByLabel(/^Service rule/).locator('option:checked').textContent(), 'Synthetic coolant');
    await close();
    const overlap = await page.locator('[data-marker-group]').evaluateAll(groups => groups.flatMap(group => {
      const boxes = [...group.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return boxes.slice(1).filter((box, index) => box.top < boxes[index].bottom - 1).map(() => group.dataset.markerGroup);
    }));
    assert.deepEqual(overlap, [], 'Mileage marker labels overlap');
    await screenshot('desktop-mileage-markers');
    await page.getByRole('button', { name: 'Upcoming work', exact: true }).click();
    const estimate = page.getByRole('button').filter({ hasText: 'Synthetic coolant' }).filter({ hasText: 'Estimated' }).first();
    await estimate.click();
    assert.equal(await dialog().getByLabel(/^Service rule/).locator('option:checked').textContent(), 'Synthetic coolant');
    await close();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const scroll = page.getByLabel('Synchronized truck timelines', { exact: true });
    await scroll.scrollIntoViewIfNeeded();
    await layout('mobile-contained-calendar');
    const header = scroll.locator('header').first();
    const before = await header.boundingBox();
    await scroll.evaluate(element => { element.scrollTop = 400; element.scrollLeft = 500; });
    const after = await header.boundingBox();
    assert(Math.abs(after.y - before.y) <= 2, 'Timeline headers should remain sticky during internal scrolling');
    assert.equal(await page.evaluate(() => document.documentElement.scrollLeft), 0);
    await screenshot('mobile-contained-calendar');
    await scroll.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
}

async function preferencesWorkflow(snapshot) {
  const { overview, vehicle, dialog, save } = workflowHelpers();
  const widgets = () => page.locator('[data-analytics-widget]').evaluateAll(elements => elements.map(element => element.dataset.analyticsWidget));
  const openPreferences = async () => {
    const details = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Customize overview layout' }) });
    if (!await details.evaluate(element => element.open)) await details.locator('summary').click();
  };
  const pinned = async () => {
    for (const name of ['Weekly maintenance actions', 'Vehicle identity setup', 'Equipment maintenance actions', 'Equipment replacement reviews']) assert.equal(await page.getByRole('region', { name, exact: true }).count(), 1, `${name} must remain visible outside hidden widgets`);
  };
  await check('keyboard-preferences-change-actual-dom-and-hide-keeps-actions', async () => {
    await overview();
    // Preserve a visible setup gap so hiding the vehicle widget proves pinned setup.
    await vehicle(2).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByLabel('Engine / configuration', { exact: true }).fill('');
    await save();
    await page.getByLabel('Search trucks', { exact: true }).fill('No matching synthetic truck');
    assert.equal(await page.locator('[data-analytics-widget="vehicles"] article').count(), 0);
    await pinned();
    await page.getByLabel('Search trucks', { exact: true }).fill('');
    await openPreferences();
    assert.deepEqual(await widgets(), ['metrics', 'outlook', 'vehicles', 'equipment']);
    const up = page.getByRole('button', { name: 'Move Vehicle overview up', exact: true });
    await up.focus(); await page.keyboard.press('Enter');
    assert.deepEqual(await widgets(), ['metrics', 'vehicles', 'outlook', 'equipment']);
    await up.focus(); await page.keyboard.press('Space');
    assert.deepEqual(await widgets(), ['vehicles', 'metrics', 'outlook', 'equipment']);
    for (const label of ['Fleet metrics', 'Service outlook', 'Vehicle overview', 'Equipment service']) await page.getByRole('checkbox', { name: `Show ${label}`, exact: true }).uncheck();
    assert.deepEqual(await widgets(), []);
    await pinned();
    const key = `sunny.analytics.layout.v1:${userId}`;
    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), key));
    assert.deepEqual(saved.order, ['vehicles', 'metrics', 'outlook', 'equipment']);
    assert.equal(saved.hidden.length, 4);
    await screenshot('mobile-pinned-hidden-widgets');
  });
  await check('preferences-persist-on-reload-and-mobile-dom-order', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).waitFor();
    assert.deepEqual(await widgets(), []);
    await enterSample();
    await openPreferences();
    for (const label of ['Fleet metrics', 'Service outlook', 'Vehicle overview', 'Equipment service']) await page.getByRole('checkbox', { name: `Show ${label}`, exact: true }).check();
    await vehicle(2).getByRole('button', { name: /Vehicle & schedule setup/ }).click();
    await dialog().getByLabel('Engine / configuration', { exact: true }).fill('');
    await save();
    await pinned();
    assert.deepEqual(await widgets(), ['vehicles', 'metrics', 'outlook', 'equipment']);
    await layout('mobile-preference-order');
    await screenshot('mobile-preference-order');
  });
  // Explicit local fixture setup; session switching is not a fleet form write.
  stage = 'synthetic-preference-owner-fixture';
  const secondId = 'browser-synthetic-manager-two';
  await page.evaluate(({ secondId, fixedDate }) => {
    localStorage.setItem('sunny_users', JSON.stringify([{ id: secondId, name: 'Second synthetic manager', role: 'manager', status: 'active' }]));
    localStorage.setItem('sunny_session', JSON.stringify({ userId: secondId, role: 'manager', issuedAt: fixedDate, expiresAt: new Date(Date.parse(fixedDate) + 12 * 3600000).toISOString() }));
    localStorage.setItem('sunny_current_user_id', secondId);
  }, { secondId, fixedDate });
  await check('different-manager-keeps-independent-layout', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).waitFor();
    assert.deepEqual(await widgets(), ['metrics', 'outlook', 'vehicles', 'equipment']);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), `sunny.analytics.layout.v1:${secondId}`), null);
  });
  stage = 'restore-original-synthetic-owner-fixture';
  await page.evaluate(fixture => {
    for (const key of ['sunny_users', 'sunny_session', 'sunny_current_user_id']) localStorage.setItem(key, fixture[key]);
  }, fixture);
  await check('original-manager-layout-restored-and-reset', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: /Keep your fleet/ }).waitFor();
    assert.deepEqual(await widgets(), ['vehicles', 'metrics', 'outlook', 'equipment']);
    await enterSample();
    await openPreferences();
    await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
    assert.deepEqual(await widgets(), ['metrics', 'outlook', 'vehicles', 'equipment']);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), `sunny.analytics.layout.v1:${userId}`), null);
    for (const name of ['Weekly maintenance actions', 'Equipment maintenance actions', 'Equipment replacement reviews']) assert.equal(await page.getByRole('region', { name, exact: true }).count(), 1);
    await snapshot('reset-default-sample');
  });
}
