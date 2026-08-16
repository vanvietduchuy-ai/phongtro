#!/usr/bin/env node
const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; }
const baseUrl = flag('--url').replace(/\/$/, '');
const password = flag('--password');
if (!baseUrl || !password) {
  console.error('Cách dùng: node scripts/verify-supabase.mjs --url https://ten-mien.vercel.app --password MAT_KHAU_CHU_NHA');
  process.exit(2);
}
const call = async (payload) => {
  const response = await fetch(`${baseUrl}/api/supabase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
};
const login = await call({ action: 'login', password, deviceName: 'Kiem tra migration' });
const full = await call({ action: 'sync', token: login.token, since: 0, changes: {} });
const counts = Object.fromEntries(Object.entries(full.changes || {}).map(([name, rows]) => [name, Array.isArray(rows) ? rows.filter((x) => !x.deleted).length : 0]));
const rows = (name) => (full.changes && full.changes[name] || []).filter((x) => !x.deleted);
const paymentNet = rows('payments').reduce((sum, item) => sum + Number(item.amount || 0), 0);
const depositHeld = rows('depositLedger').reduce((sum, item) => sum + (item.type === 'collect' ? 1 : -1) * Number(item.amount || 0), 0);
const invoiceTotal = rows('invoices').reduce((sum, item) => sum + Number(item.total || 0), 0);
const roomStatus = rows('rooms').reduce((out, item) => { out[item.status || 'unknown'] = (out[item.status || 'unknown'] || 0) + 1; return out; }, {});
console.log(JSON.stringify({ ok: true, serverTime: full.serverTime, counts, totals: { paymentNet, depositHeld, invoiceTotal }, roomStatus }, null, 2));
