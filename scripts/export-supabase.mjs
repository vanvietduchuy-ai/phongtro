#!/usr/bin/env node
import fs from 'node:fs/promises';

const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; }
const baseUrl = flag('--url').replace(/\/$/, '');
const migrationKey = flag('--key');
const output = flag('--out') || `huy-rooms-supabase-${new Date().toISOString().slice(0, 10)}.json`;
if (!baseUrl || !migrationKey) {
  console.error('Cách dùng: node scripts/export-supabase.mjs --url https://ten-mien.vercel.app --key KHOA_MIGRATION [--out backup.json]');
  process.exit(2);
}
const response = await fetch(`${baseUrl}/api/supabase`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'exportSnapshot', migrationKey })
});
const result = await response.json();
if (!response.ok || !result.ok) {
  console.error(`EXPORT THẤT BẠI: ${result.error || response.statusText}`);
  process.exit(1);
}
await fs.writeFile(output, JSON.stringify(result.data, null, 2));
console.log(`Đã xuất revision ${result.serverTime} → ${output}`);
