const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadServer, addBaseServerData, makeBrowserData, loadClientSync } = require('./p0-regression.test.js');

const ROOT = path.resolve(__dirname, '..');
const syncSource = fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');

function countSheetReads(server) {
  let reads = 0;
  const seen = new Set();
  Object.keys(server.SCHEMA).forEach(col => {
    const sheet = server.sheetOf(col);
    if (seen.has(sheet)) return;
    seen.add(sheet);
    const original = sheet.getRange.bind(sheet);
    sheet.getRange = function (...args) { reads++; return original(...args); };
  });
  return { value: () => reads, reset: () => { reads = 0; } };
}

function testPublicFastPathReadsNoSheetsWhenUnchanged() {
  const s = loadServer();
  addBaseServerData(s);
  const meter = countSheetReads(s);
  const beforeStamp = s.currentServerStamp();
  const first = s.route({ action: 'sync', since: 0, changes: {} });
  assert.equal(first.ok, true);
  assert(first.changes.properties.length > 0 && first.changes.rooms.length > 0, 'lần đầu phải trả snapshot công khai');
  assert(meter.value() > 0, 'lần đầu cần đọc dữ liệu thật');

  meter.reset();
  const second = s.route({ action: 'sync', since: first.serverTime, changes: {} });
  assert.deepEqual(Object.keys(second.changes), [], 'không đổi thì payload phải rỗng');
  assert.equal(meter.value(), 0, 'public poll không đổi không được đọc bất kỳ sheet nào');
  assert.equal(s.currentServerStamp(), beforeStamp, 'public poll chỉ đọc, không được tạo timestamp mới');

  const room = s.serverRecordById('rooms', 'r1');
  room.price = 3900000;
  s.writeRecordAtStamp('rooms', room, s.nextStamp());
  meter.reset();
  const third = s.route({ action: 'sync', since: second.serverTime, changes: {} });
  assert.equal(third.changes.rooms.find(r => r.id === 'r1').price, 3900000, 'thay đổi mới phải xuất hiện ngay ở lần poll kế tiếp');
  assert(meter.value() > 0, 'khi stamp đổi mới được đọc snapshot');
}

function testAdminEmptyPullDoesNotAdvanceStamp() {
  const s = loadServer();
  addBaseServerData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', staffId: '', propertyIds: [] };
  const first = s.handleAdminPull({ since: 0, changes: {} }, ctx);
  const stamp = s.currentServerStamp();
  const second = s.handleAdminPull({ since: first.serverTime, changes: {} }, ctx);
  assert.equal(second.serverTime, first.serverTime);
  assert.equal(s.currentServerStamp(), stamp, 'pull quản trị rỗng không được ghi LAST_STAMP');
}

function testClientFastCadenceAndWakeups() {
  const admin = loadClientSync(makeBrowserData());
  assert.equal(admin.pollDelay(), 6000, 'quản lý phải kiểm tra thay đổi mỗi 6 giây khi tab đang mở');
  admin.saveCfg({ token: '', writeKey: '' });
  assert.equal(admin.pollDelay(), 8000, 'trang khách phải kiểm tra thay đổi mỗi 8 giây khi đang mở');
  assert(syncSource.includes('setTimeout(function () { self.cycle(); }, 250)'), 'thay đổi cục bộ phải đẩy sau 250ms');
  assert(syncSource.includes("window.addEventListener('pageshow'"), 'iOS/PWA quay lại phải pull ngay');
  assert(syncSource.includes("window.addEventListener('focus'"), 'tab lấy focus phải pull ngay');
  assert(syncSource.includes("new BroadcastChannel('huy-rooms-sync')"), 'các tab cùng trình duyệt phải báo nhau ngay');
  assert(syncSource.includes('controller.abort()'), 'request treo phải có timeout');
  assert(syncSource.includes("cache: 'no-store'"), 'request sync không được dùng HTTP cache');
  assert(!appSource.includes('renderPublic();renderAdmin();\nresidentSession=loadResidentSession();'), 'không được render màn quản lý ẩn trước khi bắt đầu sync');
}

function testServerFastPathIsWiredBeforeAuth() {
  const fast = serverSource.indexOf("if (req.action === 'sync' && !req.token && !req.key) return handlePublicSync(req);");
  const role = serverSource.indexOf('var role = roleOf(req);');
  assert(fast >= 0 && fast < role, 'sync công khai phải đi đường nhanh trước khi nạp token');
  assert(serverSource.includes("public_sync_v467_"), 'snapshot công khai thay đổi phải được cache ngắn hạn');
  assert(serverSource.includes('initializeCollectionStamps();'), 'setup phải dựng index stamp cho dữ liệu cũ');
}

testPublicFastPathReadsNoSheetsWhenUnchanged();
testAdminEmptyPullDoesNotAdvanceStamp();
testClientFastCadenceAndWakeups();
testServerFastPathIsWiredBeforeAuth();
console.log('v4.6.7 fast sync tests: PASS');
