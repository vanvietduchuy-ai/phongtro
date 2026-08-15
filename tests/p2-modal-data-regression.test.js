const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'mobile.css'), 'utf8');

function block(from, to) {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `không tìm thấy khối ${from}`);
  return app.slice(start, end);
}

function testModalManager() {
  const manager = block('const modalFocusBack=new WeakMap();', 'function setBtnBusy');
  assert(manager.includes("document.body.classList.toggle('modal-open',list.length>0)"), 'mở popup phải khóa cuộn nền');
  assert(manager.includes("modal.dataset.dirty='0'"), 'popup form phải khởi tạo trạng thái chưa sửa');
  assert(manager.includes("confirm('Cửa sổ này có dữ liệu chưa lưu."), 'đóng form đang nhập phải hỏi trước khi bỏ dữ liệu');
  assert(manager.includes("modal.querySelectorAll('form').forEach(form=>form.reset())"), 'đóng popup phải xóa dữ liệu form đã bỏ');
  assert(manager.includes("form input:not([type=\"hidden\"]):not([disabled])"), 'focus đầu phải vào ô nhập thay vì nút đóng');

  assert(app.includes("requestCloseModal(close.dataset.closeModal)"), 'nút đóng phải đi qua hàng rào dữ liệu chưa lưu');
  assert(app.includes("if(e.key==='Escape'){e.preventDefault();requestCloseModal(visible.id);return}"), 'Escape phải dùng cùng hàng rào đóng popup');
  assert(app.includes("if(e.key==='Tab')"), 'popup phải giữ focus khi dùng bàn phím');
  assert(app.includes("document.addEventListener('input',markModalDirty,true)"), 'thay đổi ô nhập phải đánh dấu form chưa lưu');
  assert(app.includes("document.addEventListener('drop',markModalDirty,true)"), 'kéo thả ảnh cũng phải đánh dấu form chưa lưu');
}

function testModalLayout() {
  assert(css.includes('body.modal-open{overflow:hidden'), 'CSS phải khóa nền khi popup mở');
  assert(css.includes('.modal-card.modal-wide{width:min(960px,100%)}'), 'class modal-wide phải có bề rộng thật');
  assert(css.includes('.form-actions{display:flex;flex-wrap:wrap'), 'hàng nhiều nút phải tự xuống dòng');
  assert(css.includes('.modal-backdrop{background:transparent'), 'nền popup cũ/mới phải dùng một lớp phủ thống nhất');

  const modalIds = [...html.matchAll(/<div class="modal hidden" id="([^"]+)">/g)].map(m => m[1]);
  assert(modalIds.length >= 20, 'phải quét được toàn bộ popup');
  modalIds.forEach((id, index) => {
    const start = html.indexOf(`<div class="modal hidden" id="${id}">`);
    const end = index + 1 < modalIds.length ? html.indexOf(`<div class="modal hidden" id="${modalIds[index + 1]}">`) : html.indexOf('<button class="sync-pill', start);
    const section = html.slice(start, end > start ? end : undefined);
    assert(/class="(?:modal-card|pal-card)/.test(section), `${id} phải có thẻ nội dung popup`);
  });
}

function testNewOccupantIsCommittedOnlyAfterValidation() {
  const source = block('function occupantFromPicker', '/* ---------- Form hợp đồng');
  const fields = {
    picker: { value: '__new' },
    name: { value: 'Nguyễn Văn B' },
    phone: { value: '0905123456' }
  };
  const ctx = {
    document: { getElementById: id => fields[id] },
    data: { tenants: [] },
    normalizePhone: v => String(v).replace(/\D/g, ''),
    uid: () => 'tenant-draft',
    getTenant: () => null,
    showToast: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(`${source};globalThis.pick=occupantFromPicker;globalThis.commit=commitOccupantDraft;`, ctx);
  const draft = ctx.pick('picker', 'name', 'phone');
  assert(draft && draft._newOccupantDraft, 'người ở mới phải là bản nháp');
  assert.strictEqual(ctx.data.tenants.length, 0, 'chưa qua kiểm tra sức chứa thì không được chèn vào dữ liệu');
  ctx.commit(draft);
  assert.strictEqual(ctx.data.tenants.length, 1, 'qua kiểm tra mới được chèn đúng một lần');
  ctx.commit(draft);
  assert.strictEqual(ctx.data.tenants.length, 1, 'commit lặp không được tạo người ở trùng');

  assert(app.includes('commitOccupantDraft(t);\n  data.leaseOccupants.push'), 'form thêm người ở phải commit sau kiểm tra sức chứa');
  assert(app.includes('commitOccupantDraft(occupant);\n    lease={id:'), 'form hợp đồng phải commit ngay trước khi tạo hợp đồng');
}

function testAssetQuantityCannotBecomeZero() {
  assert(app.includes('type="number" min="1" value="${a.quantity}"'), 'số lượng tài sản khi sửa phải tối thiểu 1');
  assert(app.includes("field==='quantity'?Math.max(1,Number(value||1))"), 'handler tài sản phải chặn số lượng 0');
}

testModalManager();
testModalLayout();
testNewOccupantIsCommittedOnlyAfterValidation();
testAssetQuantityCannotBecomeZero();
console.log('P2 modal & data regression tests: PASS');
