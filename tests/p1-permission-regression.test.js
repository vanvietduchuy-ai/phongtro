const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadServer } = require('./p0-regression.test.js');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

function block(from, to) {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `không tìm thấy khối ${from}`);
  return app.slice(start, end);
}

function testHandlerLevelPermissionGuards() {
  assert(app.includes("function requireCan(action,module)"), 'phải có cổng quyền dùng chung ở handler');
  assert(app.includes("function requireOwnerManager()"), 'phải có cổng riêng cho action máy chủ chỉ owner/manager');
  assert(app.includes("function requireOwner()"), 'phải có cổng riêng cho thao tác chỉ chủ nhà');

  const required = [
    "window.openPropertyForm=function(id=null){if(!requireCan(id?'edit':'create','properties'))return",
    "window.openRoomForm=function(id=null,propertyId=null){if(!requireCan(id?'edit':'create','rooms'))return",
    "window.openTenantForm=function(id=null,roomId=null){if(!requireCan(id?'edit':'create','tenants'))return",
    "window.openUtilityForm=function(id=null,roomId=null){if(!requireCan(id?'edit':'create','utilityReadings'))return",
    "window.openInvoiceForm=function(readingId=null){if(!requireCan('create','invoices'))return",
    "window.recordPayment=function(id){if(!requireCan('approve','payments'))return",
    "window.ticketAction=function(id,action){\n  if(!requireCan('edit','maintenanceTickets'))return",
    "window.convertLeadToLease=function(id){\n  if(!requireCan('create','leases'))return",
    "window.saveManagerSettings=function(){\n  if(!requireCan('edit','settings'))return"
  ];
  required.forEach(snippet => assert(app.includes(snippet), `thiếu guard: ${snippet}`));

  const unlock = block('window.unlockReading=async function', '/* ---------- Tạo hóa đơn hàng loạt');
  assert(unlock.includes('if(!requireOwnerManager())return'), 'mở khóa kỳ chốt phải khớp server: chỉ owner/manager');
}

function testRoleAwareUi() {
  const quick = block('function applyRoleActionUI()', 'function renderAdmin()');
  assert(quick.includes("quickAddTenant:can('create','tenants')"), 'quick action người ở phải theo quyền');
  assert(quick.includes("quickAddUtility:can('create','utilityReadings')"), 'quick action điện nước phải theo quyền');
  assert(quick.includes("quickAddInvoice:can('create','invoices')"), 'quick action hóa đơn phải theo quyền');

  const utilities = block('function renderUtilities()', 'window.deleteReading=function');
  assert(utilities.includes("const meterCreate=can('create','utilityReadings')"), 'màn điện nước phải tách quyền ghi chỉ số');
  assert(utilities.includes("const serviceCreate=can('create','serviceDefinitions')"), 'màn điện nước phải tách quyền dịch vụ');
  assert(utilities.includes("const invoiceCreate=can('create','invoices')"), 'màn điện nước phải tách quyền lập hóa đơn');

  const crm = block('function renderAppointments()', 'window.updateAppointmentStatus');
  assert(crm.includes("editAppointments=can('edit','appointments')"), 'CRM phải có chế độ chỉ xem cho kế toán');
  assert(crm.includes("canHold=canManageHold()"), 'giữ chỗ phải tách khỏi quyền sửa lịch hẹn');
  assert(crm.includes("canLease=can('create','leases')"), 'lập hợp đồng phải tách khỏi quyền sửa lịch hẹn');
}

function testClientMatrixMatchesServerCollections() {
  const matrix = block('const PERM=', '/** Căn trọ trong phạm vi được giao');
  const ctx = { Sync: { staff: () => ({ role: 'staff', name: 'NV' }) }, showToast() {} };
  vm.createContext(ctx);
  vm.runInContext(`${matrix};globalThis.testCan=can;`, ctx);
  const role = value => { ctx.Sync.staff = () => ({ role: value, name: value }); };

  role('accountant');
  assert.strictEqual(ctx.testCan('create', 'invoices'), true);
  assert.strictEqual(ctx.testCan('create', 'utilityReadings'), false);
  assert.strictEqual(ctx.testCan('edit', 'rooms'), false);
  role('staff');
  assert.strictEqual(ctx.testCan('edit', 'appointments'), true);
  assert.strictEqual(ctx.testCan('edit', 'maintenanceTickets'), true);
  assert.strictEqual(ctx.testCan('create', 'invoices'), false);
  role('manager');
  assert.strictEqual(ctx.testCan('edit', 'settings'), true);
  assert.strictEqual(ctx.testCan('edit', 'staffUsers'), false);

  const server = loadServer();
  const accountant = { role: 'accountant' };
  const staff = { role: 'staff' };
  const manager = { role: 'manager' };
  assert.strictEqual(server.canWriteCol(accountant, 'invoices'), true);
  assert.strictEqual(server.canWriteCol(accountant, 'rooms'), false);
  assert.strictEqual(server.canWriteCol(accountant, 'utilityReadings'), false);
  assert.strictEqual(server.canWriteCol(staff, 'utilityReadings'), true);
  assert.strictEqual(server.canWriteCol(staff, 'appointments'), true);
  assert.strictEqual(server.canWriteCol(staff, 'invoices'), false);
  assert.strictEqual(server.canWriteCol(manager, 'settings'), true);
  assert.strictEqual(server.canWriteCol(manager, 'staffUsers'), false);
}

function testSingleInvoiceUsesCanonicalDueDate() {
  const refresh = block('function refreshInvoiceForm()', 'window.openInvoiceForm=function');
  assert(refresh.includes('dueDateForMonth(month,Number(lease?.billingDay||data.settings.defaultDueDay||5))'),
    'hóa đơn lẻ phải dùng cùng hàm hạn thanh toán với hóa đơn hàng loạt');
  assert(!refresh.includes('nextDayISO(Number(lease?.billingDay'),
    'không được coi ngày thu hàng tháng là số ngày cộng từ hôm nay');

  const match = app.match(/function dueDateForMonth\(month,day\)\{[\s\S]*?\n\}/);
  assert(match, 'không tìm thấy dueDateForMonth');
  const dueDateForMonth = new Function('today', `${match[0]}; return dueDateForMonth;`)(() => '2026-08-15');
  assert.strictEqual(dueDateForMonth('2026-08', 5), '2026-09-05');
  assert.strictEqual(dueDateForMonth('2026-08', 28), '2026-08-28');
}

testHandlerLevelPermissionGuards();
testRoleAwareUi();
testClientMatrixMatchesServerCollections();
testSingleInvoiceUsesCanonicalDueDate();
console.log('P1 permission regression tests: PASS');
