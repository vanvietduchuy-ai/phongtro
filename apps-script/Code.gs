/**
 * HUY ROOMS — Máy chủ + website chạy thẳng trên Google Apps Script
 * ---------------------------------------------------------------
 * CÀI ĐẶT (4 bước, làm 1 lần):
 *   1. Vào script.google.com → New project. Đổi tên thành "Huy Rooms".
 *   2. Dán file này đè lên Code.gs.
 *      Bấm dấu + bên cạnh Files → HTML → đặt tên đúng là Index → dán file Index.html.
 *   3. Chọn hàm setup trên thanh công cụ → Run → Cho phép quyền.
 *      (Chạy setup nhiều lần không mất dữ liệu — hàm tự thêm cột mới nếu thiếu.)
 *   4. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy.
 *
 * Đăng nhập quản lý lần đầu: mật khẩu 123456 (bắt buộc đổi ngay, tối thiểu 10 ký tự).
 * Mỗi lần sửa code: Deploy → Manage deployments → bút chì → Version: New version → Deploy.
 */

var SCHEMA = {
  properties: {
    sheet: 'CanTro',
    fields: [
      ['id', 's'], ['name', 's'], ['area', 's'], ['address', 's'],
      ['description', 's'], ['phone', 's'], ['imageIds', 'lines'], ['archived', 'b']
    ]
  },
  rooms: {
    sheet: 'Phong',
    fields: [
      ['id', 's'], ['propertyId', 's'], ['name', 's'], ['type', 's'],
      ['price', 'n'], ['deposit', 'n'], ['area', 'n'], ['capacity', 'n'],
      ['status', 's'], ['electricRate', 'n'], ['waterMode', 's'],
      ['waterRate', 'n'], ['waterFixed', 'n'], ['amenities', 'csv'],
      ['note', 's'], ['imageIds', 'lines'], ['archived', 'b'],
      ['slug', 's'], ['availableFrom', 's'], ['policies', 's']
    ]
  },
  tenants: {
    sheet: 'NguoiThue',
    fields: [
      ['id', 's'], ['name', 's'], ['phone', 's'], ['pin', 's'], ['roomId', 's'],
      ['moveInDate', 's'], ['active', 'b'], ['depositRequired', 'n'],
      ['depositPaid', 'n'], ['note', 's'],
      ['pinHash', 's'], ['pinSalt', 's'], ['pinUpdatedAt', 's'], ['moveOutDate', 's'], ['zaloUserId', 's']
    ]
  },
  utilityReadings: {
    sheet: 'DienNuoc',
    fields: [
      ['id', 's'], ['roomId', 's'], ['month', 's'],
      ['electricStart', 'n'], ['electricEnd', 'n'], ['electricRate', 'n'],
      ['electricUnits', 'n'], ['electricAmount', 'n'],
      ['waterMode', 's'], ['waterStart', 'n'], ['waterEnd', 'n'],
      ['waterRate', 'n'], ['waterFixed', 'n'], ['waterUnits', 'n'], ['waterAmount', 'n'],
      ['otherFee', 'n'], ['note', 's'], ['createdAt', 's'],
      ['status', 's'], ['lockedAt', 's'], ['unlockNote', 's'], ['imageIds', 'lines']
    ]
  },
  invoices: {
    sheet: 'HoaDon',
    fields: [
      ['id', 's'], ['tenantId', 's'], ['roomId', 's'], ['readingId', 's'],
      ['month', 's'], ['dueDate', 's'], ['rent', 'n'], ['electric', 'n'],
      ['water', 'n'], ['other', 'n'], ['depositAmount', 'n'], ['total', 'n'],
      ['amountPaid', 'n'], ['status', 's'], ['depositApplied', 'b'], ['createdAt', 's'],
      ['payments', 'json'], ['leaseId', 's'],
      ['code', 's'], ['serviceLines', 'json'], ['adjustAmount', 'n'], ['adjustNote', 's'], ['issuedAt', 's']
    ]
  },
  leases: {
    sheet: 'HopDong',
    fields: [
      ['id', 's'], ['propertyId', 's'], ['roomId', 's'], ['primaryTenantId', 's'],
      ['startDate', 's'], ['endDate', 's'], ['billingDay', 'n'],
      ['rentAmount', 'n'], ['depositRequired', 'n'], ['depositPaid', 'n'],
      ['status', 's'], ['signedAt', 's'], ['moveInAt', 's'], ['moveOutAt', 's'],
      ['terminationReason', 's'], ['note', 's'], ['createdAt', 's'],
      ['depositDeduct', 'n'], ['depositRefund', 'n'], ['settlementNote', 's'],
      ['roomHistory', 'json'], ['renewals', 'json']
    ]
  },
  leaseOccupants: {
    sheet: 'NguoiO',
    fields: [
      ['id', 's'], ['leaseId', 's'], ['occupantId', 's'], ['role', 's'],
      ['joinedAt', 's'], ['leftAt', 's'], ['note', 's'], ['createdAt', 's']
    ]
  },
  accounts: {
    sheet: 'TaiKhoan',
    fields: [
      ['id', 's'], ['phone', 's'], ['occupantId', 's'], ['active', 'b'],
      ['pinHash', 's'], ['pinSalt', 's'], ['pinUpdatedAt', 's'], ['createdAt', 's'], ['note', 's'],
      ['sessionSeed', 's']
    ]
  },
  assets: {
    sheet: 'TaiSan',
    fields: [
      ['id', 's'], ['roomId', 's'], ['name', 's'], ['quantity', 'n'],
      ['condition', 's'], ['note', 's'], ['imageIds', 'lines'], ['archived', 'b'], ['createdAt', 's']
    ]
  },
  handoverItems: {
    sheet: 'BanGiao',
    fields: [
      ['id', 's'], ['leaseId', 's'], ['assetId', 's'], ['phase', 's'], ['name', 's'],
      ['quantity', 'n'], ['condition', 's'], ['note', 's'], ['imageIds', 'lines'], ['createdAt', 's']
    ]
  },
  serviceDefinitions: {
    sheet: 'DichVu',
    fields: [
      ['id', 's'], ['name', 's'], ['calcType', 's'], ['unit', 's'], ['price', 'n'],
      ['taxPercent', 'n'], ['effectiveFrom', 's'], ['priceHistory', 'json'],
      ['note', 's'], ['archived', 'b'], ['createdAt', 's']
    ]
  },
  leaseServices: {
    sheet: 'DVHopDong',
    fields: [
      ['id', 's'], ['leaseId', 's'], ['serviceId', 's'], ['quantity', 'n'],
      ['priceOverride', 'n'], ['discountPercent', 'n'], ['discountAmount', 'n'],
      ['effectiveFrom', 's'], ['endedAt', 's'], ['note', 's'], ['createdAt', 's']
    ]
  },
  payments: {
    sheet: 'ThanhToan',
    fields: [
      ['id', 's'], ['invoiceId', 's'], ['kind', 's'], ['amount', 'n'], ['paidAt', 's'],
      ['method', 's'], ['reference', 's'], ['note', 's'], ['createdBy', 's'],
      ['reversedAt', 's'], ['reversalReason', 's'], ['reversalOf', 's'], ['createdAt', 's']
    ]
  },
  depositLedger: {
    sheet: 'SoCoc',
    fields: [
      ['id', 's'], ['leaseId', 's'], ['type', 's'], ['amount', 'n'], ['at', 's'],
      ['method', 's'], ['note', 's'], ['createdBy', 's'], ['createdAt', 's']
    ]
  },
  reminders: {
    sheet: 'NhacNo',
    fields: [
      ['id', 's'], ['invoiceId', 's'], ['tenantId', 's'], ['kind', 's'], ['channel', 's'],
      ['message', 's'], ['sentAt', 's'], ['sentBy', 's'], ['createdAt', 's']
    ]
  },
  maintenanceTickets: {
    sheet: 'SuCo',
    fields: [
      ['id', 's'], ['title', 's'], ['category', 's'], ['description', 's'], ['priority', 's'],
      ['imageIds', 'lines'], ['status', 's'], ['tenantId', 's'], ['leaseId', 's'], ['roomId', 's'],
      ['assigneeId', 's'], ['statusHistory', 'json'], ['resolution', 's'],
      ['createdAt', 's'], ['closedAt', 's']
    ]
  },
  notifications: {
    sheet: 'ThongBao',
    fields: [
      ['id', 's'], ['tenantId', 's'], ['kind', 's'], ['title', 's'], ['body', 's'],
      ['refId', 's'], ['createdBy', 's'], ['createdAt', 's'], ['readAt', 's']
    ]
  },
  staffUsers: {
    sheet: 'NhanSu',
    fields: [
      ['id', 's'], ['name', 's'], ['username', 's'], ['role', 's'], ['propertyIds', 'csv'],
      ['passHash', 's'], ['passSalt', 's'], ['active', 'b'], ['note', 's'], ['createdAt', 's']
    ]
  },
  auditLog: {
    sheet: 'NhatKy',
    fields: [
      ['id', 's'], ['at', 's'], ['actor', 's'], ['role', 's'], ['action', 's'],
      ['col', 's'], ['recordId', 's'], ['before', 'json'], ['after', 'json'], ['note', 's']
    ]
  },
  appointments: {
    sheet: 'LichHen',
    fields: [
      ['id', 's'], ['roomId', 's'], ['customerName', 's'], ['customerPhone', 's'],
      ['date', 's'], ['time', 's'], ['note', 's'], ['status', 's'], ['createdAt', 's'],
      ['source', 's'], ['careLog', 'json'], ['reserveAmount', 'n'], ['reserveUntil', 's'],
      ['convertedLeaseId', 's']
    ]
  },
  settings: {
    sheet: 'CaiDat',
    fields: [
      ['id', 's'], ['managerName', 's'], ['managerPhone', 's'],
      ['defaultDueDay', 'n'], ['zaloMode', 's'], ['brandName', 's'],
      ['bankCode', 's'], ['bankAccount', 's'], ['bankAccountName', 's'],
      ['workStart', 's'], ['workEnd', 's'], ['slotMinutes', 'n'], ['zaloPhone', 's']
    ]
  }
};

var META = ['updatedAt', 'deleted'];
var PUBLIC_COLLECTIONS = ['properties', 'rooms'];
var ALL_COLLECTIONS = ['properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments', 'settings',
  'leases', 'leaseOccupants', 'accounts', 'assets', 'handoverItems',
  'serviceDefinitions', 'leaseServices', 'payments', 'depositLedger', 'reminders',
  'maintenanceTickets', 'notifications', 'staffUsers', 'auditLog'];
// Các cột KHÔNG BAO GIỜ trả về client và được máy chủ tự giữ khi ghi đè bản ghi
var PRIVATE_FIELDS = {
  tenants: ['pin', 'pinHash', 'pinSalt', 'pinUpdatedAt'],
  accounts: ['pinHash', 'pinSalt', 'pinUpdatedAt', 'sessionSeed'],
  staffUsers: ['passHash', 'passSalt']
};



/* ===== ENUM hợp lệ — máy chủ từ chối giá trị lạ (v4.1) ===== */
var ENUMS = {
  rooms: { status: ['available', 'reserved', 'occupied', 'maintenance'], waterMode: ['meter', 'fixed'] },
  leases: { status: ['draft', 'active', 'ending', 'ended', 'cancelled'] },
  invoices: { status: ['unpaid', 'partial', 'paid', 'overdue'] },
  payments: { kind: ['payment', 'reversal'], method: ['cash', 'bank', 'momo', 'other', ''] },
  depositLedger: { type: ['collect', 'refund', 'deduct'] },
  appointments: { status: ['new', 'contacted', 'appointment_confirmed', 'viewed', 'reserved', 'lease_draft', 'converted', 'lost', 'confirmed', 'done', 'cancelled'], source: ['website', 'facebook', 'zalo', 'walkin', 'referral', 'other', ''] },
  maintenanceTickets: { status: ['new', 'received', 'in_progress', 'waiting', 'done', 'cancelled'], priority: ['low', 'normal', 'high', 'urgent', ''] },
  staffUsers: { role: ['owner', 'manager', 'accountant', 'staff'] },
  utilityReadings: { status: ['draft', 'final'], waterMode: ['meter', 'fixed'] }
};
function enumViolation(col, rec) {
  var rules = ENUMS[col];
  if (!rules) return '';
  for (var k in rules) {
    if (rec[k] === undefined || rec[k] === null) continue;
    if (rules[k].indexOf(String(rec[k])) < 0) return k + '=' + String(rec[k]).slice(0, 40);
  }
  return '';
}

/* ===== PHẠM VI CĂN — thực thi tại MÁY CHỦ (v4.1) =====
 * propertyIds rỗng = tất cả căn (tương thích dữ liệu cũ). Owner luôn thấy hết. */
function buildScopeMaps() {
  var roomProp = {}, leaseRoom = {}, invRoom = {}, invLease = {}, tenRoom = {}, accOcc = {};
  readSince('rooms', 0, true).forEach(function (r) { if (!r.deleted) roomProp[r.id] = r.propertyId || ''; });
  readSince('leases', 0, true).forEach(function (l) { if (!l.deleted) leaseRoom[l.id] = l.roomId || ''; });
  readSince('invoices', 0, true).forEach(function (i) { if (!i.deleted) { invRoom[i.id] = i.roomId || ''; invLease[i.id] = i.leaseId || ''; } });
  readSince('tenants', 0, true).forEach(function (t) { if (!t.deleted) tenRoom[t.id] = t.roomId || ''; });
  readSince('accounts', 0, true).forEach(function (a) { if (!a.deleted) accOcc[a.id] = a.occupantId || ''; });
  return { roomProp: roomProp, leaseRoom: leaseRoom, invRoom: invRoom, invLease: invLease, tenRoom: tenRoom, accOcc: accOcc };
}
/** Trả propertyId của record, '' nếu không suy ra được (coi là dữ liệu chung). */
function propertyIdOfRecord(col, rec, maps) {
  if (!rec) return '';
  var viaRoom = function (roomId) { return maps.roomProp[roomId] || ''; };
  var viaLease = function (leaseId) { return viaRoom(maps.leaseRoom[leaseId] || ''); };
  switch (col) {
    case 'properties': return rec.id || '';
    case 'rooms': return rec.propertyId || '';
    case 'leases': return viaRoom(rec.roomId || '');
    case 'tenants': return viaRoom(rec.roomId || maps.tenRoom[rec.id] || '');
    case 'accounts': return viaRoom(maps.tenRoom[maps.accOcc[rec.id] || rec.occupantId || ''] || '');
    case 'utilityReadings': return viaRoom(rec.roomId || '');
    case 'appointments': return viaRoom(rec.roomId || '');
    case 'maintenanceTickets': return viaRoom(rec.roomId || '') || viaLease(rec.leaseId || '');
    case 'invoices': return viaRoom(rec.roomId || '') || viaLease(rec.leaseId || '');
    case 'payments': return viaRoom(maps.invRoom[rec.invoiceId || ''] || '') || viaLease(maps.invLease[rec.invoiceId || ''] || '');
    case 'depositLedger': return viaLease(rec.leaseId || '');
    case 'leaseOccupants': return viaLease(rec.leaseId || '');
    case 'reminders': return viaRoom(maps.invRoom[rec.invoiceId || ''] || '');
    case 'notifications': return rec.tenantId ? viaRoom(maps.tenRoom[rec.tenantId] || '') : '';
    case 'assets': return viaRoom(rec.roomId || '') || viaLease(rec.leaseId || '');
    case 'handoverItems': return viaLease(rec.leaseId || '') || viaRoom(rec.roomId || '');
    default: return ''; // settings, serviceDefinitions, staffUsers, auditLog: dữ liệu chung
  }
}
function inScope(ctx, propId) {
  if (!ctx || ctx.role === 'owner') return true;
  if (!ctx.propertyIds || !ctx.propertyIds.length) return true; // [] = tất cả căn
  if (!propId) return true; // dữ liệu chung không thuộc căn nào
  return ctx.propertyIds.indexOf(propId) >= 0;
}

/* ===== PHÂN QUYỀN THEO VAI TRÒ (v6) =====
 * owner / manager: ghi mọi collection (manager không đụng nhân sự & nhật ký)
 * accountant: tiền bạc — hóa đơn, sổ thu, sổ cọc, nhắc nợ, dịch vụ
 * staff: vận hành — lịch hẹn, sự cố, điện nước, thông báo
 * auditLog KHÔNG BAO GIỜ nhận ghi từ client (máy chủ tự ghi). */
var ROLE_WRITE = {
  owner: null, // null = tất cả (trừ auditLog)
  manager: null,
  accountant: ['invoices', 'payments', 'depositLedger', 'reminders', 'serviceDefinitions', 'leaseServices', 'notifications'],
  staff: ['appointments', 'maintenanceTickets', 'utilityReadings', 'notifications']
};
var MANAGER_BLOCK = { staffUsers: 1 };
var AUDIT_COLS = {
  invoices: ['total', 'amountPaid', 'status', 'code', 'adjustAmount'],
  payments: ['amount', 'kind', 'reversedAt', 'reversalOf'],
  depositLedger: ['type', 'amount', 'leaseId'],
  leases: ['status', 'rentAmount', 'depositPaid', 'roomId', 'endDate'],
  rooms: ['status', 'price', 'deposit', 'archived'],
  tenants: ['name', 'phone', 'active', 'roomId'],
  utilityReadings: ['status', 'electricEnd', 'unlockNote'],
  serviceDefinitions: ['price', 'archived'],
  staffUsers: ['role', 'active', 'propertyIds'],
  settings: ['bankAccount', 'bankCode', 'defaultDueDay']
};
/** Ngữ cảnh xác thực TẬP TRUNG — mọi API quản trị đi qua đây (v4.1). */
function authContext(req) {
  var props = PropertiesService.getScriptProperties();
  if (req.token) {
    var t = loadTokens()[req.token];
    if (!t || t.exp <= Date.now()) {
      return { authenticated: false, role: '', staffId: '', staffName: '', propertyIds: [], tokenType: '', expired: !!t };
    }
    var role = t.staffRole || 'owner';
    return {
      authenticated: true,
      role: ['owner', 'manager', 'accountant', 'staff'].indexOf(role) >= 0 ? role : 'staff',
      staffId: t.staffId || '', staffName: t.staffName || 'Chủ nhà',
      propertyIds: Array.isArray(t.staffProps) ? t.staffProps : [],
      tokenType: t.staffId ? 'staff' : 'owner'
    };
  }
  var wk = props.getProperty('WRITE_KEY');
  if (wk && req.key && safeEqual(req.key, wk)) {
    return { authenticated: true, role: 'owner', staffId: '', staffName: 'Chủ nhà (writeKey)', propertyIds: [], tokenType: 'writeKey' };
  }
  return { authenticated: false, role: '', staffId: '', staffName: '', propertyIds: [], tokenType: '' };
}
function forbidden(msg) {
  return { ok: false, code: 'forbidden', error: msg || 'Bạn không có quyền thực hiện thao tác này' };
}

function staffOf(req) {
  if (!req.token) return null;
  var t = loadTokens()[req.token];
  return (t && t.exp > Date.now()) ? { role: t.staffRole || 'owner', name: t.staffName || 'Chủ nhà', userId: t.staffId || '', props: t.staffProps || [] } : null;
}
function canWriteCol(staff, col) {
  if (col === 'auditLog') return false;
  var role = staff ? staff.role : 'owner';
  if (role === 'owner') return true;
  if (role === 'manager') return !MANAGER_BLOCK[col];
  var list = ROLE_WRITE[role] || [];
  return list.indexOf(col) >= 0;
}
function writeAudit(actor, role, action, col, recordId, before, after) {
  try {
    appendRecord('auditLog', {
      id: 'au' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      at: new Date().toISOString(), actor: actor || 'Chủ nhà', role: role || 'owner',
      action: action, col: col, recordId: String(recordId || ''),
      before: before || null, after: after || null, note: ''
    });
  } catch (e) {}
}
function auditSnap(col, rec) {
  var keys = AUDIT_COLS[col] || [];
  if (!rec) return null;
  var o = {};
  keys.forEach(function (k) { if (rec[k] !== undefined) o[k] = rec[k]; });
  return o;
}
var TOKEN_DAYS = 60;
var MAX_RECORDS_PER_COLLECTION = 300;   // mỗi lần đồng bộ
var MAX_STRING = 2000;                  // độ dài chuỗi tối đa cho 1 ô
var MAX_LIST_ITEMS = 40;
var MAX_IMAGE_BASE64 = 8 * 1024 * 1024; // ~6MB ảnh sau nén

/* ================= CÀI ĐẶT LẦN ĐẦU / MIGRATION ================= */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var savedId = props.getProperty('SPREADSHEET_ID');
    ss = savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.create('Huy Rooms - Dữ liệu');
  }
  props.setProperty('SPREADSHEET_ID', ss.getId());

  ALL_COLLECTIONS.forEach(function (col) { migrateSheet(ss, col); });
  migratePins();
  migrateLeases();
  migrateBilling();
  migrateLeads();

  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', '123456');
  if (!props.getProperty('IMAGE_FOLDER_ID')) {
    var folder = DriveApp.createFolder('Huy Rooms - Anh phong');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  }

  Logger.log('Đã cài đặt xong.');
  Logger.log('Bảng dữ liệu: ' + ss.getUrl());
  return 'OK';
}

/**
 * Đưa 1 sheet về đúng cấu trúc cột mới nhất mà KHÔNG mất dữ liệu:
 * đọc theo tên cột cũ, ghi lại theo thứ tự cột mới. Cột mới thiếu → để trống.
 */
function migrateSheet(ss, col) {
  var conf = SCHEMA[col];
  var sh = ss.getSheetByName(conf.sheet) || ss.insertSheet(conf.sheet);
  var wantHeader = conf.fields.map(function (f) { return f[0]; }).concat(META);

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var current = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var same = current.length === wantHeader.length && wantHeader.every(function (h, i) { return current[i] === h; });

  if (!same && lastRow > 1 && current.length && current[0] === 'id') {
    // Có dữ liệu với cấu trúc cũ → chuyển đổi theo tên cột
    var old = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var idx = {};
    current.forEach(function (h, i) { idx[h] = i; });
    var rows = old.map(function (r) {
      return wantHeader.map(function (h) {
        return idx[h] === undefined ? '' : r[idx[h]];
      });
    }).filter(function (r) { return r[0] !== '' && r[0] !== null; });
    sh.clearContents();
    sh.getRange(1, 1, 1, wantHeader.length).setValues([wantHeader]);
    if (rows.length) sh.getRange(2, 1, rows.length, wantHeader.length).setValues(rows);
  } else {
    sh.getRange(1, 1, 1, wantHeader.length).setValues([wantHeader]);
  }
  sh.getRange(1, 1, 1, wantHeader.length).setFontWeight('bold').setBackground('#efe7dd');
  sh.setFrozenRows(1);
}

/** Chuyển mọi PIN còn ở dạng chữ rõ sang dạng băm rồi xóa PIN rõ. */
function migratePins() {
  var conf = SCHEMA.tenants, sh = getSS().getSheetByName(conf.sheet);
  if (!sh || sh.getLastRow() < 2) return;
  var names = conf.fields.map(function (f) { return f[0]; });
  var cPin = names.indexOf('pin'), cHash = names.indexOf('pinHash'),
      cSalt = names.indexOf('pinSalt'), cAt = names.indexOf('pinUpdatedAt');
  var width = names.length + META.length;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  values.forEach(function (r, i) {
    var plain = String(r[cPin] || '').trim();
    if (!plain || r[cHash]) { if (plain && r[cHash]) sh.getRange(i + 2, cPin + 1).setValue(''); return; }
    var salt = Utilities.getUuid().replace(/-/g, '');
    sh.getRange(i + 2, cPin + 1).setValue('');
    sh.getRange(i + 2, cHash + 1).setValue(hashPin(salt, plain));
    sh.getRange(i + 2, cSalt + 1).setValue(salt);
    sh.getRange(i + 2, cAt + 1).setValue(new Date().toISOString());
  });
  Logger.log('Đã chuyển PIN sang dạng băm.');
}

/** Quên mật khẩu: sửa dòng dưới thành mật khẩu mới rồi Run hàm này. */
function datLaiMatKhau() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', '123456');
  PropertiesService.getScriptProperties().deleteProperty('TOKENS');
  Logger.log('Đã đặt lại mật khẩu quản lý về 123456 (đăng nhập xong phải đổi ngay)');
}

/** Mở nhanh bảng dữ liệu. */
function moBangDuLieu() {
  Logger.log(getSS().getUrl());
}

function getSS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Chưa chạy hàm setup');
  return SpreadsheetApp.openById(id);
}

/* ================= TIỆN ÍCH BẢO MẬT ================= */

function hashPin(salt, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(pin), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
/** So sánh chuỗi thời gian không phụ thuộc nội dung (constant-time). */
function safeEqual(a, b) {
  a = String(a); b = String(b);
  var diff = a.length === b.length ? 0 : 1;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0 && a.length === b.length;
}
function bumpCounter(key, ttlSec) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), ttlSec);
  return n;
}
function counter(key) { return Number(CacheService.getScriptCache().get(key) || 0); }

/* ================= HTTP ================= */

function doGet(e) {
  if (e && e.parameter && e.parameter.p) return apiGet(e); // đường dự phòng JSONP
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Huy Rooms — Tìm phòng & Quản lý nhà trọ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(
      'Máy chủ Huy Rooms đang chạy. Dán đường dẫn này vào biến APPS_SCRIPT_URL trên Vercel.'
    ).setMimeType(ContentService.MimeType.TEXT);
  }
}

/** Website nhúng gọi thẳng hàm này qua google.script.run. */
function api(bodyJson) {
  var out;
  try { out = route(JSON.parse(bodyJson)); }
  catch (err) { out = { ok: false, error: publicError(err) }; }
  return JSON.stringify(out);
}

/** Bản đặt trên hosting riêng gọi vào đây. */
function doPost(e) {
  var out;
  try { out = route(JSON.parse(e.postData.contents)); }
  catch (err) { out = { ok: false, error: publicError(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiGet(e) {
  var out;
  try {
    var raw = Utilities.newBlob(Utilities.base64Decode(e.parameter.p)).getDataAsString();
    out = route(JSON.parse(raw));
  } catch (err) { out = { ok: false, error: publicError(err) }; }
  var body = JSON.stringify(out);
  if (e.parameter.callback) {
    if (!/^[A-Za-z0-9_]+$/.test(e.parameter.callback)) {
      return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService.createTextOutput(e.parameter.callback + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/** Lỗi thân thiện: không lộ chi tiết nội bộ Apps Script cho khách. */
function publicError(err) {
  var s = String((err && err.message) || err || '');
  if (s.indexOf('HR:') === 0) return s.slice(3); // lỗi chủ động, an toàn để hiển thị
  return 'Máy chủ đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.';
}
function fail(msg) { return { ok: false, error: msg }; }

var ACTIONS = ['login', 'ping', 'sync', 'resident', 'upload', 'deleteImage',
  'setPassword', 'setTenantPin', 'book', 'logout', 'logoutAll', 'sessions',
  'residentPing', 'residentTicket', 'residentChangePin', 'residentLogoutAll', 'residentMarkRead',
  'sendZalo', 'setStaffPass', 'unlockReading', 'getPrivateImage', 'residentLogout', 'residentImage'];

function route(req) {
  if (!req || ACTIONS.indexOf(req.action) < 0) return fail('Không hiểu yêu cầu');
  if (req.action === 'login') return handleLogin(req);
  if (req.action === 'book') return handleBook(req);          // khách được phép
  if (req.action === 'resident') return handleResident(req);  // cư dân được phép
  if (req.action === 'residentPing') return handleResidentPing(req);
  if (req.action === 'residentTicket') return handleResidentTicket(req);
  if (req.action === 'residentChangePin') return handleResidentChangePin(req);
  if (req.action === 'residentLogoutAll') return handleResidentLogoutAll(req);
  if (req.action === 'residentLogout') return handleResidentLogout(req);
  if (req.action === 'residentImage') return handleResidentImage(req);
  if (req.action === 'residentMarkRead') return handleResidentMarkRead(req);

  var role = roleOf(req);
  if (role === 'expired') return { ok: false, code: 'auth', error: 'Phiên đăng nhập đã hết hạn, đăng nhập lại' };
  var ctx = authContext(req);

  switch (req.action) {
    case 'ping':
      // v4.1: trả lại hồ sơ vai trò để client khôi phục sau reload
      return { ok: true, role: role, serverTime: Date.now(),
        staff: ctx.authenticated ? { role: ctx.role, name: ctx.staffName, id: ctx.staffId, propertyIds: ctx.propertyIds } : null };
    case 'sync': return handleSync(req, role, ctx);
    case 'logout': return handleLogout(req);
    case 'logoutAll':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner') return forbidden('Chỉ chủ nhà được đăng xuất mọi thiết bị');
      return handleLogoutAll();
    case 'sessions':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner') return forbidden('Chỉ chủ nhà xem được danh sách phiên đăng nhập');
      return handleSessions(req);
    case 'upload':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      return handleUpload(req, ctx);
    case 'deleteImage':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner' && ctx.role !== 'manager') return forbidden('Chỉ chủ nhà/quản lý được xóa ảnh');
      return handleDeleteImage(req);
    case 'getPrivateImage':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      return handleGetPrivateImage(req, ctx);
    case 'setPassword':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner') return forbidden('Chỉ chủ nhà đổi được mật khẩu chủ nhà');
      return handleSetPassword(req);
    case 'setTenantPin':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner' && ctx.role !== 'manager') return forbidden('Chỉ chủ nhà/quản lý đặt được PIN cư dân');
      return handleSetTenantPin(req, ctx);
    case 'unlockReading':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner' && ctx.role !== 'manager') return forbidden('Chỉ chủ nhà/quản lý được mở khóa kỳ đã chốt');
      return handleUnlockReading(req, ctx);
    case 'sendZalo':
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (['owner', 'manager', 'accountant'].indexOf(ctx.role) < 0) return forbidden('Vai trò của bạn không gửi được Zalo');
      return handleSendZalo(req);
    case 'setStaffPass': {
      if (!ctx.authenticated) return fail('Cần quyền quản lý');
      if (ctx.role !== 'owner') return forbidden('Chỉ chủ nhà đặt được mật khẩu nhân viên');
      return handleSetStaffPass(req, staffOf(req));
    }
    default: return fail('Không hiểu yêu cầu');
  }
}

/* ================= SAO LƯU ================= */
/** Sao lưu toàn bộ spreadsheet thành bản copy trong Drive, giữ 14 bản gần nhất.
 * Chạy tay trong Apps Script, hoặc vào Triggers → thêm trigger hằng ngày cho hàm này. */
function backupSpreadsheet() {
  var ss = getSS();
  var file = DriveApp.getFileById(ss.getId());
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('BACKUP_FOLDER_ID');
  var folder;
  if (folderId) { folder = DriveApp.getFolderById(folderId); }
  else { folder = DriveApp.createFolder('Huy Rooms - Sao luu'); props.setProperty('BACKUP_FOLDER_ID', folder.getId()); }
  var name = 'HuyRooms-backup-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
  file.makeCopy(name, folder);
  // giữ 14 bản mới nhất
  var files = [], it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 14; i < files.length; i++) files[i].setTrashed(true);
  Logger.log('Đã sao lưu: ' + name + ' (đang giữ ' + Math.min(files.length, 14) + ' bản)');
}

/* ================= TÀI KHOẢN QUẢN LÝ / TOKEN ================= */

function loadTokens() {
  var raw = PropertiesService.getScriptProperties().getProperty('TOKENS') || '{}';
  var tokens;
  try { tokens = JSON.parse(raw); } catch (e) { tokens = {}; }
  // Tương thích định dạng cũ: token -> số (hạn dùng)
  Object.keys(tokens).forEach(function (t) {
    if (typeof tokens[t] === 'number') tokens[t] = { exp: tokens[t], created: 0, deviceName: '' };
  });
  return tokens;
}
function saveTokens(tokens) {
  PropertiesService.getScriptProperties().setProperty('TOKENS', JSON.stringify(tokens));
}

function roleOf(req) {
  var props = PropertiesService.getScriptProperties();
  if (req.token) {
    var tokens = loadTokens();
    var t = tokens[req.token];
    if (t && t.exp > Date.now()) return 'admin';
    return 'expired';
  }
  var wk = props.getProperty('WRITE_KEY');
  if (wk && req.key && safeEqual(req.key, wk)) return 'admin';
  return 'guest'; // khách chỉ xem được phòng, không thấy người thuê / hóa đơn
}

function issueToken(tokens, deviceName) {
  var now = Date.now();
  Object.keys(tokens).forEach(function (t) { if (tokens[t].exp <= now) delete tokens[t]; });
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  tokens[token] = {
    exp: now + TOKEN_DAYS * 86400000,
    created: now,
    deviceName: String(deviceName || '').slice(0, 60)
  };
  return token;
}

function handleLogin(req) {
  // Giới hạn dò mật khẩu: tối đa 8 lần sai trong 10 phút (toàn hệ thống,
  // Apps Script không cho biết IP người gọi).
  if (counter('adminFail') >= 8) {
    return fail('Nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.');
  }
  var props = PropertiesService.getScriptProperties();
  var given = String(req.password || '');
  var user = String(req.user || '').trim().toLowerCase();

  // Đăng nhập NHÂN VIÊN: có tên tài khoản → tra sheet NhanSu
  if (user) {
    var su = readSince('staffUsers', 0, true).filter(function (u) { return !u.deleted && u.active; })
      .filter(function (u) { return String(u.username || '').toLowerCase() === user; })[0];
    if (!su || !su.passHash || !su.passSalt || !safeEqual(hashPin(su.passSalt, given), su.passHash)) {
      bumpCounter('adminFail', 600);
      Utilities.sleep(1200);
      return fail('Tài khoản hoặc mật khẩu chưa đúng');
    }
    CacheService.getScriptCache().remove('adminFail');
    var tokens1 = loadTokens();
    var token1 = issueToken(tokens1, req.deviceName);
    tokens1[token1].staffRole = ['owner', 'manager', 'accountant', 'staff'].indexOf(su.role) >= 0 ? su.role : 'staff';
    tokens1[token1].staffName = su.name || su.username;
    tokens1[token1].staffId = su.id;
    tokens1[token1].staffProps = Array.isArray(su.propertyIds) ? su.propertyIds : [];
    saveTokens(tokens1);
    writeAudit(tokens1[token1].staffName, tokens1[token1].staffRole, 'login', 'staffUsers', su.id, null, null);
    return { ok: true, token: token1, role: 'admin',
      staff: { role: tokens1[token1].staffRole, name: tokens1[token1].staffName, id: su.id, propertyIds: tokens1[token1].staffProps },
      mustChangePassword: false };
  }

  // Đăng nhập CHỦ NHÀ bằng mật khẩu chính
  var pass = props.getProperty('ADMIN_PASSWORD') || '123456';
  var wk = props.getProperty('WRITE_KEY');
  if (!safeEqual(given, pass) && !(wk && safeEqual(given, wk))) {
    bumpCounter('adminFail', 600);
    Utilities.sleep(1200);
    return fail('Mật khẩu quản lý chưa đúng');
  }
  CacheService.getScriptCache().remove('adminFail');
  var tokens = loadTokens();
  var token = issueToken(tokens, req.deviceName);
  saveTokens(tokens);
  return { ok: true, token: token, role: 'admin',
    staff: { role: 'owner', name: 'Chủ nhà', id: '', propertyIds: [] },
    mustChangePassword: pass === '123456' || pass.length < 10 };
}

function handleSetPassword(req) {
  var np = String(req.newPassword || '').trim();
  if (np.length < 10) return fail('Mật khẩu cần ít nhất 10 ký tự (nên có cả chữ và số)');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', np);
  // Vô hiệu hóa toàn bộ token cũ, cấp token mới cho phiên đang đổi mật khẩu
  var tokens = {};
  var token = issueToken(tokens, req.deviceName || 'Thiết bị vừa đổi mật khẩu');
  saveTokens(tokens);
  return { ok: true, token: token };
}

function handleLogout(req) {
  if (!req.token) return { ok: true };
  var tokens = loadTokens();
  delete tokens[req.token];
  saveTokens(tokens);
  return { ok: true };
}
function handleLogoutAll() {
  saveTokens({});
  return { ok: true };
}
function handleSessions(req) {
  var tokens = loadTokens(), now = Date.now();
  var list = Object.keys(tokens).filter(function (t) { return tokens[t].exp > now; }).map(function (t) {
    return {
      current: t === req.token,
      deviceName: tokens[t].deviceName || 'Không tên',
      created: tokens[t].created,
      exp: tokens[t].exp
    };
  });
  return { ok: true, sessions: list };
}

/* ================= ĐỒNG BỘ ================= */

/** Mốc thời gian luôn tăng, hai lần ghi không bao giờ trùng mốc. */
function nextStamp() {
  var p = PropertiesService.getScriptProperties();
  var last = Number(p.getProperty('LAST_STAMP') || 0);
  var t = Math.max(Date.now(), last + 1);
  p.setProperty('LAST_STAMP', String(t));
  return t;
}

function handleSync(req, role, ctx) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var stamp = nextStamp();
    var incoming = req.changes || {};
    var staff = staffOf(req);
    var scoped = ctx && ctx.authenticated && ctx.role !== 'owner' && ctx.propertyIds && ctx.propertyIds.length > 0;
    var maps = scoped ? buildScopeMaps() : null;
    // Khách không được ghi gì qua sync (đặt lịch dùng action 'book' riêng)
    var writable = role === 'admin' ? ALL_COLLECTIONS : [];
    var skippedWrite = [];
    var syncResults = { conflicts: [], rejected: [], scopeSkipped: [] };
    writable.forEach(function (col) {
      var list = incoming[col];
      if (!list || !list.length) return;
      if (!canWriteCol(staff, col)) { skippedWrite.push(col); return; }  // phân quyền theo vai trò
      if (list.length > MAX_RECORDS_PER_COLLECTION) {
        throw new Error('HR:Quá nhiều bản ghi trong một lần đồng bộ (' + col + ')');
      }
      applyChanges(col, list, stamp, role, staff, { ctx: ctx, maps: maps, scoped: scoped, results: syncResults });
    });

    var since = Number(req.since || 0);
    var readable = role === 'admin' ? ALL_COLLECTIONS.slice() : PUBLIC_COLLECTIONS;
    if (role === 'admin' && staff && ['accountant', 'staff'].indexOf(staff.role) >= 0) {
      readable = readable.filter(function (c) { return c !== 'auditLog' && c !== 'staffUsers'; });
    }
    var out = {};
    readable.forEach(function (col) {
      var rows = readSince(col, since);
      // Khách vãng lai: KHÔNG trả ghi chú nội bộ của phòng
      if (role !== 'admin' && col === 'rooms') {
        rows = rows.map(function (r) { var c = {}; for (var k in r) c[k] = r[k]; c.note = ''; return c; });
      }
      // Phạm vi căn: nhân viên được giao căn nào chỉ nhận dữ liệu căn đó (kể cả bản ghi xóa mềm không xác định được thì vẫn trả để dọn cache)
      if (scoped && rows.length) {
        rows = rows.filter(function (r) {
          if (r.deleted) return true;
          return inScope(ctx, propertyIdOfRecord(col, r, maps));
        });
      }
      if (rows.length) out[col] = rows;
    });
    return { ok: true, role: role, serverTime: stamp, changes: out,
      skippedWrite: skippedWrite.length ? skippedWrite : undefined,
      conflicts: syncResults.conflicts.length ? syncResults.conflicts : undefined,
      rejected: syncResults.rejected.length ? syncResults.rejected : undefined,
      scopeSkipped: syncResults.scopeSkipped.length ? syncResults.scopeSkipped : undefined };
  } finally {
    lock.releaseLock();
  }
}

function sheetOf(col) {
  var sh = getSS().getSheetByName(SCHEMA[col].sheet);
  if (!sh) throw new Error('HR:Thiếu sheet ' + SCHEMA[col].sheet + '. Hãy chạy lại hàm setup.');
  return sh;
}

/** Chuẩn hóa 1 bản ghi từ client: cắt chuỗi quá dài, ép số hợp lệ. */
/** ID hợp lệ: chữ, số, gạch dưới, gạch nối — tối đa 80 ký tự.
 * Chặn kiểu tấn công đặt id chứa dấu nháy / thẻ HTML rồi chờ client render. */
var SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
function isSafeId(v) { return SAFE_ID.test(String(v || '')); }

function sanitizeRecord(rec, fields) {
  fields.forEach(function (f) {
    var k = f[0], v = rec[k];
    if (v === undefined || v === null) return;
    switch (f[1]) {
      case 'n':
        v = Number(v);
        rec[k] = isFinite(v) ? Math.max(-1e12, Math.min(1e12, v)) : 0;
        break;
      case 'b':
        rec[k] = v === true || v === 'true';
        break;
      case 'csv':
      case 'lines':
        rec[k] = (Array.isArray(v) ? v : []).slice(0, MAX_LIST_ITEMS)
          .map(function (x) { return String(x).slice(0, 500); });
        break;
      case 'json':
        try { rec[k] = JSON.parse(JSON.stringify(v)); } catch (e) { rec[k] = []; }
        if (JSON.stringify(rec[k] || []).length > 20000) rec[k] = [];
        break;
      default:
        rec[k] = String(v).slice(0, MAX_STRING);
    }
  });
  return rec;
}

var FINANCIAL_APPEND_ONLY = { payments: 1, depositLedger: 1 };
function applyChanges(col, list, stamp, role, staff, opt) {
  if (role !== 'admin') return; // phòng hờ: chỉ quản lý được ghi qua sync
  opt = opt || {};
  var results = opt.results || { conflicts: [], rejected: [], scopeSkipped: [] };
  var auditKeys = AUDIT_COLS[col];
  var actor = staff ? staff.name : 'Chủ nhà', actorRole = staff ? staff.role : 'owner';
  function rowToRec(r) { return fromRow(r, SCHEMA[col].fields); }
  function reject(id, reason) { results.rejected.push({ collection: col, id: id, reason: reason }); }
  var conf = SCHEMA[col], sh = sheetOf(col);
  var width = conf.fields.length + META.length;
  var last = sh.getLastRow();
  var values = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
  var index = {};
  values.forEach(function (r, i) { if (r[0] !== '') index[String(r[0])] = i; });

  var names = conf.fields.map(function (f) { return f[0]; });
  var protectedIdx = (PRIVATE_FIELDS[col] || []).map(function (k) { return names.indexOf(k); });

  var appends = [];
  list.forEach(function (rec) {
    if (!rec || !rec.id) return;
    if (!isSafeId(rec.id)) return; // id lạ (dấu nháy, thẻ, khoảng trắng) → loại thẳng
    var id = String(rec.id);
    var i = index[id];
    var serverRec = i !== undefined ? rowToRec(values[i]) : null;
    var serverStamp = i !== undefined ? Number(values[i][conf.fields.length] || 0) : 0;
    var serverDeleted = i !== undefined && (values[i][conf.fields.length + 1] === true || String(values[i][conf.fields.length + 1]).toUpperCase() === 'TRUE');

    // ---- Phạm vi căn: chặn ghi record ngoài căn được giao (cả bản cũ lẫn bản định ghi) ----
    if (opt.scoped) {
      var pOld = serverRec ? propertyIdOfRecord(col, serverRec, opt.maps) : '';
      var pNew = propertyIdOfRecord(col, rec, opt.maps);
      if ((pOld && !inScope(opt.ctx, pOld)) || (pNew && !inScope(opt.ctx, pNew))) {
        results.scopeSkipped.push({ collection: col, id: id });
        return;
      }
    }

    // ---- TÀI CHÍNH: payments & sổ cọc là sổ APPEND-ONLY ----
    if (FINANCIAL_APPEND_ONLY[col] && i !== undefined && !serverDeleted) {
      // đã tồn tại → cấm sửa/xóa; sai thì tạo giao dịch đảo
      if (rec.deleted) { reject(id, 'Sổ giao dịch không cho xóa — hãy tạo giao dịch đảo'); return; }
      var same = JSON.stringify(auditSnap(col, serverRec)) === JSON.stringify(auditSnap(col, rec));
      // cho phép đúng MỘT thay đổi hợp lệ: đánh dấu reversedAt lên giao dịch gốc
      var onlyReversalMark = col === 'payments' && serverRec && !serverRec.reversedAt && rec.reversedAt &&
        Number(rec.amount) === Number(serverRec.amount) && rec.kind === serverRec.kind;
      if (!same && !onlyReversalMark) { reject(id, 'Giao dịch đã ghi sổ không được sửa'); return; }
    }
    if (col === 'payments' && i === undefined && !rec.deleted) {
      var amt = Number(rec.amount || 0);
      if (rec.kind === 'payment' && (amt <= 0 || amt > 500000000)) { reject(id, 'Số tiền thanh toán không hợp lệ'); return; }
      if (rec.kind === 'reversal' && (amt >= 0 || !rec.reversalOf)) { reject(id, 'Giao dịch đảo phải âm và ghi rõ đảo của giao dịch nào'); return; }
    }
    if (col === 'depositLedger' && i === undefined && !rec.deleted) {
      if (Number(rec.amount || 0) <= 0) { reject(id, 'Số tiền sổ cọc phải > 0'); return; }
    }
    // Hóa đơn đã có tiền/đã thanh toán: cấm xóa
    if (col === 'invoices' && rec.deleted && serverRec && !serverDeleted &&
        (Number(serverRec.amountPaid || 0) > 0 || serverRec.status === 'paid')) {
      reject(id, 'Hóa đơn đã có tiền thu không được xóa — dùng giao dịch đảo/điều chỉnh'); return;
    }
    // Hóa đơn mới: không trùng phòng+tháng, tenant/room phải tồn tại
    if (col === 'invoices' && i === undefined && !rec.deleted) {
      if (opt.maps === null || opt.maps === undefined) opt.maps = buildScopeMaps();
      if (rec.roomId && opt.maps.roomProp[rec.roomId] === undefined) { reject(id, 'Phòng của hóa đơn không tồn tại'); return; }
      if (rec.tenantId && opt.maps.tenRoom[rec.tenantId] === undefined) { reject(id, 'Người thuê của hóa đơn không tồn tại'); return; }
      var dupInv = false;
      for (var di = 0; di < values.length; di++) {
        var dr = values[di];
        if (dr[conf.fields.length + 1] === true || String(dr[conf.fields.length + 1]).toUpperCase() === 'TRUE') continue;
        var drec = rowToRec(dr);
        if (drec.roomId === rec.roomId && drec.month === rec.month && drec.leaseId === rec.leaseId) { dupInv = true; break; }
      }
      if (dupInv) { reject(id, 'Đã có hóa đơn tháng ' + rec.month + ' cho phòng này'); return; }
    }
    // Chỉ số đã khóa: cấm sửa qua sync (mở khóa phải dùng action unlockReading)
    if (col === 'utilityReadings' && serverRec && !serverDeleted && serverRec.status === 'final' && !rec.deleted) {
      var sameU = JSON.stringify(auditSnap(col, serverRec)) === JSON.stringify(auditSnap(col, rec)) &&
        Number(rec.electricEnd) === Number(serverRec.electricEnd) && Number(rec.waterEnd) === Number(serverRec.waterEnd);
      if (!sameU) { reject(id, 'Kỳ đã chốt — mở khóa (kèm lý do) trước khi sửa'); return; }
    }
    // Chỉ số mới: không trùng phòng+tháng, số cuối không nhỏ hơn số đầu
    if (col === 'utilityReadings' && !rec.deleted) {
      if (Number(rec.electricEnd || 0) && Number(rec.electricEnd) < Number(rec.electricStart || 0)) { reject(id, 'Chỉ số điện cuối nhỏ hơn đầu kỳ'); return; }
      if (rec.waterMode === 'meter' && Number(rec.waterEnd || 0) && Number(rec.waterEnd) < Number(rec.waterStart || 0)) { reject(id, 'Chỉ số nước cuối nhỏ hơn đầu kỳ'); return; }
      if (i === undefined) {
        for (var ui = 0; ui < values.length; ui++) {
          var ur = values[ui];
          if (ur[conf.fields.length + 1] === true || String(ur[conf.fields.length + 1]).toUpperCase() === 'TRUE') continue;
          var urec = rowToRec(ur);
          if (urec.roomId === rec.roomId && urec.month === rec.month) { reject(id, 'Đã có chỉ số tháng ' + rec.month + ' cho phòng này'); return; }
        }
      }
    }
    // Enum lạ → từ chối (chống nhét chuỗi tùy ý vào trạng thái/vai trò)
    if (!rec.deleted) {
      var ev = enumViolation(col, rec);
      if (ev) { reject(id, 'Giá trị không hợp lệ: ' + ev); return; }
    }
    // ---- Optimistic concurrency: client gửi baseUpdatedAt của bản nó đã đọc ----
    var base = rec.baseUpdatedAt !== undefined ? Number(rec.baseUpdatedAt || 0) : null;
    delete rec.baseUpdatedAt;
    if (base !== null) {
      if (i !== undefined && !serverDeleted && serverStamp !== base) {
        var sOut = auditSnap(col, serverRec) || {}; sOut.id = id;
        results.conflicts.push({ collection: col, id: id, expectedUpdatedAt: base, serverUpdatedAt: serverStamp,
          serverRecord: serverRec });
        return; // KHÔNG ghi đè
      }
      if (i !== undefined && !serverDeleted && base === 0) {
        // client tưởng là bản ghi mới nhưng id đã tồn tại → không cho chiếm id
        results.conflicts.push({ collection: col, id: id, expectedUpdatedAt: 0, serverUpdatedAt: serverStamp, serverRecord: serverRec });
        return;
      }
    }

    if (rec.deleted) {
      if (i === undefined) return;
      if (auditKeys) writeAudit(actor, actorRole, 'delete', col, id, auditSnap(col, rowToRec(values[i])), null);
      sh.getRange(i + 2, conf.fields.length + 1, 1, 2).setValues([[stamp, true]]);
      values[i][conf.fields.length] = stamp;
      values[i][conf.fields.length + 1] = true;
      return;
    }

    sanitizeRecord(rec, conf.fields);
    var row = toRow(rec, conf.fields).concat([stamp, false]);
    if (i === undefined) {
      // Bản ghi mới: các cột riêng tư luôn trống, chỉ đặt qua action chuyên dụng
      protectedIdx.forEach(function (p) { if (p >= 0) row[p] = ''; });
      index[id] = values.length;
      values.push(row);
      appends.push(row);
      if (auditKeys) writeAudit(actor, actorRole, 'create', col, id, null, auditSnap(col, rec));
    } else {
      // Ghi đè: giữ nguyên các cột riêng tư đang có trên máy chủ
      protectedIdx.forEach(function (p) { if (p >= 0) row[p] = values[i][p]; });
      if (auditKeys) {
        var beforeSnap = auditSnap(col, rowToRec(values[i])), afterSnap = auditSnap(col, rec);
        if (JSON.stringify(beforeSnap) !== JSON.stringify(afterSnap)) {
          writeAudit(actor, actorRole, 'update', col, id, beforeSnap, afterSnap);
        }
      }
      sh.getRange(i + 2, 1, 1, width).setValues([row]);
      values[i] = row;
    }
  });

  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, appends[0].length).setValues(appends);
  }
}

/**
 * Đọc các bản ghi thay đổi sau mốc `since`.
 * Mặc định LƯỢC BỎ các cột riêng tư (PIN…) và thêm cờ hasPin cho người thuê.
 * raw=true chỉ dùng nội bộ trong máy chủ.
 */
var _stampCache = null;
function colStampKey(col) { return 'LASTSTAMP_' + col; }
function touchColStamp(col, stamp) {
  try { PropertiesService.getScriptProperties().setProperty(colStampKey(col), String(stamp)); } catch (e) {}
  if (_stampCache) _stampCache[col] = stamp;
}
function colStamp(col) {
  if (!_stampCache) {
    _stampCache = {};
    try {
      var all = PropertiesService.getScriptProperties().getProperties();
      Object.keys(all).forEach(function (k) {
        if (k.indexOf('LASTSTAMP_') === 0) _stampCache[k.slice(10)] = Number(all[k] || 0);
      });
    } catch (e) {}
  }
  return _stampCache[col] || 0;
}

function readSince(col, since, raw) {
  // Tối ưu: sheet chưa có ghi nào mới hơn `since` → khỏi đụng vào Sheets API
  if (!raw && since > 0) {
    var lastW = colStamp(col);
    if (lastW > 0 && lastW <= since) return [];
  }
  var conf = SCHEMA[col], sh = sheetOf(col);
  var width = conf.fields.length + META.length;
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, width).getValues();
  var out = [];
  values.forEach(function (r, rowIndex) {
    if (r[0] === '' || r[0] === null) return;
    var updatedAt = Number(r[conf.fields.length] || 0);
    if (updatedAt <= since) return;
    var rec = fromRow(r, conf.fields);
    rec.updatedAt = updatedAt;
    if (raw) rec._row = rowIndex + 2;
    var del = r[conf.fields.length + 1];
    if (del === true || String(del).toUpperCase() === 'TRUE') {
      out.push({ id: rec.id, deleted: true, updatedAt: updatedAt });
      return;
    }
    if (!raw && PRIVATE_FIELDS[col]) {
      if (col === 'tenants') rec.hasPin = !!(rec.pinHash || rec.pin);
      if (col === 'accounts') rec.hasPin = !!rec.pinHash;
      PRIVATE_FIELDS[col].forEach(function (k) { delete rec[k]; });
    }
    out.push(rec);
  });
  return out;
}

function toRow(rec, fields) {
  return fields.map(function (f) {
    var v = rec[f[0]];
    switch (f[1]) {
      case 'n': return Number(v || 0);
      case 'b': return v === true || v === 'true';
      case 'csv': return (v || []).join(', ');
      case 'lines': return (v || []).join('\n');
      case 'json': return v === undefined || v === null ? '' : JSON.stringify(v);
      default: return v === undefined || v === null ? '' : String(v);
    }
  });
}

function fromRow(row, fields) {
  var rec = {};
  fields.forEach(function (f, i) {
    var v = row[i];
    switch (f[1]) {
      case 'n': rec[f[0]] = Number(v || 0); break;
      case 'b': rec[f[0]] = v === true || String(v).toUpperCase() === 'TRUE'; break;
      case 'csv': rec[f[0]] = splitList(v, ','); break;
      case 'lines': rec[f[0]] = splitList(v, '\n'); break;
      case 'json':
        try { rec[f[0]] = v ? JSON.parse(v) : []; } catch (e) { rec[f[0]] = []; }
        break;
      default: rec[f[0]] = v === null || v === undefined ? '' : String(v); break;
    }
  });
  return rec;
}

function splitList(v, sep) {
  if (!v) return [];
  return String(v).split(sep).map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}

/* ================= MIGRATION SANG MÔ HÌNH HỢP ĐỒNG (v4 giai đoạn 2) ================= */

function appendRecord(col, rec) {
  var conf = SCHEMA[col], sh = sheetOf(col), stamp = nextStamp();
  sh.getRange(sh.getLastRow() + 1, 1, 1, conf.fields.length + 2)
    .setValues([toRow(rec, conf.fields).concat([stamp, false])]);
  touchColStamp(col, stamp);
  return rec;
}
function writeCell(col, rowNumber, fieldName, value) {
  var conf = SCHEMA[col], sh = sheetOf(col);
  var names = conf.fields.map(function (f) { return f[0]; });
  sh.getRange(rowNumber, names.indexOf(fieldName) + 1).setValue(value);
  var st = nextStamp();
  sh.getRange(rowNumber, conf.fields.length + 1).setValue(st);
  touchColStamp(col, st);
}

/**
 * Chuyển dữ liệu người thuê hiện có sang mô hình hợp đồng:
 *  - mỗi người thuê đang hoạt động có phòng → 1 hợp đồng active (giá thuê chốt theo giá phòng lúc chạy),
 *  - 1 dòng người ở với vai trò đại diện,
 *  - 1 tài khoản đăng nhập (chuyển pinHash/pinSalt từ người thuê sang).
 * Chạy lại nhiều lần KHÔNG tạo trùng: kiểm tra tồn tại theo người thuê / hợp đồng / SĐT.
 */
function migrateLeases() {
  var tenants = readSince('tenants', 0, true).filter(function (t) { return !t.deleted; });
  var rooms = readSince('rooms', 0, true).filter(function (r) { return !r.deleted; });
  var leases = readSince('leases', 0, true).filter(function (l) { return !l.deleted; });
  var los = readSince('leaseOccupants', 0, true).filter(function (x) { return !x.deleted; });
  var accounts = readSince('accounts', 0, true).filter(function (a) { return !a.deleted; });
  var invoices = readSince('invoices', 0, true).filter(function (i) { return !i.deleted; });
  var settings = readSince('settings', 0, true)[0] || {};
  var byRoom = {}; rooms.forEach(function (r) { byRoom[r.id] = r; });
  var created = 0;

  tenants.forEach(function (t) {
    if (!t.active || !t.roomId) return;
    var lease = null;
    leases.forEach(function (l) { if (!lease && l.primaryTenantId === t.id && l.status !== 'cancelled') lease = l; });
    if (!lease) {
      var room = byRoom[t.roomId] || {};
      lease = {
        id: 'l_mig_' + t.id, propertyId: room.propertyId || '', roomId: t.roomId,
        primaryTenantId: t.id, startDate: t.moveInDate || '', endDate: '',
        billingDay: Number(settings.defaultDueDay || 5),
        rentAmount: Number(room.price || 0),               // snapshot giá lúc chuyển đổi
        depositRequired: Number(t.depositRequired || 0), depositPaid: Number(t.depositPaid || 0),
        status: 'active', signedAt: t.moveInDate || '', moveInAt: t.moveInDate || '',
        moveOutAt: '', terminationReason: '', note: 'Chuyển tự động từ dữ liệu người thuê cũ',
        createdAt: new Date().toISOString(), depositDeduct: 0, depositRefund: 0,
        settlementNote: '', roomHistory: [], renewals: []
      };
      appendRecord('leases', lease); leases.push(lease); created++;
    }
    var hasLo = los.some(function (x) { return x.leaseId === lease.id && x.occupantId === t.id; });
    if (!hasLo) {
      var lo = { id: 'lo_mig_' + t.id, leaseId: lease.id, occupantId: t.id, role: 'primary',
        joinedAt: lease.startDate || '', leftAt: '', note: '', createdAt: new Date().toISOString() };
      appendRecord('leaseOccupants', lo); los.push(lo);
    }
    var phone = String(t.phone || '').replace(/\D/g, '');
    var hasAcc = accounts.some(function (a) { return a.occupantId === t.id || (phone && String(a.phone).replace(/\D/g, '') === phone); });
    if (!hasAcc && phone) {
      var acc = { id: 'acc_mig_' + t.id, phone: phone, occupantId: t.id, active: true,
        pinHash: t.pinHash || '', pinSalt: t.pinSalt || '', pinUpdatedAt: t.pinUpdatedAt || '',
        createdAt: new Date().toISOString(), note: 'Chuyển từ người thuê' };
      appendRecord('accounts', acc); accounts.push(acc);
    }
  });

  // Gắn leaseId cho hóa đơn cũ còn trống (theo người thuê đại diện)
  var leaseByTenant = {};
  leases.forEach(function (l) { if (l.status !== 'cancelled' && !leaseByTenant[l.primaryTenantId]) leaseByTenant[l.primaryTenantId] = l.id; });
  invoices.forEach(function (i) {
    if (i.leaseId || !leaseByTenant[i.tenantId]) return;
    writeCell('invoices', i._row, 'leaseId', leaseByTenant[i.tenantId]);
  });

  Logger.log('migrateLeases: tạo mới ' + created + ' hợp đồng.');
}

/**
 * v4 giai đoạn 3 — chuyển sang sổ giao dịch:
 *  - từng lần thu trong cột payments (json) của hóa đơn → 1 dòng sổ ThanhToan,
 *  - tiền cọc trên hợp đồng → sổ cọc SoCoc (thu cọc, và trừ/hoàn nếu đã thanh lý).
 * Idempotent nhờ id cố định theo nguồn.
 */

/** v4 giai đoạn 5: chuyển trạng thái lịch hẹn cũ sang phễu CRM. Idempotent. */
function migrateLeads() {
  var conf = SCHEMA.appointments, sh = sheetOf('appointments');
  var names = conf.fields.map(function (f) { return f[0]; });
  var map = { confirmed: 'appointment_confirmed', done: 'viewed', cancelled: 'lost' };
  var rows = readSince('appointments', 0, true).filter(function (a) { return !a.deleted; });
  rows.forEach(function (a) {
    if (map[a.status]) {
      sh.getRange(a._row, names.indexOf('status') + 1).setValue(map[a.status]);
      sh.getRange(a._row, conf.fields.length + 1).setValue(nextStamp());
    }
  });
  Logger.log('migrateLeads xong.');
}
function migrateBilling() {
  var pays = readSince('payments', 0, true).filter(function (p) { return !p.deleted; });
  var payIds = {}; pays.forEach(function (p) { payIds[p.id] = 1; });
  var invoices = readSince('invoices', 0, true).filter(function (i) { return !i.deleted; });
  invoices.forEach(function (inv) {
    var list = Array.isArray(inv.payments) ? inv.payments : [];
    list.forEach(function (p, idx) {
      var id = 'pay_mig_' + inv.id + '_' + idx;
      if (payIds[id]) return;
      payIds[id] = 1;
      appendRecord('payments', {
        id: id, invoiceId: inv.id, kind: 'payment', amount: Number(p.amount || 0),
        paidAt: String(p.date || p.at || inv.createdAt || '').slice(0, 10),
        method: String(p.method || 'cash'), reference: '', note: String(p.note || ''),
        createdBy: 'migration', reversedAt: '', reversalReason: '', reversalOf: '',
        createdAt: new Date().toISOString()
      });
    });
  });

  var deps = readSince('depositLedger', 0, true).filter(function (d) { return !d.deleted; });
  var depIds = {}; deps.forEach(function (d) { depIds[d.id] = 1; });
  var leases = readSince('leases', 0, true).filter(function (l) { return !l.deleted; });
  leases.forEach(function (l) {
    if (Number(l.depositPaid) > 0 && !depIds['dep_mig_' + l.id]) {
      depIds['dep_mig_' + l.id] = 1;
      appendRecord('depositLedger', { id: 'dep_mig_' + l.id, leaseId: l.id, type: 'collect',
        amount: Number(l.depositPaid), at: String(l.signedAt || l.startDate || '').slice(0, 10),
        method: 'cash', note: 'Chuyển từ dữ liệu cọc trên hợp đồng', createdBy: 'migration',
        createdAt: new Date().toISOString() });
    }
    if (l.status === 'ended') {
      if (Number(l.depositDeduct) > 0 && !depIds['depd_mig_' + l.id]) {
        depIds['depd_mig_' + l.id] = 1;
        appendRecord('depositLedger', { id: 'depd_mig_' + l.id, leaseId: l.id, type: 'deduct',
          amount: Number(l.depositDeduct), at: String(l.moveOutAt || '').slice(0, 10),
          method: '', note: l.settlementNote || 'Trừ cọc khi thanh lý', createdBy: 'migration',
          createdAt: new Date().toISOString() });
      }
      if (Number(l.depositRefund) > 0 && !depIds['depr_mig_' + l.id]) {
        depIds['depr_mig_' + l.id] = 1;
        appendRecord('depositLedger', { id: 'depr_mig_' + l.id, leaseId: l.id, type: 'refund',
          amount: Number(l.depositRefund), at: String(l.moveOutAt || '').slice(0, 10),
          method: 'cash', note: 'Hoàn cọc khi thanh lý', createdBy: 'migration',
          createdAt: new Date().toISOString() });
      }
    }
  });
  Logger.log('migrateBilling xong.');
}

/* ================= ĐẶT LỊCH XEM PHÒNG (KHÁCH) ================= */

function normalizeVNPhone(v) {
  var p = String(v || '').replace(/\D/g, '');
  if (p.indexOf('84') === 0 && p.length === 11) p = '0' + p.slice(2);
  if (!/^0\d{9}$/.test(p)) return '';
  return p;
}

function handleBook(req) {
  try {
    // Honeypot: bot điền vào ô ẩn → trả lời "thành công" nhưng không lưu gì
    if (String(req.website || '').trim() !== '') return { ok: true, id: 'ok' };

    var name = String(req.customerName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (name.length < 2) return fail('Vui lòng nhập họ tên (2–80 ký tự)');
    var phone = normalizeVNPhone(req.customerPhone);
    if (!phone) return fail('Số điện thoại chưa đúng. Ví dụ: 0905123456');
    var note = String(req.note || '').trim().slice(0, 500);
    var date = String(req.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Ngày xem phòng chưa hợp lệ');
    var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (date < todayStr) return fail('Ngày xem phòng không được ở quá khứ');
    var time = String(req.time || '').trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail('Giờ xem phòng chưa hợp lệ');
    if (!req.consent) return fail('Vui lòng đồng ý với chính sách bảo mật để đặt lịch');
    // Chỉ nhận lịch trong giờ làm việc (cài trong CaiDat, mặc định 08:00–20:00)
    var st0 = readSince('settings', 0, true).filter(function (x) { return !x.deleted; })[0] || {};
    var ws = /^\d{2}:\d{2}$/.test(String(st0.workStart)) ? String(st0.workStart) : '08:00';
    var we = /^\d{2}:\d{2}$/.test(String(st0.workEnd)) ? String(st0.workEnd) : '20:00';
    if (time < ws || time > we) return fail('Vui lòng chọn giờ trong khung làm việc ' + ws + '–' + we);
    var roomId = String(req.roomId || '').slice(0, 80);
    if (roomId && !isSafeId(roomId)) return fail('Mã phòng không hợp lệ');

    // Chống spam: tối đa 3 lịch / SĐT + phòng / giờ, 30 lịch / giờ toàn hệ thống
    if (counter('book_all') >= 30) return fail('Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau.');
    if (counter('book_' + phone + '_' + roomId) >= 3) {
      return fail('Bạn vừa gửi nhiều yêu cầu cho phòng này. Quản lý sẽ liên hệ sớm, vui lòng chờ nhé.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var rooms = readSince('rooms', 0).filter(function (r) { return !r.deleted && r.id === roomId; });
      var room = rooms[0];
      if (!room || room.archived) return fail('Phòng này không còn trên hệ thống');
      // Phòng trống & phòng sắp trống (đang thuê) đều xem được; bảo trì / đang giữ chỗ thì không
      if (room.status === 'maintenance' || room.status === 'reserved') {
        return fail('Phòng này hiện chưa nhận đặt lịch xem');
      }

      var dead = { cancelled: 1, lost: 1 };
      var appts = readSince('appointments', 0).filter(function (a) { return !a.deleted && !dead[a.status]; });
      var dup = appts.some(function (a) {
        return a.roomId === roomId && normalizeVNPhone(a.customerPhone) === phone &&
          a.date === date && a.time === time;
      });
      if (dup) return fail('Bạn đã đặt đúng khung giờ này rồi. Quản lý sẽ sớm liên hệ xác nhận.');
      // CHỐNG TRÙNG LỊCH: mỗi khung giờ của một phòng chỉ nhận MỘT khách
      var clash = appts.some(function (a) {
        return a.roomId === roomId && a.date === date && a.time === time;
      });
      if (clash) return fail('Khung giờ này đã có khách khác hẹn xem. Vui lòng chọn giờ khác.');

      var stamp = nextStamp();
      var src = ['website', 'facebook', 'zalo', 'walkin', 'referral', 'other'].indexOf(String(req.source)) >= 0 ? String(req.source) : 'website';
      var rec = {
        id: 'a' + stamp.toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        roomId: roomId, customerName: name, customerPhone: phone,
        date: date, time: time, note: note,
        status: 'new', createdAt: new Date().toISOString(),
        source: src, careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: ''
      };
      var conf = SCHEMA.appointments, sh = sheetOf('appointments');
      sh.getRange(sh.getLastRow() + 1, 1, 1, conf.fields.length + 2)
        .setValues([toRow(rec, conf.fields).concat([stamp, false])]);
      touchColStamp('appointments', stamp); // thiết bị quản trị nhận lịch mới ngay lần sync sau

      bumpCounter('book_all', 3600);
      bumpCounter('book_' + phone + '_' + roomId, 3600);
      return { ok: true, id: rec.id };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return fail(publicError(err));
  }
}

/* ================= CƯ DÂN ================= */

function handleResident(req) {
  try {
    var phone = normalizeVNPhone(req.phone) || String(req.phone || '').replace(/\D/g, '');
    var pin = String(req.pin || '').trim();
    if (!phone || !pin) return fail('Thiếu số điện thoại hoặc mã PIN');

    var cache = CacheService.getScriptCache();
    var failKey = 'fail_' + phone;
    if (Number(cache.get(failKey) || 0) >= 5) {
      return fail('Nhập sai nhiều lần, thử lại sau 10 phút');
    }

    var tenants = readSince('tenants', 0, true).filter(function (t) { return !t.deleted; });
    var tById = {}; tenants.forEach(function (t) { tById[t.id] = t; });

    // 1) Tài khoản đăng nhập tách riêng khỏi hồ sơ người ở
    var me = null, myAccount = null;
    var accounts = readSince('accounts', 0, true).filter(function (a) { return !a.deleted && a.active; });
    accounts.forEach(function (a) {
      if (me) return;
      if (String(a.phone || '').replace(/\D/g, '') !== phone) return;
      if (a.pinHash && a.pinSalt && safeEqual(hashPin(a.pinSalt, pin), a.pinHash)) {
        var occ = tById[a.occupantId];
        if (occ && occ.active) { me = occ; myAccount = a; }
      }
    });

    // 2) Đường cũ: PIN còn nằm trên hồ sơ người thuê → đăng nhập được thì tạo tài khoản mới
    if (!me) {
      tenants.forEach(function (t) {
        if (me || !t.active) return;
        if (String(t.phone || '').replace(/\D/g, '') !== phone) return;
        if (t.pinHash && t.pinSalt) {
          if (safeEqual(hashPin(t.pinSalt, pin), t.pinHash)) me = t;
        } else if (t.pin) {
          if (safeEqual(String(t.pin), pin)) {
            me = t;
            try {
              var salt = Utilities.getUuid().replace(/-/g, '');
              writeTenantPinCells(t._row, '', hashPin(salt, pin), salt, new Date().toISOString());
            } catch (e) {}
          }
        }
      });
      if (me) {
        try {
          myAccount = { id: 'acc_' + me.id, phone: phone, occupantId: me.id, active: true,
            pinHash: me.pinHash || '', pinSalt: me.pinSalt || '', pinUpdatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(), note: 'Tạo khi đăng nhập bằng PIN cũ' };
          var exists = readSince('accounts', 0, true).some(function (a) { return !a.deleted && a.occupantId === me.id; });
          if (!exists) appendRecord('accounts', myAccount);
        } catch (e) {}
      }
    }

    if (!me) {
      cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 600);
      Utilities.sleep(800);
      return fail('Số điện thoại hoặc mã PIN không đúng');
    }
    cache.remove(failKey);

    // Hợp đồng đang gắn với người ở này (đại diện hoặc ở cùng)
    var leases = readSince('leases', 0).filter(function (l) { return !l.deleted; });
    var los = readSince('leaseOccupants', 0).filter(function (x) { return !x.deleted; });
    var myLease = null;
    var live = function (l) { return l.status === 'active' || l.status === 'ending'; };
    leases.forEach(function (l) { if (!myLease && live(l) && l.primaryTenantId === me.id) myLease = l; });
    if (!myLease) {
      los.forEach(function (x) {
        if (myLease || x.occupantId !== me.id || x.leftAt) return;
        leases.forEach(function (l) { if (!myLease && live(l) && l.id === x.leaseId) myLease = l; });
      });
    }
    var coOccupants = [];
    if (myLease) {
      los.forEach(function (x) {
        if (x.leaseId !== myLease.id || x.leftAt) return;
        var occ = tById[x.occupantId];
        if (occ) coOccupants.push({ id: occ.id, name: occ.name, role: x.role });
      });
    }

    var roomId = (myLease && myLease.roomId) || me.roomId;
    var rooms = readSince('rooms', 0).filter(function (r) { return !r.deleted; });
    var room = null;
    rooms.forEach(function (r) { if (r.id === roomId) room = r; });
    var props = readSince('properties', 0).filter(function (p) { return !p.deleted; });
    var property = null;
    props.forEach(function (p) { if (room && p.id === room.propertyId) property = p; });

    var invoices = readSince('invoices', 0).filter(function (i) {
      return !i.deleted && (i.tenantId === me.id || (myLease && i.leaseId === myLease.id));
    });
    var readings = readSince('utilityReadings', 0).filter(function (u) { return !u.deleted && u.roomId === roomId; });
    var invIds = {}; invoices.forEach(function (i) { invIds[i.id] = 1; });
    var payRows = readSince('payments', 0).filter(function (p2) { return !p2.deleted && invIds[p2.invoiceId]; });
    var settings = readSince('settings', 0).filter(function (s) { return !s.deleted; })[0] || {};

    // Sự cố + thông báo + bàn giao + sổ cọc của đúng cư dân này
    var tickets = readSince('maintenanceTickets', 0).filter(function (k) {
      return !k.deleted && (k.tenantId === me.id || (myLease && k.leaseId === myLease.id));
    });
    var notices = readSince('notifications', 0).filter(function (n) {
      return !n.deleted && (n.tenantId === '' || n.tenantId === me.id);
    });
    var handover = myLease ? readSince('handoverItems', 0).filter(function (h) {
      return !h.deleted && h.leaseId === myLease.id;
    }) : [];
    var roomAssets = readSince('assets', 0).filter(function (as) { return !as.deleted && as.roomId === roomId; });
    var depRows = myLease ? readSince('depositLedger', 0).filter(function (d3) {
      return !d3.deleted && d3.leaseId === myLease.id;
    }) : [];

    // v4.1: phiên RIÊNG cho từng thiết bị — token ngẫu nhiên, máy chủ chỉ giữ hash, hết hạn 12h
    myAccount = findResidentAccount(phone) || myAccount;   // lấy bản có _row (kể cả tài khoản vừa tạo)
    var deviceToken = myAccount ? issueResidentSession(myAccount.id, req.deviceName) : '';

    // v4.1: DTO THEO WHITELIST — chỉ liệt kê trường cư dân được xem, không "delete vài trường"
    return {
      ok: true,
      tenant: toResidentTenantDTO(me), room: toResidentRoomDTO(room), property: toResidentPropertyDTO(property),
      lease: toResidentLeaseDTO(myLease), coOccupants: (coOccupants || []).map(toResidentCoOccupantDTO),
      invoices: (invoices || []).map(toResidentInvoiceDTO),
      readings: (readings || []).map(toResidentReadingDTO),
      payments: (payRows || []).map(toResidentPaymentDTO),
      tickets: (tickets || []).map(toResidentTicketDTO),
      notifications: (notices || []).map(toResidentNotificationDTO),
      handoverItems: (handover || []).map(toResidentHandoverDTO),
      assets: (roomAssets || []).map(toResidentAssetDTO),
      depositLedger: (depRows || []).map(toResidentDepositDTO),
      sessionKey: deviceToken,
      settings: {
        managerName: settings.managerName || '',
        managerPhone: settings.managerPhone || '',
        brandName: settings.brandName || '',
        bankCode: settings.bankCode || '',
        bankAccount: settings.bankAccount || '',
        bankAccountName: settings.bankAccountName || '',
        defaultDueDay: settings.defaultDueDay || 5
      }
    };
  } catch (err) {
    return fail(publicError(err));
  }
}


/* ================= CƯ DÂN: PHIÊN, SỰ CỐ, ĐỔI PIN (v4 giai đoạn 4) ================= */

/** Tìm tài khoản cư dân theo SĐT (đã chuẩn hóa). */
function findResidentAccount(phone) {
  var accounts = readSince('accounts', 0, true).filter(function (a) { return !a.deleted && a.active; });
  for (var i = 0; i < accounts.length; i++) {
    if (String(accounts[i].phone || '').replace(/\D/g, '') === phone) return accounts[i];
  }
  return null;
}
function accountCell(acc, field, value) {
  var conf = SCHEMA.accounts, sh = sheetOf('accounts');
  var names = conf.fields.map(function (f) { return f[0]; });
  sh.getRange(acc._row, names.indexOf(field) + 1).setValue(value);
  var st = nextStamp();
  sh.getRange(acc._row, conf.fields.length + 1).setValue(st);
  touchColStamp('accounts', st);
}
/** Xác thực phiên cư dân bằng SĐT + sessionKey do máy chủ cấp lúc đăng nhập.
 *  Đăng xuất mọi thiết bị = đổi seed → mọi sessionKey cũ vô hiệu. */


/* ===== DTO CƯ DÂN — WHITELIST TỪNG TRƯỜNG (v4.1) ===== */
function pickFields(rec, keys) {
  if (!rec) return null;
  var o = {};
  keys.forEach(function (k) { if (rec[k] !== undefined) o[k] = rec[k]; });
  return o;
}
function toResidentTenantDTO(t) { return pickFields(t, ['id', 'name', 'phone', 'moveInDate', 'active', 'depositRequired', 'depositPaid', 'hasPin']); }
function toResidentRoomDTO(r) { return pickFields(r, ['id', 'name', 'type', 'price', 'deposit', 'area', 'capacity', 'status', 'electricRate', 'waterMode', 'waterRate', 'waterFixed', 'amenities', 'imageIds', 'slug', 'policies']); }
function toResidentPropertyDTO(p) { return pickFields(p, ['id', 'name', 'area', 'address', 'phone', 'imageIds', 'slug']); }
function toResidentLeaseDTO(l) { return pickFields(l, ['id', 'roomId', 'startDate', 'endDate', 'billingDay', 'rentAmount', 'depositRequired', 'depositPaid', 'status', 'signedAt']); }
function toResidentCoOccupantDTO(t) { return pickFields(t, ['id', 'name', 'role', 'joinedAt']); }
function toResidentInvoiceDTO(i) { return pickFields(i, ['id', 'code', 'month', 'items', 'total', 'amountPaid', 'status', 'adjustAmount', 'adjustNote', 'depositAmount', 'dueDate', 'createdAt', 'roomId', 'leaseId', 'tenantId', 'readingId']); }
function toResidentReadingDTO(u) { return pickFields(u, ['id', 'roomId', 'month', 'electricStart', 'electricEnd', 'electricRate', 'electricUnits', 'electricAmount', 'waterMode', 'waterStart', 'waterEnd', 'waterRate', 'waterFixed', 'waterUnits', 'waterAmount', 'otherFee', 'status', 'imageIds']); }
function toResidentPaymentDTO(p) { return pickFields(p, ['id', 'invoiceId', 'kind', 'amount', 'paidAt', 'method', 'reference', 'reversalOf']); }
function toResidentTicketDTO(k) { return pickFields(k, ['id', 'roomId', 'title', 'category', 'description', 'priority', 'status', 'imageIds', 'statusHistory', 'createdAt', 'resolution']); }
function toResidentNotificationDTO(n) { return pickFields(n, ['id', 'tenantId', 'kind', 'title', 'body', 'refId', 'createdAt', 'readAt']); }
function toResidentHandoverDTO(h) { return pickFields(h, ['id', 'leaseId', 'name', 'qty', 'condition', 'residentNote']); }
function toResidentAssetDTO(a) { return pickFields(a, ['id', 'roomId', 'name', 'qty', 'condition', 'residentNote']); }
function toResidentDepositDTO(d) { return pickFields(d, ['id', 'leaseId', 'type', 'amount', 'at', 'method']); }

/* ===== PHIÊN CƯ DÂN THEO THIẾT BỊ (v4.1) =====
 * Token ngẫu nhiên cấp lúc đăng nhập, máy chủ CHỈ lưu hash.
 * Hết hạn sau RESIDENT_SESSION_HOURS (mặc định 12h). Mỗi thiết bị một phiên. */
function residentSessions() {
  var raw = PropertiesService.getScriptProperties().getProperty('RSESS') || '{}';
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
function saveResidentSessions(sess) {
  PropertiesService.getScriptProperties().setProperty('RSESS', JSON.stringify(sess));
}
function residentSessionHours() {
  var h = Number(PropertiesService.getScriptProperties().getProperty('RESIDENT_SESSION_HOURS') || 12);
  return (h >= 1 && h <= 720) ? h : 12;
}
function sha256hex(txt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function issueResidentSession(accountId, deviceName) {
  var sess = residentSessions();
  var now = Date.now();
  // dọn phiên hết hạn / thu hồi
  Object.keys(sess).forEach(function (h) {
    if (sess[h].expiresAt <= now || sess[h].revokedAt) delete sess[h];
  });
  var token = 'rs' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  sess[sha256hex(token)] = {
    accountId: accountId, createdAt: now,
    expiresAt: now + residentSessionHours() * 3600000,
    deviceName: String(deviceName || '').slice(0, 60), revokedAt: 0
  };
  saveResidentSessions(sess);
  return token;
}
function revokeResidentSessions(accountId, exceptTokenHash) {
  var sess = residentSessions(), n = 0;
  Object.keys(sess).forEach(function (h) {
    if (sess[h].accountId === accountId && h !== exceptTokenHash) { delete sess[h]; n++; }
  });
  saveResidentSessions(sess);
  return n;
}

function residentAuth(req) {
  var phone = normalizeVNPhone(req.phone) || String(req.phone || '').replace(/\D/g, '');
  var key = String(req.sessionKey || '').trim();
  if (!phone || !key) return { err: fail('Thiếu thông tin phiên đăng nhập') };
  var cache = CacheService.getScriptCache();
  var failKey = 'rfail_' + phone;
  if (Number(cache.get(failKey) || 0) >= 20) return { err: fail('Thao tác quá nhiều, thử lại sau ít phút') };
  var acc = findResidentAccount(phone);
  var sess = residentSessions();
  var hk = sha256hex(key);
  var entry = sess[hk];
  var okSession = acc && entry && entry.accountId === acc.id && !entry.revokedAt && entry.expiresAt > Date.now();
  if (!okSession) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 600);
    return { err: { ok: false, code: 'session', error: 'Phiên cư dân không còn hiệu lực, hãy đăng nhập lại' } };
  }
  req._sessionHash = hk;
  var tenants = readSince('tenants', 0, true).filter(function (t) { return !t.deleted; });
  var me = null;
  tenants.forEach(function (t) { if (!me && t.id === acc.occupantId && t.active) me = t; });
  if (!me) return { err: fail('Tài khoản không còn gắn với người ở nào') };
  return { account: acc, me: me };
}
function residentLeaseOf(me) {
  var leases = readSince('leases', 0, true).filter(function (l) { return !l.deleted; });
  var los = readSince('leaseOccupants', 0, true).filter(function (x) { return !x.deleted; });
  var live = function (l) { return l.status === 'active' || l.status === 'ending'; };
  var myLease = null;
  leases.forEach(function (l) { if (!myLease && live(l) && l.primaryTenantId === me.id) myLease = l; });
  if (!myLease) {
    los.forEach(function (x) {
      if (myLease || x.occupantId !== me.id || x.leftAt) return;
      leases.forEach(function (l) { if (!myLease && live(l) && l.id === x.leaseId) myLease = l; });
    });
  }
  return myLease;
}

function handleResidentPing(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  return { ok: true, serverTime: Date.now() };
}

/** Cư dân tạo sự cố. tenantId/leaseId/roomId do MÁY CHỦ tự gắn theo phiên — không tin client. */
function handleResidentTicket(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var cache = CacheService.getScriptCache();
  var qKey = 'tq_' + String(a.account.phone || '');
  if (Number(cache.get(qKey) || 0) >= 10) return fail('Anh/chị đã gửi nhiều yêu cầu hôm nay, vui lòng chờ xử lý.');
  var title = String(req.title || '').trim().slice(0, 120);
  if (!title) return fail('Thiếu tiêu đề sự cố');
  var lease = residentLeaseOf(a.me);
  var imageIds = [];
  var imgs = Array.isArray(req.images) ? req.images.slice(0, 3) : [];
  for (var i = 0; i < imgs.length; i++) {
    var up = handleUpload({ data: imgs[i].data, mime: imgs[i].mime, name: imgs[i].name || ('su-co-' + Date.now() + '.jpg') });
    if (up && up.ok) imageIds.push(up.url || up.id);
  }
  var now = new Date().toISOString();
  var ticket = {
    id: 'tk' + Date.now() + Math.random().toString(36).slice(2, 6),
    title: title,
    category: String(req.category || 'khac').slice(0, 40),
    description: String(req.description || '').trim().slice(0, 2000),
    priority: ['low', 'normal', 'high', 'urgent'].indexOf(String(req.priority)) >= 0 ? String(req.priority) : 'normal',
    imageIds: imageIds,
    status: 'new',
    tenantId: a.me.id,
    leaseId: lease ? lease.id : '',
    roomId: (lease && lease.roomId) || a.me.roomId || '',
    assigneeId: '',
    statusHistory: [{ at: now, status: 'new', by: 'Cư dân', note: '' }],
    resolution: '',
    createdAt: now,
    closedAt: ''
  };
  appendRecord('maintenanceTickets', ticket);
  cache.put(qKey, String(Number(cache.get(qKey) || 0) + 1), 86400);
  return { ok: true, ticket: ticket };
}

/** Đổi PIN: bắt buộc xác thực PIN CŨ (kèm phiên hợp lệ); đổi xong hủy phiên mọi thiết bị. */
function handleResidentChangePin(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var cache = CacheService.getScriptCache();
  var failKey = 'pfail_' + String(a.account.phone || '');
  if (Number(cache.get(failKey) || 0) >= 5) return fail('Nhập sai PIN cũ nhiều lần, thử lại sau 10 phút');
  var oldPin = String(req.oldPin || '').trim();
  var newPin = String(req.newPin || '').trim();
  if (!/^\d{6}$/.test(newPin)) return fail('PIN mới phải gồm đúng 6 chữ số');
  if (newPin === oldPin) return fail('PIN mới phải khác PIN cũ');
  if (!(a.account.pinHash && a.account.pinSalt && safeEqual(hashPin(a.account.pinSalt, oldPin), a.account.pinHash))) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 600);
    Utilities.sleep(500);
    return fail('PIN cũ không đúng');
  }
  cache.remove(failKey);
  var salt = Utilities.getUuid().replace(/-/g, '');
  accountCell(a.account, 'pinHash', hashPin(salt, newPin));
  accountCell(a.account, 'pinSalt', salt);
  accountCell(a.account, 'pinUpdatedAt', new Date().toISOString());
  revokeResidentSessions(a.account.id, null); // đổi PIN → hủy phiên MỌI thiết bị (v4.1 session store)
  return { ok: true, relogin: true };
}

/** Đăng xuất mọi thiết bị của tài khoản cư dân: đổi seed phiên. */
function handleResidentLogoutAll(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var n = revokeResidentSessions(a.account.id, null);
  return { ok: true, revoked: n };
}
/** Cư dân xem ảnh PRIVATE thuộc đúng sự cố/chỉ số của phòng mình. */
function handleResidentImage(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var id = String(req.imageId || '');
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) return fail('Mã ảnh không hợp lệ');
  var mine = false;
  readSince('maintenanceTickets', 0, true).some(function (k) {
    if (!k.deleted && k.tenantId === a.me.id && (k.imageIds || []).indexOf(id) >= 0) { mine = true; return true; }
    return false;
  });
  if (!mine) {
    var roomId = a.me.roomId;
    readSince('utilityReadings', 0, true).some(function (u) {
      if (!u.deleted && u.roomId === roomId && (u.imageIds || []).indexOf(id) >= 0) { mine = true; return true; }
      return false;
    });
  }
  if (!mine) return forbidden('Ảnh này không thuộc hồ sơ của bạn');
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { return fail('Không tìm thấy ảnh'); }
  var blob = file.getBlob();
  return { ok: true, id: id, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

/** Đăng xuất ĐÚNG thiết bị này — phiên khác giữ nguyên. */
function handleResidentLogout(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var sess = residentSessions();
  delete sess[req._sessionHash];
  saveResidentSessions(sess);
  return { ok: true };
}

/** Đánh dấu đã đọc thông báo CÁ NHÂN của chính mình (thông báo chung đánh dấu trên từng máy). */
function handleResidentMarkRead(req) {
  var a = residentAuth(req);
  if (a.err) return a.err;
  var ids = Array.isArray(req.ids) ? req.ids.slice(0, 50) : [];
  if (!ids.length) return { ok: true, marked: 0 };
  var conf = SCHEMA.notifications, sh = sheetOf('notifications');
  var names = conf.fields.map(function (f) { return f[0]; });
  var rows = readSince('notifications', 0, true).filter(function (n) { return !n.deleted; });
  var marked = 0, now = new Date().toISOString();
  rows.forEach(function (n) {
    if (ids.indexOf(n.id) < 0) return;
    if (n.tenantId !== a.me.id) return;      // chỉ thông báo của chính mình
    if (n.readAt) return;
    sh.getRange(n._row, names.indexOf('readAt') + 1).setValue(now);
    sh.getRange(n._row, conf.fields.length + 1).setValue(nextStamp());
    marked++;
  });
  return { ok: true, marked: marked };
}

/* ================= ZALO OA ADAPTER (không hard-code token) =================
 * Cấu hình bằng Script Properties (Extensions → Apps Script → Project Settings → Script Properties):
 *   ZALO_OA_TOKEN = access token của Zalo Official Account
 *   ZALO_OA_MOCK  = '1' để chạy thử KHÔNG gửi thật (kết quả trả về ghi rõ mock)
 * Người nhận: điền cột zaloUserId trong sheet NguoiThue (user id theo dõi OA, KHÔNG phải SĐT).
 */
function zaloConfig() {
  var props = PropertiesService.getScriptProperties();
  return { token: props.getProperty('ZALO_OA_TOKEN') || '', mock: props.getProperty('ZALO_OA_MOCK') === '1' };
}
function handleSendZalo(req) {
  var cfg = zaloConfig();
  var tenants = readSince('tenants', 0, true).filter(function (t) { return !t.deleted; });
  var target = null;
  tenants.forEach(function (t) { if (!target && t.id === String(req.tenantId || '')) target = t; });
  if (!target) return fail('Không tìm thấy người thuê');
  var message = String(req.message || '').trim().slice(0, 2000);
  if (!message) return fail('Thiếu nội dung tin nhắn');
  if (cfg.mock) {
    return { ok: true, mock: true, channel: 'zalo_mock',
      info: 'CHẾ ĐỘ THỬ — tin KHÔNG được gửi thật. Tắt ZALO_OA_MOCK và đặt ZALO_OA_TOKEN để gửi thật.' };
  }
  if (!cfg.token) {
    return { ok: false, notConfigured: true,
      error: 'Chưa cấu hình Zalo OA. Đặt Script Property ZALO_OA_TOKEN (không dán token vào code), điền zaloUserId cho người thuê rồi thử lại.' };
  }
  if (!target.zaloUserId) {
    return { ok: false, noMapping: true,
      error: 'Người thuê chưa có zaloUserId (cột trong sheet NguoiThue). Lấy user id từ người theo dõi OA của anh.' };
  }
  try {
    var resp = UrlFetchApp.fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'post',
      contentType: 'application/json',
      headers: { access_token: cfg.token },
      muteHttpExceptions: true,
      payload: JSON.stringify({ recipient: { user_id: String(target.zaloUserId) }, message: { text: message } })
    });
    var body = {};
    try { body = JSON.parse(resp.getContentText() || '{}'); } catch (e2) {}
    if (Number(body.error) === 0) return { ok: true, sent: true, channel: 'zalo_oa' };
    return { ok: false, error: 'Zalo trả lỗi: ' + (body.message || resp.getResponseCode()) };
  } catch (err) {
    return { ok: false, error: 'Không gọi được Zalo API: ' + publicError(err) };
  }
}

/** Chủ nhà đặt / đặt lại mật khẩu cho nhân viên. Mật khẩu chỉ trả về đúng 1 lần. */
/** Mở khóa kỳ điện nước đã chốt — CON ĐƯỜNG HỢP LỆ DUY NHẤT khi online (v4.1). */
function handleUnlockReading(req, ctx) {
  var id = String(req.readingId || '');
  if (!isSafeId(id)) return fail('Mã chỉ số không hợp lệ');
  var reason = String(req.reason || '').trim().slice(0, 300);
  if (!reason) return fail('Cần ghi lý do mở khóa');
  var rec = readSince('utilityReadings', 0, true).filter(function (u) { return !u.deleted && u.id === id; })[0];
  if (!rec) return fail('Không tìm thấy kỳ chỉ số');
  if (rec.status !== 'final') return fail('Kỳ này chưa chốt, không cần mở khóa');
  if (ctx && ctx.role !== 'owner' && ctx.propertyIds && ctx.propertyIds.length) {
    var maps = buildScopeMaps();
    if (!inScope(ctx, propertyIdOfRecord('utilityReadings', rec, maps))) return forbidden('Kỳ này thuộc căn bạn không được giao');
  }
  var conf = SCHEMA.utilityReadings, sh = sheetOf('utilityReadings');
  var names = conf.fields.map(function (f) { return f[0]; });
  sh.getRange(rec._row, names.indexOf('status') + 1).setValue('draft');
  sh.getRange(rec._row, names.indexOf('unlockNote') + 1)
    .setValue((rec.unlockNote ? rec.unlockNote + ' | ' : '') + new Date().toISOString().slice(0, 10) + ': ' + reason);
  sh.getRange(rec._row, names.indexOf('lockedAt') + 1).setValue('');
  var stU = nextStamp();
  sh.getRange(rec._row, conf.fields.length + 1).setValue(stU);
  touchColStamp('utilityReadings', stU);
  writeAudit(ctx ? ctx.staffName : 'Chủ nhà', ctx ? ctx.role : 'owner', 'update', 'utilityReadings', id,
    { status: 'final' }, { status: 'draft', unlockNote: reason });
  return { ok: true };
}

function handleSetStaffPass(req, staff) {
  if (!isSafeId(req.staffId)) return fail('Mã nhân viên không hợp lệ');
  var su = readSince('staffUsers', 0, true).filter(function (u) { return !u.deleted && u.id === String(req.staffId || ''); })[0];
  if (!su) return fail('Không tìm thấy nhân viên');
  var pass = String(req.password || '').trim();
  if (!pass) pass = Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
  if (pass.length < 8) return fail('Mật khẩu nhân viên cần ít nhất 8 ký tự');
  var salt = Utilities.getUuid().replace(/-/g, '');
  var conf = SCHEMA.staffUsers, sh = sheetOf('staffUsers');
  var names = conf.fields.map(function (f) { return f[0]; });
  sh.getRange(su._row, names.indexOf('passHash') + 1).setValue(hashPin(salt, pass));
  sh.getRange(su._row, names.indexOf('passSalt') + 1).setValue(salt);
  var stSP = nextStamp();
  sh.getRange(su._row, conf.fields.length + 1).setValue(stSP);
  touchColStamp('staffUsers', stSP);
  writeAudit(staff ? staff.name : 'Chủ nhà', 'owner', 'setPass', 'staffUsers', su.id, null, null);
  return { ok: true, password: pass, username: su.username };
}

function writeTenantPinCells(rowNumber, pinPlain, pinHashVal, pinSaltVal, pinAt) {
  var conf = SCHEMA.tenants, sh = sheetOf('tenants');
  var names = conf.fields.map(function (f) { return f[0]; });
  sh.getRange(rowNumber, names.indexOf('pin') + 1).setValue(pinPlain);
  sh.getRange(rowNumber, names.indexOf('pinHash') + 1).setValue(pinHashVal);
  sh.getRange(rowNumber, names.indexOf('pinSalt') + 1).setValue(pinSaltVal);
  sh.getRange(rowNumber, names.indexOf('pinUpdatedAt') + 1).setValue(pinAt);
  var stP = nextStamp();
  sh.getRange(rowNumber, conf.fields.length + 1).setValue(stP); // updatedAt
  touchColStamp('tenants', stP);
}

/** Quản lý đặt / đặt lại PIN cho cư dân.
 * PIN đặt trên TÀI KHOẢN đăng nhập (tách khỏi hồ sơ người ở); chưa có tài khoản thì tạo.
 * PIN chỉ trả về đúng 1 lần trong phản hồi này. */
function handleSetTenantPin(req, ctx) {
  if (ctx && ctx.role === 'manager' && ctx.propertyIds && ctx.propertyIds.length) {
    var maps0 = buildScopeMaps();
    var t0 = readSince('tenants', 0, true).filter(function (t) { return !t.deleted && t.id === String(req.tenantId || ''); })[0];
    if (t0 && !inScope(ctx, propertyIdOfRecord('tenants', t0, maps0))) {
      return forbidden('Người thuê này không thuộc căn bạn được giao');
    }
  }
  var tenantId = String(req.tenantId || '');
  if (!tenantId) return fail('Thiếu mã người thuê');
  var pin = String(req.pin || '').trim();
  if (pin && !/^\d{6}$/.test(pin)) return fail('Mã PIN phải gồm đúng 6 chữ số');
  if (!pin) pin = String(Math.floor(100000 + Math.random() * 900000));
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tenants = readSince('tenants', 0, true);
    var me = null;
    tenants.forEach(function (t) { if (t.id === tenantId && !t.deleted) me = t; });
    if (!me) return fail('Người thuê này chưa được đồng bộ lên máy chủ. Hãy bấm Đồng bộ rồi thử lại.');
    var phone = String(me.phone || '').replace(/\D/g, '');
    if (!phone) return fail('Người thuê chưa có số điện thoại nên không tạo được tài khoản đăng nhập.');
    var salt = Utilities.getUuid().replace(/-/g, '');
    var accounts = readSince('accounts', 0, true).filter(function (a) { return !a.deleted; });
    var acc = null;
    accounts.forEach(function (a) { if (!acc && a.occupantId === tenantId) acc = a; });
    if (acc) {
      writeCell('accounts', acc._row, 'pinHash', hashPin(salt, pin));
      writeCell('accounts', acc._row, 'pinSalt', salt);
      writeCell('accounts', acc._row, 'pinUpdatedAt', new Date().toISOString());
      writeCell('accounts', acc._row, 'phone', phone);
      writeCell('accounts', acc._row, 'active', true);
    } else {
      acc = { id: 'acc_' + tenantId, phone: phone, occupantId: tenantId, active: true,
        pinHash: hashPin(salt, pin), pinSalt: salt, pinUpdatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(), note: '' };
      appendRecord('accounts', acc);
    }
    // Dọn PIN cũ còn nằm trên hồ sơ người thuê (nếu có)
    if (me.pin || me.pinHash) {
      try { writeTenantPinCells(me._row, '', '', '', ''); } catch (e) {}
    }
    return { ok: true, pin: pin, accountId: acc.id };
  } finally {
    lock.releaseLock();
  }
}

/* ================= ẢNH -> GOOGLE DRIVE ================= */

function imageSignature(bytes) {
  if (!bytes || bytes.length < 12) return null;
  var b = function (i) { return bytes[i] & 255; };
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return { mime: 'image/jpeg', ext: '.jpg' };
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return { mime: 'image/png', ext: '.png' };
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return { mime: 'image/webp', ext: '.webp' };
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return { mime: 'image/gif', ext: '.gif' };
  return null;
}

function handleUpload(req, ctx) {
  if (!req.data || String(req.data).length > MAX_IMAGE_BASE64) {
    return fail('Ảnh quá lớn. Hãy chọn ảnh dưới 6MB.');
  }
  var props = PropertiesService.getScriptProperties();
  // v4.1: ảnh quảng cáo căn/phòng = public; ảnh nghiệp vụ (công tơ, sự cố, bàn giao, giấy tờ) = PRIVATE
  var isPrivate = String(req.scope || '') === 'private';
  var folder;
  if (isPrivate) {
    var pfId = props.getProperty('PRIVATE_IMAGE_FOLDER_ID');
    if (pfId) { folder = DriveApp.getFolderById(pfId); }
    else {
      folder = DriveApp.createFolder('Huy Rooms - Anh nghiep vu (private)');
      props.setProperty('PRIVATE_IMAGE_FOLDER_ID', folder.getId());
      // KHÔNG setSharing — chỉ chủ sở hữu script đọc được; client lấy qua action getPrivateImage
    }
  } else {
    var folderId = props.getProperty('IMAGE_FOLDER_ID');
    if (folderId) { folder = DriveApp.getFolderById(folderId); }
    else {
      folder = DriveApp.createFolder('Huy Rooms - Anh phong');
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      props.setProperty('IMAGE_FOLDER_ID', folderId = folder.getId());
    }
  }
  var bytes;
  try { bytes = Utilities.base64Decode(req.data); } catch (e) { return fail('Dữ liệu ảnh không đọc được.'); }
  // Soi chữ ký file thật (magic bytes) — file giả dạng ảnh sẽ bị loại tại đây
  var sig = imageSignature(bytes);
  if (!sig) return fail('File không phải ảnh JPEG/PNG/WebP/GIF. Vui lòng chọn ảnh chụp thông thường.');
  var blob = Utilities.newBlob(
    bytes,
    sig.mime,
    String(req.name || ('anh-' + Date.now() + sig.ext)).slice(0, 120)
  );
  var file = folder.createFile(blob);
  if (!isPrivate) {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
  }
  return {
    ok: true,
    id: file.getId(),
    scope: isPrivate ? 'private' : 'public',
    url: isPrivate ? '' : 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w1600'
  };
}

/** Lấy ảnh PRIVATE: chỉ quản trị đã đăng nhập, đúng phạm vi căn (nếu ảnh gắn sự cố/chỉ số). */
function handleGetPrivateImage(req, ctx) {
  var id = String(req.imageId || '');
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) return fail('Mã ảnh không hợp lệ');
  var pfId = PropertiesService.getScriptProperties().getProperty('PRIVATE_IMAGE_FOLDER_ID');
  if (!pfId) return fail('Chưa có ảnh riêng tư nào');
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { return fail('Không tìm thấy ảnh'); }
  var inPrivate = false, parents = file.getParents();
  while (parents.hasNext()) { if (parents.next().getId() === pfId) { inPrivate = true; break; } }
  if (!inPrivate) return forbidden('Ảnh này không thuộc kho riêng tư');
  // phạm vi căn: nếu ảnh nằm trong sự cố/chỉ số của căn ngoài phạm vi → chặn
  if (ctx && ctx.role !== 'owner' && ctx.propertyIds && ctx.propertyIds.length) {
    var maps = buildScopeMaps(), owned = null;
    readSince('maintenanceTickets', 0, true).some(function (k) {
      if (!k.deleted && (k.imageIds || []).indexOf(id) >= 0) { owned = propertyIdOfRecord('maintenanceTickets', k, maps); return true; }
      return false;
    });
    if (owned === null) readSince('utilityReadings', 0, true).some(function (u) {
      if (!u.deleted && (u.imageIds || []).indexOf(id) >= 0) { owned = propertyIdOfRecord('utilityReadings', u, maps); return true; }
      return false;
    });
    if (owned && !inScope(ctx, owned)) return forbidden('Ảnh thuộc căn bạn không được giao');
  }
  var blob = file.getBlob();
  return { ok: true, id: id, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

/** Xóa ảnh trên Drive — chỉ cho phép file nằm đúng trong thư mục ảnh của Huy Rooms. */
function handleDeleteImage(req) {
  var fileId = String(req.fileId || '').trim();
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(fileId)) return fail('Mã ảnh không hợp lệ');
  var folderId = PropertiesService.getScriptProperties().getProperty('IMAGE_FOLDER_ID');
  if (!folderId) return fail('Chưa cấu hình thư mục ảnh');
  try {
    var file = DriveApp.getFileById(fileId);
    var parents = file.getParents(), inFolder = false;
    while (parents.hasNext()) { if (parents.next().getId() === folderId) inFolder = true; }
    if (!inFolder) return fail('Ảnh này không thuộc thư mục Huy Rooms nên không được xóa');
    file.setTrashed(true);
    return { ok: true };
  } catch (err) {
    return fail('Không tìm thấy ảnh hoặc không xóa được');
  }
}

/* ================= SỬA TAY TRÊN SHEET VẪN ĐỒNG BỘ ================= */

function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    var conf = null;
    ALL_COLLECTIONS.forEach(function (col) { if (SCHEMA[col].sheet === sh.getName()) conf = SCHEMA[col]; });
    if (!conf || e.range.getRow() < 2) return;
    var stampCol = conf.fields.length + 1;
    if (e.range.getColumn() === stampCol) return;
    var st = 0;
    for (var r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
      st = nextStamp();
      sh.getRange(r, stampCol).setValue(st);
    }
    if (st) {
      ALL_COLLECTIONS.forEach(function (col) { if (SCHEMA[col].sheet === sh.getName()) touchColStamp(col, st); });
    }
  } catch (err) {}
}
