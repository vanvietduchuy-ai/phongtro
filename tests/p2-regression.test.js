const assert = require('assert');
const P2 = require('../p2.js');
const { loadServer, addBaseServerData } = require('./p0-regression.test.js');

function testCanonicalPipeline() {
  assert.deepEqual(P2.PIPELINE, [
    'new', 'contacted', 'appointment_confirmed', 'viewed', 'reserved', 'converted', 'lost'
  ]);
  assert.deepEqual(P2.PIPELINE.map(k => P2.PIPELINE_LABELS[k]), [
    'Yêu cầu mới', 'Đã liên hệ', 'Đã hẹn', 'Đã xem', 'Giữ chỗ', 'Ký hợp đồng', 'Không phù hợp'
  ]);
}

function testAppointmentHelpers() {
  const list = [
    { id: 'a1', roomId: 'r1', customerName: 'Nguyễn An', customerPhone: '0901', date: '2026-09-01', time: '09:00', status: 'appointment_confirmed' },
    { id: 'a2', roomId: 'r1', customerName: 'Bình', customerPhone: '0902', date: '2026-09-01', time: '10:00', status: 'lost' },
    { id: 'a3', roomId: 'r2', customerName: 'Chi', customerPhone: '0903', date: '2026-09-02', time: '09:00', status: 'new' }
  ];
  assert.equal(P2.appointmentClash(list, { roomId: 'r1', date: '2026-09-01', time: '09:00' }, ''), list[0]);
  assert.equal(P2.appointmentClash(list, { roomId: 'r1', date: '2026-09-01', time: '10:00' }, ''), null, 'lead đã đóng không khóa lịch');
  assert.equal(P2.appointmentClash(list, { roomId: 'r1', date: '2026-09-01', time: '09:00' }, 'a1'), null, 'bản ghi đang sửa không tự trùng chính nó');
  assert.deepEqual(P2.filterAppointments(list, { q: 'nguyễn', status: 'open' }).map(x => x.id), ['a1']);
  assert.deepEqual(P2.filterAppointments(list, { status: 'open', from: '2026-09-02' }).map(x => x.id), ['a3']);
}

function testDashboardAndMapHelpers() {
  assert.equal(P2.occupancyRate([{ status: 'occupied' }, { status: 'reserved' }, { status: 'available' }, { status: 'maintenance' }]), 25,
    'giữ chỗ không được tính là phòng đã lấp đầy');
  assert(P2.mapUrl('12 Lê Lợi, Đông Hà').startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert(P2.mapUrl('12 Lê Lợi, Đông Hà').includes('%C4%90%C3%B4ng'));
}

function testAtomicRescheduleServer() {
  const s = loadServer(); addBaseServerData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  s.appendRecord('appointments', { id: 'a2', roomId: 'r1', customerName: 'Bình', customerPhone: '0900000002', date: '2099-01-02', time: '10:00', note: '', status: 'appointment_confirmed', createdAt: '2098-12-02T00:00:00.000Z', source: 'website', careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: '' });

  const clash = s.handleRescheduleAppointment({ appointmentId: 'a1', date: '2099-01-02', time: '10:00' }, ctx);
  assert.equal(clash.ok, false, 'máy chủ phải chặn hai khách cùng phòng, ngày và giờ');
  assert.equal(s.serverRecordById('appointments', 'a1').time, '09:00');

  const moved = s.handleRescheduleAppointment({ appointmentId: 'a1', date: '2099-01-02', time: '11:00' }, ctx);
  assert.equal(moved.ok, true, moved.error);
  const saved = s.serverRecordById('appointments', 'a1');
  assert.equal(saved.date, '2099-01-02');
  assert.equal(saved.time, '11:00');
  assert(saved.careLog.some(x => x.channel === 'reschedule'), 'đổi lịch phải có lịch sử chăm sóc');
}

function testResidentPortalDtos() {
  const s = loadServer();
  const invoice = s.toResidentInvoiceDTO({ id: 'i1', rent: 2000000, electric: 120000, water: 80000, other: 50000,
    serviceLines: [{ name: 'Wifi', amount: 100000 }], discountAmount: 50000, discountNote: 'Ưu đãi', total: 2300000,
    amountPaid: 1000000, internalSecret: 'không được lộ' });
  assert.equal(invoice.rent, 2000000);
  assert.equal(invoice.serviceLines[0].name, 'Wifi');
  assert.equal(invoice.internalSecret, undefined);
  const handover = s.toResidentHandoverDTO({ id: 'h1', phase: 'checkin', name: 'Chìa khóa', quantity: 2, condition: 'Tốt', note: 'Đã nhận', imageIds: ['img1'] });
  assert.equal(handover.quantity, 2);
  assert.deepEqual(Array.from(handover.imageIds), ['img1']);
  assert.equal(s.toResidentLeaseDTO({ id: 'l1', moveInAt: '2026-08-15' }).moveInAt, '2026-08-15');
}

testCanonicalPipeline();
testAppointmentHelpers();
testDashboardAndMapHelpers();
testAtomicRescheduleServer();
testResidentPortalDtos();
console.log('P2 regression tests: PASS');
