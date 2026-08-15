const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadServer, addBaseServerData } = require('./p0-regression.test.js');

const ROOT = path.resolve(__dirname, '..');

function replaceServerRecord(s, collection, id, patch) {
  const before = s.serverRecordById(collection, id);
  const next = { ...before, ...patch };
  delete next._row;
  s.writeRecordAtStamp(collection, next, s.nextStamp());
}

function testPublicAvailabilityAndBookingRules() {
  const s = loadServer();
  addBaseServerData(s);

  const slugField = Array.from(s.SCHEMA.properties.fields).map(x => x[0]);
  assert(slugField.includes('slug'), 'slug căn trọ phải được lưu trong Google Sheets');
  assert.equal(s.recordsNow('properties')[0].slug, 'nha-1', 'slug phải đọc lại đúng từ máy chủ');
  s.appendRecord('properties', { id: 'p2', name: 'P101', area: '', address: '', description: '', phone: '', imageIds: [], archived: false, slug: '' });
  s.migratePropertySlugs();
  assert.equal(s.serverRecordById('properties', 'p1').slug, 'nha-1', 'migration không được đổi slug đang dùng');
  assert.equal(s.serverRecordById('properties', 'p2').slug, 'p101-2', 'migration phải tránh trùng slug phòng');

  s.appendRecord('appointments', {
    id: 'a_lost', roomId: 'r1', customerName: 'Đã đóng', customerPhone: '0900000009',
    date: '2099-01-01', time: '10:00', note: '', status: 'lost', createdAt: '2098-12-01T00:00:00.000Z',
    source: 'website', careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: ''
  });
  const free = s.handlePublicAvailability({ roomId: 'r1', date: '2099-01-01' });
  assert.equal(free.ok, true, free.error);
  assert.deepEqual(Array.from(free.busyTimes), ['09:00'], 'API công khai chỉ trả giờ bận của lead còn mở');
  assert.equal(JSON.stringify(free).includes('0900000001'), false, 'API giờ trống không được lộ số điện thoại');

  replaceServerRecord(s, 'rooms', 'r1', { status: 'occupied', availableFrom: '' });
  s.appendRecord('leases', { id: 'lease_far', roomId: 'r1', primaryTenantId: '', status: 'active', endDate: '2099-12-31', startDate: '2098-01-01' });
  const blocked = s.handleBook({
    roomId: 'r1', customerName: 'Khách mới', customerPhone: '0900000010',
    date: '2099-01-02', time: '11:00', consent: 1, source: 'website'
  });
  assert.equal(blocked.ok, false, 'phòng đang thuê lâu dài phải bị chặn đặt lịch');
  assert(/chưa đến thời điểm/.test(blocked.error), blocked.error);

  replaceServerRecord(s, 'rooms', 'r1', { availableFrom: '2099-01-15' });
  const soon = s.handlePublicAvailability({ roomId: 'r1', date: '2099-01-02' });
  assert.equal(soon.ok, true, soon.error);
}

function testGuestGetsDerivedSoonDate() {
  const s = loadServer();
  addBaseServerData(s);
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 30);
  const endDate = end.toISOString().slice(0, 10);
  replaceServerRecord(s, 'rooms', 'r1', { status: 'occupied', availableFrom: '' });
  s.appendRecord('leases', { id: 'lease_soon', roomId: 'r1', primaryTenantId: '', status: 'active', endDate, startDate: '2026-01-01' });
  const out = s.handleSync({ since: Number.MAX_SAFE_INTEGER, changes: {} }, 'guest', { authenticated: false, role: '', propertyIds: [] });
  assert.equal(out.ok, true, out.error);
  const room = Array.from(out.changes.rooms || []).find(x => x.id === 'r1');
  assert(room, 'khách phải nhận snapshot phòng dù bản ghi phòng không mới hơn since');
  assert.equal(room.availableFrom, endDate, 'ngày sắp trống phải được suy ra từ hợp đồng còn 45 ngày');
  assert.equal(room.note, '', 'snapshot công khai vẫn phải xóa ghi chú nội bộ');
}

function testClientP1Guards() {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const sync = fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8');
  assert(app.includes("localStorage.setItem('huyrooms_admin_v3','true')"), 'đăng nhập cục bộ phải lưu quyền trên máy');
  assert(app.includes("function localAdminGranted(){return !Sync.isOn()"), 'cờ cục bộ không được mở quyền khi đang online');
  assert(app.includes('setTimeout(()=>renderUiState(view,true),180)'), 'tìm kiếm phải debounce để không phá focus');
  assert(app.includes('if(root)applyTableLabels(root)'), 'lọc bảng phải gắn lại nhãn mobile');
  assert(app.includes('i.month===reportState.month'), 'công nợ phải theo đúng tháng báo cáo');
  assert(app.includes('if(await validateResidentSession())renderResident()'), 'dữ liệu cư dân chỉ render sau khi xác minh phiên');
  assert(sync.includes("action: 'publicAvailability'"), 'client phải lấy giờ bận an toàn từ máy chủ');
  assert(sync.includes("action: 'residentLogout'"), 'đăng xuất cư dân phải thu hồi phiên máy chủ');
}

testPublicAvailabilityAndBookingRules();
testGuestGetsDerivedSoonDate();
testClientP1Guards();
console.log('P1 audit regression tests: PASS');
