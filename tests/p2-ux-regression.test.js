const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'mobile.css'), 'utf8');

function testManagerNavigationAndQuickActions() {
  assert(html.includes('<span>Khách & lịch hẹn</span>'), 'sidebar phải gọi đúng bản chất CRM khách và lịch hẹn');
  assert(html.includes('data-more="appointments" aria-label="Khách và lịch hẹn"'), 'menu mobile phải dùng nhãn CRM dễ hiểu');
  assert(app.includes("appointments:'Khách & lịch hẹn'"), 'tiêu đề trang quản lý phải đồng bộ với điều hướng');

  assert(html.includes('id="quickAddUtility"'), 'topbar phải ưu tiên ghi điện nước');
  assert(html.includes('id="quickAddInvoice"'), 'topbar phải ưu tiên lập hóa đơn');
  assert(!html.includes('id="quickAddRoom"'), 'topbar không nên ưu tiên thao tác thêm phòng ít dùng hằng ngày');
  assert(!html.includes('id="quickAddProperty"'), 'topbar không nên ưu tiên thao tác thêm căn ít dùng hằng ngày');
  assert(app.includes("getElementById('quickAddUtility').addEventListener"), 'nút ghi điện nước phải có hành vi');
  assert(app.includes("getElementById('quickAddInvoice').addEventListener"), 'nút lập hóa đơn phải có hành vi');
}

function testDashboardPriorityOrder() {
  const dashboard = app.slice(app.indexOf('function renderDashboard()'), app.indexOf('function renderPropertyAdmin()'));
  const primary = dashboard.indexOf('metric-grid-primary');
  const tasks = dashboard.indexOf('priority-panel');
  const secondary = dashboard.indexOf('metric-grid-secondary');
  const charts = dashboard.indexOf('dashboard-chart-grid');
  assert(primary >= 0 && tasks > primary && secondary > tasks && charts > secondary,
    'dashboard phải theo thứ tự chỉ số chính → việc cần làm → chỉ số phụ → biểu đồ');
  assert(dashboard.includes("metric('CÔNG NỢ'"), 'công nợ phải nằm trong nhóm chỉ số ra quyết định');
  assert(dashboard.includes('const taskItems=[]'), 'danh sách việc phải được chuẩn bị trước khi dựng dashboard');
}

function testModalAndMobileAccessibility() {
  const closeButtons = html.match(/<button class="modal-close"[^>]*>/g) || [];
  assert(closeButtons.length >= 8, 'phải tìm thấy các nút đóng modal');
  assert(closeButtons.every(tag => /aria-label="Đóng(?: [^"]+)?"/.test(tag)), 'mọi nút đóng modal phải có tên truy cập');
  assert(css.includes('top:calc(var(--app-status-height) + var(--resident-header-height))'), 'tab cư dân phải nằm dưới thanh đồng bộ và header');
  assert(css.includes('.mobile-tabbar button .tab-badge{font-size:10.5px'), 'badge tab mobile không được dùng chữ 9px');
  assert(css.includes('.step p{font-size:12.5px'), 'mô tả ba bước phải đọc được trên màn hình hẹp');
}

testManagerNavigationAndQuickActions();
testDashboardPriorityOrder();
testModalAndMobileAccessibility();
console.log('P2 UX regression tests: PASS');
