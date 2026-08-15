const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadServer, makeBrowserData, loadClientSync } = require('./p0-regression.test.js');

const ROOT = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');

function addLifecycleData(s, roomStatus = 'occupied') {
  s.appendRecord('properties', { id: 'p1', name: 'Nhà 1', archived: false });
  s.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', status: roomStatus, archived: false });
  s.appendRecord('tenants', { id: 't1', name: 'An', phone: '0900000001', roomId: 'r1', active: true, moveOutDate: '' });
  s.appendRecord('leases', { id: 'l1', propertyId: 'p1', roomId: 'r1', primaryTenantId: 't1', startDate: '2026-08-15', endDate: '', billingDay: 5,
    rentAmount: 2000000, depositRequired: 0, depositPaid: 0, status: 'active', signedAt: '', moveInAt: '2026-08-15', moveOutAt: '', terminationReason: '',
    note: '', createdAt: '2026-08-15T00:00:00.000Z', depositDeduct: 0, depositRefund: 0, settlementNote: '', roomHistory: [], renewals: [], statusHistory: [], documentFiles: [] });
  s.appendRecord('leaseOccupants', { id: 'lo1', leaseId: 'l1', occupantId: 't1', role: 'primary', joinedAt: '2026-08-15', leftAt: '', note: '', createdAt: '2026-08-15T00:00:00.000Z' });
}

function clientRecord(s, col, id, patch) {
  const rec = { ...s.serverRecordById(col, id), ...patch };
  rec.baseUpdatedAt = rec.updatedAt;
  delete rec._row;
  return rec;
}

function testMonotonicClientAuthority() {
  const data = makeBrowserData();
  const sync = loadClientSync(data);
  sync.snapshot();
  sync.applyRemote({ rooms: [{ id: 'r1', name: 'P101', status: 'reserved', note: 'mới', updatedAt: 30 }] });
  sync.applyRemote({ rooms: [{ id: 'r1', name: 'P101', status: 'available', note: 'cũ', updatedAt: 20 }] });
  assert.equal(data.rooms[0].status, 'reserved', 'serverRecord cũ trong conflict không được ghi đè bản reconcile mới');
  assert.equal(sync.baseStamp.rooms.r1, 30, 'baseStamp không được lùi');
  data.rooms[0].note = 'sửa tiếp';
  const change = sync.computeChanges().rooms[0];
  assert.equal(change.baseUpdatedAt, 30, 'lần sửa tiếp theo phải dựa trên mốc mới nhất');
}

function testPrimaryHalfStateIsRejected() {
  const s = loadServer(); addLifecycleData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  const response = s.handleSync({ since: 0, changes: {
    tenants: [clientRecord(s, 'tenants', 't1', { active: false, moveOutDate: '2026-08-15' })],
    leases: [clientRecord(s, 'leases', 'l1', { status: 'ended', moveOutAt: '2026-08-15' })],
    leaseOccupants: [clientRecord(s, 'leaseOccupants', 'lo1', { leftAt: '2026-08-15' })]
  } }, 'admin', ctx);
  assert(response.rejected.some(x => x.collection === 'tenants' && x.id === 't1'));
  assert(response.rejected.some(x => x.collection === 'leases' && x.id === 'l1'));
  assert(response.rejected.some(x => x.collection === 'leaseOccupants' && x.id === 'lo1'));
  assert.equal(s.serverRecordById('leases', 'l1').status, 'active');
  assert.equal(s.serverRecordById('tenants', 't1').active, true);
  assert.equal(s.serverRecordById('leaseOccupants', 'lo1').leftAt, '');
  assert.equal(s.handleLeaseTransition({ operation: 'checkout', leaseId: 'l1', date: '2026-08-15', reason: 'Hết nhu cầu', deduct: 0, note: '', handover: [] }, ctx).ok, true,
    'sau khi chặn gói sai, nghiệp vụ thanh lý chuẩn vẫn phải chạy được');
}

function testArchiveGuards() {
  const s = loadServer(); addLifecycleData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  const response = s.handleSync({ since: 0, changes: {
    properties: [clientRecord(s, 'properties', 'p1', { archived: true })],
    rooms: [clientRecord(s, 'rooms', 'r1', { archived: true })]
  } }, 'admin', ctx);
  assert(response.rejected.some(x => x.collection === 'properties' && x.id === 'p1'));
  assert(response.rejected.some(x => x.collection === 'rooms' && x.id === 'r1'));
  assert.equal(s.serverRecordById('properties', 'p1').archived, false);
  assert.equal(s.serverRecordById('rooms', 'r1').archived, false);
}

function testRoomStatePriority() {
  const occupied = loadServer(); addLifecycleData(occupied, 'maintenance');
  const out = occupied.reconcileRoomServer('r1', occupied.nextStamp());
  assert(out && out.status === 'occupied');

  const held = loadServer();
  held.appendRecord('properties', { id: 'p1', name: 'Nhà 1', archived: false });
  held.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', status: 'maintenance', archived: false });
  held.appendRecord('reservations', { id: 'res1', roomId: 'r1', sourceType: 'appointment', sourceId: 'a1', fromDate: '2026-08-15', untilDate: '2026-08-20', amount: 100000, status: 'active', depositEntryId: 'dep1' });
  assert.equal(held.reconcileRoomServer('r1', held.nextStamp()).status, 'reserved');

  const empty = loadServer();
  empty.appendRecord('properties', { id: 'p1', name: 'Nhà 1', archived: false });
  empty.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', status: 'maintenance', archived: false });
  assert.equal(empty.reconcileRoomServer('r1', empty.nextStamp()), null, 'phòng trống được phép giữ trạng thái bảo trì và không ghi stamp vô ích');
  assert.equal(empty.serverRecordById('rooms', 'r1').status, 'maintenance');
}

function testRefundedDraftDoesNotLockRoom() {
  const s = loadServer();
  s.appendRecord('properties', { id: 'p1', name: 'Nhà 1', archived: false });
  s.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', status: 'available', archived: false });
  s.appendRecord('tenants', { id: 't1', name: 'An', phone: '0900000001', roomId: '', active: false });
  s.appendRecord('leases', { id: 'l1', propertyId: 'p1', roomId: 'r1', primaryTenantId: 't1', startDate: '2026-08-15', endDate: '', billingDay: 5,
    rentAmount: 2000000, depositRequired: 500000, depositPaid: 500000, status: 'draft' });
  s.appendRecord('depositLedger', { id: 'd1', leaseId: 'l1', type: 'collect', amount: 500000, at: '2026-08-15' });
  s.appendRecord('depositLedger', { id: 'd2', leaseId: 'l1', type: 'refund', amount: 500000, at: '2026-08-15' });
  s.appendRecord('appointments', { id: 'a1', roomId: 'r1', customerName: 'Bình', customerPhone: '0900000002', date: '2099-01-01', time: '09:00', status: 'viewed' });
  const result = s.handleCreateReservation({ reservation: { id: 'res1', depositEntryId: 'dr1', roomId: 'r1', sourceType: 'appointment', sourceId: 'a1',
    fromDate: '2099-01-01', untilDate: '2099-01-03', amount: 300000, paymentMethod: 'cash', note: '' } },
    { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] });
  assert.equal(result.ok, true, result.error);
}

function testRepairLifecycleIntegrity() {
  const s = loadServer(); addLifecycleData(s, 'maintenance');
  const tenant = s.serverRecordById('tenants', 't1'); tenant.active = false; tenant.moveOutDate = '2026-08-15';
  s.writeRecordAtStamp('tenants', tenant, s.nextStamp());
  const link = s.serverRecordById('leaseOccupants', 'lo1'); link.leftAt = '2026-08-15';
  s.writeRecordAtStamp('leaseOccupants', link, s.nextStamp());
  assert(s.repairLifecycleIntegrity() >= 2);
  assert.equal(s.serverRecordById('tenants', 't1').active, true);
  assert.equal(s.serverRecordById('tenants', 't1').roomId, 'r1');
  assert.equal(s.serverRecordById('leaseOccupants', 'lo1').leftAt, '');
  assert.equal(s.serverRecordById('rooms', 'r1').status, 'occupied');
  assert.equal(s.repairLifecycleIntegrity(), 0, 'chạy migration lần hai phải idempotent');
}

function testStaticClientGuards() {
  assert(appSource.includes("['draft','active','ending'].includes(l.status)"), 'client phải chặn lưu trữ phòng/căn còn hợp đồng mở');
  assert(appSource.includes('Hãy dùng chức năng Trả phòng/Thanh lý'), 'xóa người đại diện phải hướng về action nguyên tử');
  assert(serverSource.includes('leaseHeldWithIncomingServer'), 'máy chủ phải suy tiền giữ từ ledger');
  assert(serverSource.includes('if (room.status === target) return null;'), 'reconcile không được restamp no-op');
}

testMonotonicClientAuthority();
testPrimaryHalfStateIsRejected();
testArchiveGuards();
testRoomStatePriority();
testRefundedDraftDoesNotLockRoom();
testRepairLifecycleIntegrity();
testStaticClientGuards();
console.log('v4.6.6 room sync hotfix tests: PASS');
