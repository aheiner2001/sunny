import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const expected = process.env.EXPECTED_BASE_PATH;
assert.ok(expected === '/sunny' || expected === '', 'Set EXPECTED_BASE_PATH to /sunny or an empty string');

const { config } = JSON.parse(readFileSync('.next/required-server-files.json', 'utf8'));
assert.equal(config.basePath || '', expected, 'Next.js route base path changed');
assert.equal(config.assetPrefix || '', expected ? `${expected}/` : '', 'Static asset prefix changed');
assert.equal(config.env?.NEXT_PUBLIC_APP_BASE_PATH, expected, 'QR and logo base path changed');
assert.ok(existsSync('out/return.html'), 'Return page is missing from the export');
assert.ok(existsSync('out/inspect.html'), 'Vehicle inspection page is missing from the export');
assert.ok(existsSync('out/sunny-logo.png'), 'QR logo is missing from the export');

const html = readFileSync('out/return.html', 'utf8');
assert.ok(html.includes(`"${expected}/_next/`), 'Return page has an unexpected script URL');
console.log(`Hosting paths verified for ${expected || '/'} deployment`);
