const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../api/_supabase-core');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

function snapshot(data, revision = 100) {
  return { revision, data: Object.assign({}, data) };
}
function owner() { return { authenticated: true, role: 'owner', staffName: 'Chủ nhà', staffId: '', propertyIds: [] }; }

function testStaticArchitecture() {
  const config = read('config.js');
  const html = read('index.html');
  const realtime = read('realtime.js');
  const api = read('api/supabase.js') + read('api/_supabase-core.js');
  const schema = read('supabase/schema.sql');
  const vercel = read('vercel.json');
  const sw = read('sw.js');

  assert(config.includes("'/api/supabase'"), 'frontend phải dùng API Supabase');
  assert(config.includes("backendId: 'supabase-v1'"), 'phải version hóa backend để thu hồi token Apps Script cũ');
  assert(read('sync.js').includes('backendChanged ? \'\' : (saved.token'), 'đổi backend phải xóa token cũ');
  assert(html.includes('<script src="realtime.js"></script>'), 'phải nạp client Realtime');
  assert(realtime.includes("'postgres_changes'"), 'Realtime phải nghe Postgres Changes');
  assert(realtime.includes("table: self.cfg.table"), 'Realtime chỉ nghe bảng signal');
  assert(realtime.includes('replication_ready: true'), 'phải chờ replication sẵn sàng');
  assert(api.includes('SUPABASE_SECRET_KEY'), 'API server phải đọc secret từ env');
  assert(!config.includes('SERVICE_ROLE') && !html.includes('SERVICE_ROLE'), 'không được lộ service role ở frontend');
  assert(schema.includes('create schema if not exists huy_private'), 'dữ liệu phải nằm trong schema private');
  assert(schema.includes('huy_commit_batch'), 'phải có RPC transaction CAS');
  assert(schema.includes("v_collection in ('payments', 'depositLedger')"), 'SQL phải khóa sổ append-only');
  assert(schema.includes('enable row level security'), 'signal public phải bật RLS');
  assert(schema.includes('alter publication supabase_realtime'), 'signal phải được bật Realtime');
  assert(vercel.includes('wss://*.supabase.co'), 'CSP phải cho phép Supabase WebSocket');
  assert(sw.includes('realtime.js'), 'PWA shell phải cache client Realtime');
}

function baseData() {
  return {
    properties: [{ id: 'p1', name: 'Daily Home', updatedAt: 10 }],
    rooms: [{ id: 'r1', propertyId: 'p1', name: 'P101', status: 'available', updatedAt: 10 }],
    tenants: [], utilityReadings: [], invoices: [], appointments: [], reservations: [],
    leases: [], leaseOccupants: [], accounts: [], assets: [], handoverItems: [],
    serviceDefinitions: [], leaseServices: [], payments: [], depositLedger: [], reminders: [],
    maintenanceTickets: [], notifications: [], staffUsers: [], settings: [{ id: 'app', brandName: 'Huy Rooms', updatedAt: 10 }]
  };
}

function testOptimisticConflict() {
  const data = baseData();
  data.rooms[0].price = 3800000;
  data.rooms[0].updatedAt = 200;
  const result = core.sanitizeChanges({ rooms: [{ id: 'r1', propertyId: 'p1', name: 'P101', status: 'available', price: 4000000, baseUpdatedAt: 100 }] }, owner(), snapshot(data, 200));
  assert.strictEqual(result.conflicts.length, 1, 'bản cũ không được ghi đè bản mới');
  assert.strictEqual(Object.keys(result.accepted).length, 0, 'conflict không được commit');
  assert.strictEqual(result.conflicts[0].serverRecord.price, 3800000);
}

function testPrivateHashPreserved() {
  const data = baseData();
  data.tenants.push({ id: 't1', name: 'An', phone: '0900000000', active: false, pinHashV2: 'secret-hash', updatedAt: 100 });
  const result = core.sanitizeChanges({ tenants: [{ id: 't1', name: 'An mới', phone: '0900000000', active: false, hasPin: true, baseUpdatedAt: 100 }] }, owner(), snapshot(data, 100));
  assert.strictEqual(result.accepted.tenants[0].pinHashV2, 'secret-hash', 'sửa hồ sơ không được xóa hash PIN');
  assert(!('hasPin' in result.accepted.tenants[0]), 'cờ DTO không được lưu vào DB');
}

function testLedgerImmutable() {
  const data = baseData();
  data.payments.push({ id: 'pay1', invoiceId: 'i1', kind: 'payment', amount: 1000000, updatedAt: 100 });
  let result = core.sanitizeChanges({ payments: [{ id: 'pay1', invoiceId: 'i1', kind: 'payment', amount: 2000000, baseUpdatedAt: 100 }] }, owner(), snapshot(data, 100));
  assert.strictEqual(result.rejected.length, 1, 'không được sửa bút toán đã tồn tại');
  assert.match(result.rejected[0].reason, /bất biến/i);

  const original = data.payments[0];
  result = core.sanitizeChanges({ payments: [
    Object.assign({}, original, { reversedAt: '2026-08-15T10:00:00.000Z', reversalReason: 'Nhập nhầm', baseUpdatedAt: 100 }),
    { id: 'pay2', invoiceId: 'i1', kind: 'reversal', amount: -1000000, paidAt: '2026-08-15', reversalOf: 'pay1', updatedAt: 0 }
  ] }, owner(), snapshot(data, 100));
  assert.strictEqual(result.rejected.length, 0, 'đảo giao dịch hợp lệ phải tạo bút toán âm + đánh dấu bản gốc');
  assert.strictEqual(result.accepted.payments.length, 2);
}

function testRoomStatusPriority() {
  const data = baseData();
  data.rooms[0].status = 'maintenance';
  data.reservations.push({ id: 'res1', roomId: 'r1', status: 'active', updatedAt: 30 });
  let result = core.sanitizeChanges({ reservations: [{ id: 'res1', roomId: 'r1', status: 'active', note: 'x', baseUpdatedAt: 30 }] }, owner(), snapshot(data, 30));
  assert.strictEqual(result.accepted.rooms[0].status, 'reserved', 'giữ chỗ phải ưu tiên hơn bảo trì');

  data.rooms[0].status = 'reserved';
  data.leases.push({ id: 'l1', roomId: 'r1', status: 'active', primaryTenantId: 't1', updatedAt: 40 });
  data.tenants.push({ id: 't1', roomId: 'r1', active: true, updatedAt: 40 });
  result = core.sanitizeChanges({ rooms: [{ id: 'r1', propertyId: 'p1', name: 'P101', status: 'reserved', baseUpdatedAt: 10 }] }, owner(), snapshot(data, 40));
  assert.strictEqual(result.accepted.rooms[0].status, 'occupied', 'đang thuê phải có ưu tiên cao nhất');
}

function testDraftNeedsHeldDeposit() {
  const data = baseData();
  data.leases.push({ id: 'l1', roomId: 'r1', status: 'draft', updatedAt: 20 });
  let idx = core.indexState(snapshot(data, 20));
  const changes = {}, audit = [];
  core.reconcileRooms(idx, changes, audit, new Set(['r1']));
  assert(!changes.rooms, 'hợp đồng nháp chưa cọc không được khóa phòng');

  data.depositLedger.push({ id: 'dep1', leaseId: 'l1', type: 'collect', amount: 1000000, updatedAt: 21 });
  idx = core.indexState(snapshot(data, 21));
  const changes2 = {};
  core.reconcileRooms(idx, changes2, [], new Set(['r1']));
  assert.strictEqual(changes2.rooms[0].status, 'reserved', 'hợp đồng nháp còn cọc phải khóa phòng');

  data.depositLedger = [{ id: 'dep2', leaseId: '', reservationId: 'res2', type: 'collect', amount: 500000, updatedAt: 22 }];
  data.reservations = [{ id: 'res2', roomId: 'r1', leaseId: 'l1', status: 'converted', updatedAt: 22 }];
  data.rooms[0].status = 'available';
  idx = core.indexState(snapshot(data, 22));
  const changes3 = {};
  core.reconcileRooms(idx, changes3, [], new Set(['r1']));
  assert.strictEqual(changes3.rooms[0].status, 'reserved', 'cọc từ phiếu đã chuyển sang HĐ vẫn phải khóa phòng');
}

function testArchiveGuardAndScope() {
  const data = baseData();
  data.leases.push({ id: 'l1', roomId: 'r1', status: 'active', updatedAt: 20 });
  let result = core.sanitizeChanges({ rooms: [{ id: 'r1', propertyId: 'p1', name: 'P101', status: 'occupied', archived: true, baseUpdatedAt: 10 }] }, owner(), snapshot(data, 20));
  assert.strictEqual(result.rejected.length, 1, 'không được lưu trữ phòng có hợp đồng');

  const staff = { authenticated: true, role: 'manager', staffName: 'QL', staffId: 's1', propertyIds: ['p2'] };
  result = core.sanitizeChanges({ rooms: [{ id: 'r1', propertyId: 'p1', name: 'P101', status: 'available', price: 1, baseUpdatedAt: 10 }] }, staff, snapshot(baseData(), 10));
  assert.strictEqual(result.scopeSkipped.length, 1, 'quản lý không được sửa căn ngoài phạm vi');
}

function testScriptsAndDocs() {
  ['scripts/import-supabase.mjs', 'scripts/export-supabase.mjs', 'scripts/verify-supabase.mjs', 'HUONG-DAN-SUPABASE-REALTIME.md'].forEach((name) => assert(fs.existsSync(path.join(ROOT, name)), `${name} phải tồn tại`));
  const guide = read('HUONG-DAN-SUPABASE-REALTIME.md');
  assert(guide.includes('HUY_MIGRATION_KEY'));
  assert(guide.includes('rollback'));
  assert(guide.includes('không promote Production'));
}

testStaticArchitecture();
testOptimisticConflict();
testPrivateHashPreserved();
testLedgerImmutable();
testRoomStatusPriority();
testDraftNeedsHeldDeposit();
testArchiveGuardAndScope();
testScriptsAndDocs();
console.log('v4.7 Supabase Realtime tests: PASS');
