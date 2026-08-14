/**
 * HUY ROOMS — Máy chủ + website chạy thẳng trên Google Apps Script
 * ---------------------------------------------------------------
 * CÀI ĐẶT (4 bước, làm 1 lần):
 *   1. Vào script.google.com → New project. Đổi tên thành "Huy Rooms".
 *   2. Dán file này đè lên Code.gs.
 *      Bấm dấu + bên cạnh Files → HTML → đặt tên đúng là Index → dán file Index.html.
 *   3. Chọn hàm setup trên thanh công cụ → Run → Cho phép quyền.
 *   4. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy.
 *      Mở đường dẫn /exec nhận được: đó chính là website, dữ liệu đã đồng bộ sẵn.
 *
 * Đăng nhập quản lý lần đầu: mật khẩu 123456 (đổi ngay trong Cài đặt).
 * Mỗi lần sửa code: Deploy → Manage deployments → bút chì → Version: New version → Deploy.
 */

var SCHEMA = {
  properties: {
    sheet: 'CanTro',
    fields: [
      ['id', 's'], ['name', 's'], ['area', 's'], ['address', 's'],
      ['description', 's'], ['phone', 's'], ['imageIds', 'lines']
    ]
  },
  rooms: {
    sheet: 'Phong',
    fields: [
      ['id', 's'], ['propertyId', 's'], ['name', 's'], ['type', 's'],
      ['price', 'n'], ['deposit', 'n'], ['area', 'n'], ['capacity', 'n'],
      ['status', 's'], ['electricRate', 'n'], ['waterMode', 's'],
      ['waterRate', 'n'], ['waterFixed', 'n'], ['amenities', 'csv'],
      ['note', 's'], ['imageIds', 'lines']
    ]
  },
  tenants: {
    sheet: 'NguoiThue',
    fields: [
      ['id', 's'], ['name', 's'], ['phone', 's'], ['pin', 's'], ['roomId', 's'],
      ['moveInDate', 's'], ['active', 'b'], ['depositRequired', 'n'],
      ['depositPaid', 'n'], ['note', 's']
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
      ['otherFee', 'n'], ['note', 's'], ['createdAt', 's']
    ]
  },
  invoices: {
    sheet: 'HoaDon',
    fields: [
      ['id', 's'], ['tenantId', 's'], ['roomId', 's'], ['readingId', 's'],
      ['month', 's'], ['dueDate', 's'], ['rent', 'n'], ['electric', 'n'],
      ['water', 'n'], ['other', 'n'], ['depositAmount', 'n'], ['total', 'n'],
      ['amountPaid', 'n'], ['status', 's'], ['depositApplied', 'b'], ['createdAt', 's']
    ]
  },
  appointments: {
    sheet: 'LichHen',
    fields: [
      ['id', 's'], ['roomId', 's'], ['customerName', 's'], ['customerPhone', 's'],
      ['date', 's'], ['time', 's'], ['note', 's'], ['status', 's'], ['createdAt', 's']
    ]
  },
  settings: {
    sheet: 'CaiDat',
    fields: [
      ['id', 's'], ['managerName', 's'], ['managerPhone', 's'],
      ['defaultDueDay', 'n'], ['zaloMode', 's']
    ]
  }
};

var META = ['updatedAt', 'deleted'];
var PUBLIC_COLLECTIONS = ['properties', 'rooms'];
var ALL_COLLECTIONS = ['properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments', 'settings'];
var TOKEN_DAYS = 60;

/* ================= CÀI ĐẶT LẦN ĐẦU ================= */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var savedId = props.getProperty('SPREADSHEET_ID');
    ss = savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.create('Huy Rooms - Dữ liệu');
  }
  props.setProperty('SPREADSHEET_ID', ss.getId());

  ALL_COLLECTIONS.forEach(function (col) {
    var conf = SCHEMA[col];
    var sh = ss.getSheetByName(conf.sheet) || ss.insertSheet(conf.sheet);
    var header = conf.fields.map(function (f) { return f[0]; }).concat(META);
    sh.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#efe7dd');
    sh.setFrozenRows(1);
  });

  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', '123456');
  if (!props.getProperty('IMAGE_FOLDER_ID')) {
    var folder = DriveApp.createFolder('Huy Rooms - Anh phong');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  }

  Logger.log('Đã cài đặt xong.');
  Logger.log('Bảng dữ liệu: ' + ss.getUrl());
  Logger.log('Mật khẩu quản lý ban đầu: ' + props.getProperty('ADMIN_PASSWORD') + ' (đổi ngay trong Cài đặt)');
  return 'OK';
}

/** Quên mật khẩu: sửa dòng dưới thành mật khẩu mới rồi Run hàm này. */
function datLaiMatKhau() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', '123456');
  PropertiesService.getScriptProperties().deleteProperty('TOKENS');
  Logger.log('Đã đặt lại mật khẩu quản lý về 123456');
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

/* ================= HTTP ================= */

/** Mở đường dẫn /exec: trả về chính website. */
function doGet(e) {
  if (e && e.parameter && e.parameter.p) return apiGet(e); // đường dự phòng JSONP
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Huy Rooms — Tìm phòng & Quản lý nhà trọ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    // Không có file Index: đang dùng kiểu đặt website ở nơi khác (Vercel…)
    return ContentService.createTextOutput(
      'Máy chủ Huy Rooms đang chạy. Dán đường dẫn này vào biến APPS_SCRIPT_URL trên Vercel.'
    ).setMimeType(ContentService.MimeType.TEXT);
  }
}

/** Website nhúng gọi thẳng hàm này qua google.script.run. */
function api(bodyJson) {
  var out;
  try { out = route(JSON.parse(bodyJson)); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return JSON.stringify(out);
}

/** Bản đặt trên hosting riêng gọi vào đây. */
function doPost(e) {
  var out;
  try { out = route(JSON.parse(e.postData.contents)); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiGet(e) {
  var out;
  try {
    var raw = Utilities.newBlob(Utilities.base64Decode(e.parameter.p)).getDataAsString();
    out = route(JSON.parse(raw));
  } catch (err) { out = { ok: false, error: String(err) }; }
  var body = JSON.stringify(out);
  if (e.parameter.callback) {
    return ContentService.createTextOutput(e.parameter.callback + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function route(req) {
  if (req.action === 'login') return handleLogin(req);

  var role = roleOf(req);
  if (role === 'expired') return { ok: false, code: 'auth', error: 'Phiên đăng nhập đã hết hạn, đăng nhập lại' };

  switch (req.action) {
    case 'ping': return { ok: true, role: role, serverTime: Date.now() };
    case 'sync': return handleSync(req, role);
    case 'resident': return handleResident(req);
    case 'upload':
      if (role !== 'admin') return { ok: false, error: 'Cần quyền quản lý' };
      return handleUpload(req);
    case 'setPassword':
      if (role !== 'admin') return { ok: false, error: 'Cần quyền quản lý' };
      return handleSetPassword(req);
    default: return { ok: false, error: 'Không hiểu yêu cầu' };
  }
}

/* ================= TÀI KHOẢN QUẢN LÝ ================= */

function roleOf(req) {
  var props = PropertiesService.getScriptProperties();
  if (req.token) {
    var tokens = JSON.parse(props.getProperty('TOKENS') || '{}');
    var exp = tokens[req.token];
    if (exp && exp > Date.now()) return 'admin';
    return 'expired';
  }
  var wk = props.getProperty('WRITE_KEY');
  if (wk && req.key === wk) return 'admin';
  return 'guest'; // khách chỉ xem được phòng, không thấy người thuê / hóa đơn
}

function handleLogin(req) {
  var props = PropertiesService.getScriptProperties();
  var pass = props.getProperty('ADMIN_PASSWORD') || '123456';
  var wk = props.getProperty('WRITE_KEY');
  var given = String(req.password || '');
  if (given !== pass && !(wk && given === wk)) {
    Utilities.sleep(1200); // làm chậm dò mật khẩu
    return { ok: false, error: 'Mật khẩu quản lý chưa đúng' };
  }
  var tokens = JSON.parse(props.getProperty('TOKENS') || '{}');
  var now = Date.now();
  Object.keys(tokens).forEach(function (t) { if (tokens[t] <= now) delete tokens[t]; });
  var token = Utilities.getUuid().replace(/-/g, '');
  tokens[token] = now + TOKEN_DAYS * 86400000;
  props.setProperty('TOKENS', JSON.stringify(tokens));
  return { ok: true, token: token, role: 'admin', mustChangePassword: pass === '123456' };
}

function handleSetPassword(req) {
  var np = String(req.newPassword || '').trim();
  if (np.length < 4) return { ok: false, error: 'Mật khẩu cần ít nhất 4 ký tự' };
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', np);
  return { ok: true };
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

function handleSync(req, role) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var stamp = nextStamp();
    var incoming = req.changes || {};
    var writable = role === 'admin' ? ALL_COLLECTIONS : ['appointments'];
    writable.forEach(function (col) {
      if (incoming[col] && incoming[col].length) applyChanges(col, incoming[col], stamp, role);
    });

    var since = Number(req.since || 0);
    var readable = role === 'admin' ? ALL_COLLECTIONS : PUBLIC_COLLECTIONS;
    var out = {};
    readable.forEach(function (col) {
      var rows = readSince(col, since);
      if (rows.length) out[col] = rows;
    });
    return { ok: true, role: role, serverTime: stamp, changes: out };
  } finally {
    lock.releaseLock();
  }
}

function sheetOf(col) {
  var sh = getSS().getSheetByName(SCHEMA[col].sheet);
  if (!sh) throw new Error('Thiếu sheet ' + SCHEMA[col].sheet + '. Hãy chạy lại hàm setup.');
  return sh;
}

function applyChanges(col, list, stamp, role) {
  var conf = SCHEMA[col], sh = sheetOf(col);
  var width = conf.fields.length + META.length;
  var last = sh.getLastRow();
  var values = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
  var index = {};
  values.forEach(function (r, i) { if (r[0] !== '') index[String(r[0])] = i; });

  var appends = [];
  list.forEach(function (rec) {
    if (!rec || !rec.id) return;
    var id = String(rec.id);
    var i = index[id];

    if (role !== 'admin') {
      // Khách chỉ được tạo lịch hẹn mới, không sửa/xóa dữ liệu có sẵn
      if (i !== undefined || rec.deleted) return;
      rec.status = 'new';
    }

    if (rec.deleted) {
      if (i === undefined) return;
      sh.getRange(i + 2, conf.fields.length + 1, 1, 2).setValues([[stamp, true]]);
      values[i][conf.fields.length] = stamp;
      values[i][conf.fields.length + 1] = true;
      return;
    }

    var row = toRow(rec, conf.fields).concat([stamp, false]);
    if (i === undefined) {
      index[id] = values.length;
      values.push(row);
      appends.push(row);
    } else {
      sh.getRange(i + 2, 1, 1, width).setValues([row]);
      values[i] = row;
    }
  });

  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, appends[0].length).setValues(appends);
  }
}

function readSince(col, since) {
  var conf = SCHEMA[col], sh = sheetOf(col);
  var width = conf.fields.length + META.length;
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, width).getValues();
  var out = [];
  values.forEach(function (r) {
    if (r[0] === '' || r[0] === null) return;
    var updatedAt = Number(r[conf.fields.length] || 0);
    if (updatedAt <= since) return;
    var rec = fromRow(r, conf.fields);
    rec.updatedAt = updatedAt;
    var del = r[conf.fields.length + 1];
    if (del === true || String(del).toUpperCase() === 'TRUE') {
      out.push({ id: rec.id, deleted: true, updatedAt: updatedAt });
    } else {
      out.push(rec);
    }
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
      default: rec[f[0]] = v === null || v === undefined ? '' : String(v); break;
    }
  });
  return rec;
}

function splitList(v, sep) {
  if (!v) return [];
  return String(v).split(sep).map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}

/* ================= CƯ DÂN ================= */

function handleResident(req) {
  var phone = String(req.phone || '').replace(/\D/g, '');
  var pin = String(req.pin || '').trim();
  if (!phone || !pin) return { ok: false, error: 'Thiếu số điện thoại hoặc mã PIN' };

  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + phone;
  if (Number(cache.get(failKey) || 0) >= 5) {
    return { ok: false, error: 'Nhập sai nhiều lần, thử lại sau 10 phút' };
  }

  var tenants = readSince('tenants', 0).filter(function (t) { return !t.deleted; });
  var me = null;
  tenants.forEach(function (t) {
    if (String(t.phone || '').replace(/\D/g, '') === phone && String(t.pin) === pin && t.active) me = t;
  });
  if (!me) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 600);
    Utilities.sleep(800);
    return { ok: false, error: 'Số điện thoại hoặc mã PIN không đúng' };
  }
  cache.remove(failKey);

  var rooms = readSince('rooms', 0).filter(function (r) { return !r.deleted; });
  var room = null;
  rooms.forEach(function (r) { if (r.id === me.roomId) room = r; });
  var props = readSince('properties', 0).filter(function (p) { return !p.deleted; });
  var property = null;
  props.forEach(function (p) { if (room && p.id === room.propertyId) property = p; });

  var invoices = readSince('invoices', 0).filter(function (i) { return !i.deleted && i.tenantId === me.id; });
  var readings = readSince('utilityReadings', 0).filter(function (u) { return !u.deleted && u.roomId === me.roomId; });
  var settings = readSince('settings', 0).filter(function (s) { return !s.deleted; })[0] || {};

  delete me.pin;
  return {
    ok: true,
    tenant: me, room: room, property: property,
    invoices: invoices, readings: readings,
    settings: { managerName: settings.managerName || '', managerPhone: settings.managerPhone || '' }
  };
}

/* ================= ẢNH -> GOOGLE DRIVE ================= */

function handleUpload(req) {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('IMAGE_FOLDER_ID');
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = DriveApp.createFolder('Huy Rooms - Anh phong');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  }
  var blob = Utilities.newBlob(
    Utilities.base64Decode(req.data),
    req.mime || 'image/jpeg',
    req.name || ('anh-' + Date.now() + '.jpg')
  );
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
  return {
    ok: true,
    id: file.getId(),
    url: 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w1600'
  };
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
    for (var r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
      sh.getRange(r, stampCol).setValue(nextStamp());
    }
  } catch (err) {}
}
