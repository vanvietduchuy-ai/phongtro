const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadServer, makeBrowserData, loadClientSync } = require('./p0-regression.test.js');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function sourceBlock(from, to) {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `không tìm thấy khối ${from}`);
  return app.slice(start, end);
}

function testOnlyActiveAdminViewRenders() {
  const source = sourceBlock('function currentAdminView()', 'function svgBarChart');
  const calls = {};
  const names = ['Dashboard', 'PropertyAdmin', 'Leases', 'Tenants', 'Utilities', 'Invoices', 'Appointments', 'TicketsAdmin', 'Settings'];
  const ctx = {
    document: {
      querySelector: () => ({ id: 'view-dashboard' }),
      getElementById: id => ({ id })
    },
    applyRoleActionUI() { calls.roles = (calls.roles || 0) + 1; },
    applyTableLabels() { calls.labels = (calls.labels || 0) + 1; },
    syncTabbar() { calls.tabs = (calls.tabs || 0) + 1; },
    hydrateImages() { calls.images = (calls.images || 0) + 1; }
  };
  names.forEach(name => { ctx[`render${name}`] = () => { calls[name] = (calls[name] || 0) + 1; }; });
  vm.createContext(ctx);
  vm.runInContext(`${source};globalThis.runRender=renderAdmin;globalThis.runView=renderAdminView;`, ctx);

  ctx.runRender();
  assert.strictEqual(calls.Dashboard, 1, 'mở quản lý chỉ phải render dashboard đang hoạt động');
  names.slice(1).forEach(name => assert.strictEqual(calls[name] || 0, 0, `không được render sớm ${name}`));
  ctx.runView('Invoices');
  assert.strictEqual(calls.Dashboard, 2, 'view không hợp lệ phải rơi về dashboard an toàn');
  ctx.runView('invoices');
  assert.strictEqual(calls.Invoices, 1, 'chuyển view phải render đúng một view');
  assert(app.includes('renderAdmin(view);'), 'switchAdminView phải render view vừa chọn');
  assert(app.includes("if(adminVisible)renderAdmin();\n    if(publicVisible)renderPublic();"), 'đồng bộ chỉ render khu vực đang hiển thị');
}

function testSyncRecoveryPolicy() {
  assert(syncSource.includes('retryCount: 0, _listenersBound: false'), 'sync phải có trạng thái retry và khóa listener trùng');
  assert(syncSource.includes("navigator.onLine === false"), 'sync phải nhận biết offline trước khi gọi mạng');
  assert(syncSource.includes('Math.min(300000'), 'retry phải giới hạn tối đa 5 phút');
  assert(syncSource.includes("if (!this._listenersBound)"), 'start lặp lại không được gắn thêm listener');
  assert(syncSource.includes('clearTimeout(this.timer)'), 'scheduler phải hủy timer cũ trước khi đặt timer mới');

  const sync = loadClientSync(makeBrowserData());
  sync.lastError = 'mất mạng';
  sync.retryCount = 1;
  const firstRetry = sync.pollDelay();
  assert(firstRetry >= 40000 && firstRetry <= 46000, 'admin retry lần đầu phải backoff từ 40 giây và có jitter');
  sync.retryCount = 5;
  assert(sync.pollDelay() <= 300000, 'backoff không được vượt 5 phút');
  sync.lastError = '';
  assert.strictEqual(sync.pollDelay(), 20000, 'khi khỏe, admin tiếp tục đồng bộ mỗi 20 giây');
}

function testAutomaticBackupTriggerIsIdempotent() {
  const server = loadServer();
  const triggers = [];
  let everyDays = 0;
  let hour = -1;
  server.ScriptApp = {
    getProjectTriggers: () => triggers,
    newTrigger(handler) {
      const builder = {
        timeBased() { return builder; },
        everyDays(value) { everyDays = value; return builder; },
        atHour(value) { hour = value; return builder; },
        create() { triggers.push({ getHandlerFunction: () => handler }); return builder; }
      };
      return builder;
    }
  };
  assert.strictEqual(server.ensureBackupTrigger(), 'CREATED');
  assert.strictEqual(server.ensureBackupTrigger(), 'EXISTS');
  assert.strictEqual(triggers.length, 1, 'chạy setup nhiều lần không được tạo trùng trigger');
  assert.strictEqual(everyDays, 1);
  assert.strictEqual(hour, 3);
  assert(serverSource.includes('for (var i = 14; i < files.length; i++)'), 'backup Drive phải giữ 14 bản gần nhất');
}

function testRestoreValidationAndSafetyCopy() {
  const restoreSource = sourceBlock('function validateImport', 'window.importData=function');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${restoreSource};globalThis.validate=validateImport;`, ctx);
  assert(ctx.validate({ rooms: [{ id: 'r1' }], invoices: [{ id: 'i1' }] }).summary.includes('1 phòng'));
  assert(ctx.validate({ rooms: [{ name: 'thiếu id' }] }).error.includes('thiếu mã'), 'bản ghi thiếu id phải bị từ chối');
  assert(ctx.validate({ rooms: 'không phải mảng' }).error.includes('phải là danh sách'));
  assert(app.includes("exportData('huy-rooms-truoc-khi-nhap-'"), 'nhập JSON phải xuất bản an toàn trước khi thay dữ liệu');
  assert(app.includes('while(ring.length>7)ring.shift()'), 'sao lưu cục bộ phải giữ vòng 7 ngày');
}

function testScaleGuardAndBatchRead() {
  const server = loadServer();
  for (let i = 1; i <= 120; i++) server.appendRecord('rooms', { id: `r${i}`, propertyId: 'p1', name: `P${i}` });
  for (let i = 1; i <= 1200; i++) server.appendRecord('invoices', { id: `i${i}`, roomId: `r${(i % 120) + 1}`, month: '2026-08', total: i });
  assert.strictEqual(server.readSince('rooms', 0, true).length, 120, 'phải đọc đủ tập 120 phòng');
  assert.strictEqual(server.readSince('invoices', 0, true).length, 1200, 'phải đọc đủ 1.200 hóa đơn lịch sử');
  assert(serverSource.includes('sh.getRange(2, 1, last - 1, width).getValues()'), 'đọc sheet phải theo một range batch');
  assert(serverSource.includes('var MAX_RECORDS_PER_COLLECTION = 300'), 'mỗi gói push phải có trần 300 bản ghi/collection');

  const tooMany = Array.from({ length: 301 }, (_, i) => ({ id: `bulk-${i}`, name: `P${i}` }));
  assert.throws(
    () => server.handleSync({ changes: { rooms: tooMany } }, 'admin', { authenticated: true, role: 'owner', propertyIds: [] }),
    /Quá nhiều bản ghi/,
    'gói ghi bất thường phải bị chặn trước khi làm quá tải Apps Script'
  );
}

function testBuildAndStaticUiIntegrity() {
  const built = fs.readFileSync(path.join(ROOT, 'apps-script', 'Index.html'), 'utf8');
  ['styles.css', 'mobile.css', 'config.js', 'sync.js', 'p2.js', 'app.js'].forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert(built.includes(source), `Apps Script build phải chứa đúng nguồn ${file}`);
  });

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepStrictEqual(duplicateIds, [], 'HTML không được có id trùng');
  const idSet = new Set(ids);
  [...html.matchAll(/data-close-modal="([^"]+)"/g)].forEach(match => {
    assert(idSet.has(match[1]), `nút đóng phải trỏ tới modal tồn tại: ${match[1]}`);
  });
  [...html.matchAll(/<label[^>]+for="([^"]+)"/g)].forEach(match => {
    assert(idSet.has(match[1]), `label phải trỏ tới control tồn tại: ${match[1]}`);
  });

  const whitelistMatch = app.match(/const CALL_WHITELIST=new Set\(\[(.*?)\]\);/s);
  assert(whitelistMatch, 'phải tìm thấy whitelist dispatcher');
  const whitelist = new Set(JSON.parse(`[${whitelistMatch[1]}]`));
  const literalCalls = new Set([...`${html}\n${app}`.matchAll(/data-call="([A-Za-z][A-Za-z0-9_]*)"/g)].map(match => match[1]));
  literalCalls.forEach(call => assert(whitelist.has(call), `data-call ${call} phải có trong whitelist`));

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(sw.includes("huy-rooms-v4.6.6-room-sync-hotfix"), 'service worker phải dùng cache hotfix mới');
}

testOnlyActiveAdminViewRenders();
testSyncRecoveryPolicy();
testAutomaticBackupTriggerIsIdempotent();
testRestoreValidationAndSafetyCopy();
testScaleGuardAndBatchRead();
testBuildAndStaticUiIntegrity();
console.log('P3 hardening regression tests: PASS');
