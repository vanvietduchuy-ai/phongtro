#!/usr/bin/env node
import fs from 'node:fs/promises';

function usage() {
  console.error('Cách dùng: node scripts/import-supabase.mjs <backup.json> --url https://ten-mien.vercel.app --key KHOA_MIGRATION [--force]');
  process.exit(2);
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) usage();
const file = args[0];
function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}
const baseUrl = flag('--url').replace(/\/$/, '');
const migrationKey = flag('--key');
const force = args.includes('--force');
if (!file || !baseUrl || !migrationKey) usage();

const raw = await fs.readFile(file, 'utf8');
const data = JSON.parse(raw);
const response = await fetch(`${baseUrl}/api/supabase`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'importSnapshot', migrationKey, data, force })
});
const result = await response.json();
if (!response.ok || !result.ok) {
  console.error(`IMPORT THẤT BẠI: ${result.error || response.statusText}`);
  process.exit(1);
}
console.log('IMPORT THÀNH CÔNG');
console.log(`Revision: ${result.serverTime}`);
Object.entries(result.collections || {}).forEach(([name, count]) => console.log(`- ${name}: ${count}`));
