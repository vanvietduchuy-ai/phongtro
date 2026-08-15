const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class MemoryRange {
  constructor(sheet, row, col, rows = 1, cols = 1) {
    this.sheet = sheet; this.row = row; this.col = col; this.rows = rows; this.cols = cols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      const line = [];
      for (let c = 0; c < this.cols; c++) line.push(this.sheet.cell(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.sheet.setCell(this.row + r, this.col + c, values[r][c]);
    return this;
  }
  setValue(value) { this.sheet.setCell(this.row, this.col, value); return this; }
  getValue() { return this.sheet.cell(this.row, this.col); }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

class MemorySheet {
  constructor(name) { this.name = name; this.rows = []; }
  cell(row, col) { return (this.rows[row - 1] || [])[col - 1] ?? ''; }
  setCell(row, col, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < col) this.rows[row - 1].push('');
    this.rows[row - 1][col - 1] = value;
  }
  getRange(row, col, rows, cols) { return new MemoryRange(this, row, col, rows, cols); }
  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i].some(v => v !== '' && v !== null && v !== undefined)) return i + 1;
    return 0;
  }
  getLastColumn() { return this.rows.reduce((n, r) => Math.max(n, r.length), 0); }
  getName() { return this.name; }
  setFrozenRows() {}
}

class MemorySpreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const s = new MemorySheet(name); this.sheets.set(name, s); return s; }
  getId() { return 'test-sheet'; }
}

function makePropertyStore() {
  const values = Object.create(null);
  return {
    getProperty: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    setProperty: (key, value) => { values[key] = String(value); },
    deleteProperty: key => { delete values[key]; },
    getProperties: () => ({ ...values })
  };
}

function loadServer() {
  const spreadsheet = new MemorySpreadsheet();
  const props = makePropertyStore();
  let uuid = 0;
  const context = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: date => new Date(date).toISOString().slice(0, 10),
      getUuid: () => `uuid-${++uuid}`,
      sleep() {},
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: () => [1, 2, 3]
    },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    Logger: { log() {} },
    DriveApp: {}, HtmlService: {}, ContentService: {}, UrlFetchApp: {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  Object.keys(context.SCHEMA).forEach(col => {
    const conf = context.SCHEMA[col];
    const sheet = spreadsheet.insertSheet(conf.sheet);
    sheet.getRange(1, 1, 1, conf.fields.length + 2).setValues([conf.fields.map(f => f[0]).concat(context.META)]);
  });
  return context;
}

function addBaseServerData(s) {
  s.appendRecord('properties', { id: 'p1', name: 'Nhà 1', area: '', address: '', description: '', phone: '', imageIds: [], archived: false, slug: 'nha-1' });
  s.appendRecord('rooms', { id: 'r1', propertyId: 'p1', name: 'P101', price: 2000000, deposit: 1000000, area: 20, status: 'available', type: 'Phòng trọ', capacity: 2, amenities: [], note: '', electricRate: 3500, waterMode: 'fixed', waterRate: 15000, waterFixed: 0, imageIds: [], archived: false, slug: 'p101', availableFrom: '', policies: '' });
  s.appendRecord('appointments', { id: 'a1', roomId: 'r1', customerName: 'An', customerPhone: '0900000001', date: '2099-01-01', time: '09:00', note: '', status: 'viewed', createdAt: '2098-12-01T00:00:00.000Z', source: 'website', careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: '' });
}

function testServerReservationTransaction() {
  const s = loadServer();
  addBaseServerData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  const first = s.handleCreateReservation({ reservation: {
    id: 'res1', depositEntryId: 'dep1', roomId: 'r1', sourceType: 'appointment', sourceId: 'a1',
    fromDate: '2099-01-01', untilDate: '2099-01-07', amount: 500000, paymentMethod: 'bank', paymentReference: 'GD001', note: ''
  } }, ctx);
  assert.equal(first.ok, true, 'tạo phiếu đầu tiên phải thành công');
  assert.equal(s.recordsNow('reservations').length, 1);
  assert.equal(s.recordsNow('depositLedger').filter(x => x.reservationId === 'res1' && x.type === 'collect').length, 1);
  assert.equal(s.recordsNow('rooms')[0].status, 'reserved');

  s.appendRecord('appointments', { id: 'a2', roomId: 'r1', customerName: 'Bình', customerPhone: '0900000002', date: '2099-01-02', time: '10:00', note: '', status: 'viewed', createdAt: '2098-12-02T00:00:00.000Z', source: 'website', careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: '' });
  const duplicate = s.handleCreateReservation({ reservation: {
    id: 'res2', depositEntryId: 'dep2', roomId: 'r1', sourceType: 'appointment', sourceId: 'a2',
    fromDate: '2099-02-01', untilDate: '2099-02-07', amount: 500000, paymentMethod: 'cash', note: ''
  } }, ctx);
  assert.equal(duplicate.ok, false, 'phiếu chưa xử lý phải khóa phòng kể cả khoảng ngày khác');
  assert.equal(s.recordsNow('reservations').length, 1);
  assert.equal(s.recordsNow('depositLedger').filter(x => x.id === 'dep2').length, 0);

  const cancelled = s.handleCancelReservation({ reservationId: 'res1', resolution: 'refund', status: 'cancelled', reason: 'Khách đổi ý' }, ctx);
  assert.equal(cancelled.ok, true);
  assert.equal(s.recordsNow('reservations')[0].status, 'cancelled');
  assert.equal(s.reservationBalanceServer('res1'), 0, 'hoàn tiền phải đưa số dư giữ chỗ về 0');
  assert.equal(s.recordsNow('rooms')[0].status, 'available');
}

function testOfflineDuplicateRollsBackDependents() {
  const s = loadServer();
  addBaseServerData(s);
  const ctx = { authenticated: true, role: 'owner', staffName: 'Chủ nhà', propertyIds: [] };
  assert.equal(s.handleCreateReservation({ reservation: {
    id: 'winner', depositEntryId: 'dep_winner', roomId: 'r1', sourceType: 'appointment', sourceId: 'a1',
    fromDate: '2099-01-01', untilDate: '2099-01-07', amount: 500000, paymentMethod: 'cash', note: ''
  } }, ctx).ok, true);
  s.appendRecord('appointments', { id: 'a2', roomId: 'r1', customerName: 'Bình', customerPhone: '0900000002', date: '2099-01-02', time: '10:00', note: '', status: 'viewed', createdAt: '2098-12-02T00:00:00.000Z', source: 'website', careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: '' });
  const before = s.recordsNow('appointments').find(x => x.id === 'a2');
  const appointmentChange = { ...before, status: 'reserved', reserveAmount: 600000, reserveUntil: '2099-01-09', careLog: [{ channel: 'reserve', note: 'offline' }], baseUpdatedAt: before.updatedAt };
  delete appointmentChange._row;
  const response = s.handleSync({ since: 0, changes: {
    appointments: [appointmentChange],
    reservations: [{ id: 'loser', roomId: 'r1', sourceType: 'appointment', sourceId: 'a2', appointmentId: 'a2', tenantId: '', customerName: 'Bình', customerPhone: '0900000002', fromDate: '2099-01-02', untilDate: '2099-01-09', amount: 600000, paymentMethod: 'cash', paymentReference: '', note: '', status: 'active', depositEntryId: 'dep_loser', leaseId: '', cancelledAt: '', cancelReason: '', createdBy: 'offline', createdAt: '2098-12-02T00:00:00.000Z', baseUpdatedAt: 0 }],
    depositLedger: [{ id: 'dep_loser', leaseId: '', reservationId: 'loser', roomId: 'r1', tenantId: '', appointmentId: 'a2', type: 'collect', amount: 600000, at: '2099-01-02', method: 'cash', reference: '', note: '', createdBy: 'offline', createdAt: '2098-12-02T00:00:00.000Z', baseUpdatedAt: 0 }]
  } }, 'admin', ctx);
  assert.equal(response.ok, true);
  assert(response.rejected.some(x => x.collection === 'reservations' && x.id === 'loser'), 'phiếu trùng phải bị từ chối');
  assert(response.rejected.some(x => x.collection === 'depositLedger' && x.id === 'dep_loser'), 'bút toán phụ thuộc phải bị từ chối');
  assert.equal(s.recordsNow('reservations').some(x => x.id === 'loser'), false);
  assert.equal(s.recordsNow('depositLedger').some(x => x.id === 'dep_loser'), false, 'không được để lại sổ cọc mồ côi');
  const after = s.recordsNow('appointments').find(x => x.id === 'a2');
  assert.equal(after.status, 'viewed', 'CRM phải được hoàn nguyên khi phiếu bị từ chối');
  assert.equal(after.reserveAmount, 0);
  assert.equal(s.recordsNow('rooms')[0].status, 'reserved', 'phiếu thắng vẫn tiếp tục khóa phòng');
}

function makeBrowserData() {
  return {
    properties: [], rooms: [{ id: 'r1', name: 'P101', status: 'available', updatedAt: 5 }], tenants: [], utilityReadings: [], invoices: [], appointments: [], reservations: [],
    leases: [], leaseOccupants: [], accounts: [], assets: [], handoverItems: [], serviceDefinitions: [], leaseServices: [], payments: [], depositLedger: [], reminders: [],
    maintenanceTickets: [], notifications: [], staffUsers: [], auditLog: [], settings: {}
  };
}

function loadClientSync(data) {
  const storage = new Map([['huy_rooms_conn', JSON.stringify({ apiUrl: '/api/sheets', token: 'owner-token', staff: { role: 'owner', name: 'Chủ nhà' } })]]);
  const window = { HUY_CONFIG: {}, addEventListener() {}, dispatchEvent() {} };
  const document = { hidden: false, addEventListener() {}, createElement: () => ({ remove() {} }), body: { appendChild() {} } };
  const context = {
    window, document, console, fetch: () => Promise.reject(new Error('không gọi mạng trong test')),
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    navigator: { userAgent: 'test' }, CustomEvent: function (name, opt) { this.type = name; this.detail = opt && opt.detail; },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8'), context, { filename: 'sync.js' });
  const api = { getData: () => data, saveLocal() {}, rerender() {}, toast() {} };
  window.Sync.attach(api);
  return window.Sync;
}

async function testClientAuthoritativeRecovery() {
  const data = makeBrowserData();
  const sync = loadClientSync(data);
  sync.snapshot();
  sync.state.since = 7;
  sync.applyActionResult({ serverTime: 50, changes: { rooms: [{ id: 'r1', name: 'P101', status: 'reserved', updatedAt: 50 }] } });
  assert.equal(sync.state.since, 7, 'action một phần không được nhảy cóc mốc since');
  assert.deepEqual(Object.keys(sync.computeChanges()), [], 'bản action authoritative không được bị đẩy lặp');

  data.reservations.push({ id: 'loser', roomId: 'r1', status: 'active', updatedAt: 51 });
  data.depositLedger.push({ id: 'dep_loser', reservationId: 'loser', type: 'collect', amount: 500000, updatedAt: 51 });
  sync.request = () => Promise.resolve({
    ok: true, serverTime: 60, changes: { rooms: [{ id: 'r1', name: 'P101', status: 'available', updatedAt: 60 }] },
    rejected: [
      { collection: 'reservations', id: 'loser', reason: 'trùng', serverRecord: { id: 'loser', deleted: true, updatedAt: 60 } },
      { collection: 'depositLedger', id: 'dep_loser', reason: 'phiếu bị từ chối', serverRecord: { id: 'dep_loser', deleted: true, updatedAt: 60 } }
    ]
  });
  await sync.cycle(true);
  assert.equal(data.reservations.length, 0, 'client phải xóa phiếu local bị từ chối');
  assert.equal(data.depositLedger.length, 0, 'client phải xóa ledger local bị từ chối');
  assert.equal(data.rooms[0].status, 'available');
  assert.equal(sync.state.since, 60);
}

module.exports = { loadServer, addBaseServerData, makeBrowserData, loadClientSync };

if (require.main === module) {
  (async () => {
    testServerReservationTransaction();
    testOfflineDuplicateRollsBackDependents();
    await testClientAuthoritativeRecovery();
    console.log('P0 regression tests: PASS');
  })().catch(err => { console.error(err); process.exitCode = 1; });
}
