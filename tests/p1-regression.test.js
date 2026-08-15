const assert = require('assert');
const { loadServer } = require('./p0-regression.test.js');

function seedLease(s) {
  s.appendRecord('properties', { id: 'p1', name: 'Nhà 1', archived: false });
  s.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', price: 2500000, deposit: 1000000, capacity: 2, status: 'reserved', archived: false });
  s.appendRecord('rooms', { id: 'r2', propertyId: 'p1', name: 'P102', price: 3000000, deposit: 1000000, capacity: 2, status: 'available', archived: false });
  s.appendRecord('tenants', { id: 't1', name: 'Nguyễn An', phone: '0900000001', roomId: '', active: false, depositRequired: 0, depositPaid: 0 });
  s.appendRecord('leases', {
    id: 'l1', propertyId: 'p1', roomId: 'r1', primaryTenantId: 't1', startDate: '2026-08-15', endDate: '2027-08-14', billingDay: 5,
    rentAmount: 2500000, depositRequired: 1000000, depositPaid: 1000000, status: 'draft', signedAt: '', moveInAt: '', moveOutAt: '',
    terminationReason: '', note: '', createdAt: '2026-08-15T00:00:00.000Z', depositDeduct: 0, depositRefund: 0, settlementNote: '',
    roomHistory: [], renewals: [], statusHistory: [], documentFiles: []
  });
  s.appendRecord('leaseOccupants', { id: 'lo1', leaseId: 'l1', occupantId: 't1', role: 'primary', joinedAt: '', leftAt: '', note: '', createdAt: '2026-08-15T00:00:00.000Z' });
  s.appendRecord('depositLedger', { id: 'dep1', leaseId: 'l1', type: 'collect', amount: 1000000, at: '2026-08-15', method: 'bank', note: 'Thu cọc', createdBy: 'test', createdAt: '2026-08-15T00:00:00.000Z' });
}

function testAtomicLifecycle() {
  const s = loadServer(); seedLease(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };

  const checkin = s.handleLeaseTransition({ operation: 'checkin', leaseId: 'l1', date: '2026-08-15', handover: [
    { assetId: '', name: 'Chìa khóa', quantity: 2, condition: 'Tốt' }
  ] }, ctx);
  assert.equal(checkin.ok, true, checkin.error);
  assert.equal(s.serverRecordById('leases', 'l1').status, 'active');
  assert.equal(s.serverRecordById('rooms', 'r1').status, 'occupied');
  assert.equal(s.serverRecordById('tenants', 't1').active, true);
  assert.equal(s.recordsNow('handoverItems').filter(x => x.leaseId === 'l1' && x.phase === 'checkin').length, 1);

  const transfer = s.handleLeaseTransition({ operation: 'transfer', leaseId: 'l1', date: '2026-08-15', newRoomId: 'r2', keepRent: false, newRent: 3000000,
    handoverOut: [{ name: 'Chìa khóa P101', quantity: 2, condition: 'Đủ' }],
    handoverIn: [{ name: 'Chìa khóa P102', quantity: 2, condition: 'Tốt' }]
  }, ctx);
  assert.equal(transfer.ok, true, transfer.error);
  assert.equal(s.serverRecordById('leases', 'l1').roomId, 'r2');
  assert.equal(s.serverRecordById('leases', 'l1').rentAmount, 3000000);
  assert.equal(s.serverRecordById('rooms', 'r1').status, 'available');
  assert.equal(s.serverRecordById('rooms', 'r2').status, 'occupied');
  assert.equal(s.serverRecordById('tenants', 't1').roomId, 'r2');
  assert.equal(s.recordsNow('handoverItems').filter(x => x.phase === 'transfer-out').length, 1);
  assert.equal(s.recordsNow('handoverItems').filter(x => x.phase === 'transfer-in').length, 1);

  const checkout = s.handleLeaseTransition({ operation: 'checkout', leaseId: 'l1', date: '2026-08-15', reason: 'Hết hạn nhu cầu', deduct: 200000,
    note: 'Trừ vệ sinh cuối kỳ', refundMethod: 'bank', reference: 'GD-HOAN-001', handover: [{ name: 'Chìa khóa P102', quantity: 2, condition: 'Đủ' }]
  }, ctx);
  assert.equal(checkout.ok, true, checkout.error);
  assert.equal(s.serverRecordById('leases', 'l1').status, 'ended');
  assert.equal(s.serverRecordById('rooms', 'r2').status, 'available');
  assert.equal(s.serverRecordById('tenants', 't1').active, false);
  assert.equal(s.serverRecordById('tenants', 't1').roomId, '');
  assert.equal(s.leaseDepositTotalsServer('l1').held, 0);
  assert.equal(s.recordsNow('depositLedger').filter(x => x.leaseId === 'l1' && x.type === 'deduct').length, 1);
  assert.equal(s.recordsNow('depositLedger').filter(x => x.leaseId === 'l1' && x.type === 'refund').length, 1);

  const beforeRetry = s.recordsNow('depositLedger').length;
  const retry = s.handleLeaseTransition({ operation: 'checkout', leaseId: 'l1', date: '2026-08-15', reason: 'Lặp', deduct: 0, note: '' }, ctx);
  assert.equal(retry.ok, false, 'không được thanh lý hai lần');
  assert.equal(s.recordsNow('depositLedger').length, beforeRetry, 'retry không sinh bút toán trùng');
}

function testGuards() {
  const s = loadServer(); seedLease(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  s.appendRecord('leases', { id: 'l2', propertyId: 'p1', roomId: 'r1', primaryTenantId: 't2', startDate: '2026-08-15', endDate: '', billingDay: 5, rentAmount: 2000000, depositRequired: 0, depositPaid: 0, status: 'active', moveInAt: '2026-08-15' });
  const occupied = s.handleLeaseTransition({ operation: 'checkin', leaseId: 'l1', date: '2026-08-15', handover: [] }, ctx);
  assert.equal(occupied.ok, false, 'không được nhận phòng khi có hợp đồng sống khác');

  const cancelWithMoney = s.handleLeaseTransition({ operation: 'cancel', leaseId: 'l1', date: '2026-08-15', reason: 'Khách hủy' }, ctx);
  assert.equal(cancelWithMoney.ok, false, 'không được hủy nháp khi còn cọc đang giữ');
}

function testDocumentSignatures() {
  const s = loadServer();
  assert.equal(s.documentSignature([0x25, 0x50, 0x44, 0x46, 0x2D]).mime, 'application/pdf');
  assert.equal(s.documentSignature([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0]).mime, 'image/jpeg');
  assert.equal(s.documentSignature([0x4D, 0x5A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), null, 'file thực thi giả dạng phải bị từ chối');
}

testAtomicLifecycle();
testGuards();
testDocumentSignatures();
console.log('P1 regression tests: PASS');
