const crypto = require('crypto');

const ALL_COLLECTIONS = [
  'properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments',
  'reservations', 'leases', 'leaseOccupants', 'accounts', 'assets', 'handoverItems',
  'serviceDefinitions', 'leaseServices', 'payments', 'depositLedger', 'reminders',
  'maintenanceTickets', 'notifications', 'staffUsers', 'settings'
];
const PUBLIC_COLLECTIONS = ['properties', 'rooms'];
const ROLE_WRITE = {
  owner: null,
  manager: null,
  accountant: ['invoices', 'payments', 'depositLedger', 'reminders', 'serviceDefinitions', 'leaseServices', 'notifications'],
  staff: ['appointments', 'maintenanceTickets', 'utilityReadings', 'notifications']
};
const MANAGER_BLOCK = new Set(['staffUsers']);
const PRIVATE_FIELDS = {
  tenants: ['pin', 'pinHash', 'pinHashV2', 'pinSalt', 'sessionSeed'],
  accounts: ['pin', 'pinHash', 'pinHashV2', 'pinSalt', 'sessionSeed'],
  staffUsers: ['passHash', 'passSalt', 'passHashV2']
};
const FINANCIAL = new Set(['invoices', 'payments', 'depositLedger', 'leases', 'utilityReadings']);
const LEDGERS = new Set(['payments', 'depositLedger']);
const AUDIT_FIELDS = {
  invoices: ['total', 'amountPaid', 'status', 'code', 'adjustAmount'],
  payments: ['amount', 'kind', 'reversedAt', 'reversalOf'],
  depositLedger: ['type', 'amount', 'leaseId', 'reservationId', 'roomId'],
  reservations: ['roomId', 'customerName', 'fromDate', 'untilDate', 'amount', 'status', 'leaseId'],
  leases: ['status', 'rentAmount', 'depositPaid', 'roomId', 'endDate'],
  rooms: ['status', 'price', 'deposit', 'archived'],
  tenants: ['name', 'phone', 'active', 'roomId'],
  utilityReadings: ['status', 'electricEnd', 'unlockNote'],
  serviceDefinitions: ['price', 'archived'],
  staffUsers: ['role', 'active', 'propertyIds'],
  settings: ['bankAccount', 'bankCode', 'defaultDueDay']
};

function env() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !secret) {
    const error = new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trên Vercel');
    error.code = 'setup';
    throw error;
  }
  return { url, secret, publishable };
}

async function http(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeout = new Error('Supabase phản hồi quá chậm');
      timeout.code = 'timeout';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(name, payload) {
  const cfg = env();
  const headers = {
    apikey: cfg.secret,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  // Legacy service_role là JWT và dùng được ở Authorization. Secret key mới
  // dạng sb_secret_* chỉ là API key, không giả làm Bearer JWT.
  if (!/^sb_secret_/i.test(cfg.secret)) headers.Authorization = `Bearer ${cfg.secret}`;
  const response = await http(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {})
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!response.ok) {
    const error = new Error((data && (data.message || data.hint)) || `Supabase RPC ${name} lỗi ${response.status}`);
    error.code = (data && data.code) || 'supabase';
    throw error;
  }
  return data;
}

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
function generatedId(prefix) { return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`; }
function safeId(value) { return /^[A-Za-z0-9._:-]{1,160}$/.test(String(value || '')); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function hashToken(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function hashPassword(password, salt) {
  const rounds = 210000;
  const s = salt || crypto.randomBytes(16).toString('hex');
  const digest = crypto.pbkdf2Sync(String(password || ''), s, rounds, 32, 'sha256').toString('hex');
  return `pbkdf2$${rounds}$${s}$${digest}`;
}
function verifyPassword(password, encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const rounds = Number(parts[1]);
  if (!Number.isInteger(rounds) || rounds < 100000 || rounds > 1000000) return false;
  const actual = crypto.pbkdf2Sync(String(password || ''), parts[2], rounds, 32, 'sha256').toString('hex');
  return safeEqual(actual, parts[3]);
}

function indexState(snapshot) {
  const data = snapshot && snapshot.data || {};
  const idx = {};
  ALL_COLLECTIONS.forEach((collection) => {
    idx[collection] = {};
    (data[collection] || []).forEach((record) => { if (record && record.id) idx[collection][record.id] = clone(record); });
  });
  return idx;
}

function stateToData(idx) {
  const out = {};
  ALL_COLLECTIONS.forEach((collection) => { out[collection] = Object.values(idx[collection] || {}).filter((x) => !x.deleted); });
  return out;
}

function stripMeta(record) {
  const out = clone(record || {});
  delete out.updatedAt; delete out.deleted; delete out.baseUpdatedAt;
  return out;
}
function stable(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  const out = {};
  Object.keys(value).sort().forEach((key) => { out[key] = stable(value[key]); });
  return out;
}
function sameContent(a, b) { return JSON.stringify(stable(stripMeta(a))) === JSON.stringify(stable(stripMeta(b))); }
function auditSnap(collection, record) {
  if (!record) return null;
  const out = {};
  (AUDIT_FIELDS[collection] || []).forEach((key) => { if (record[key] !== undefined) out[key] = clone(record[key]); });
  return out;
}

function canWrite(ctx, collection) {
  if (!ctx || !ctx.authenticated || collection === 'auditLog') return false;
  if (ctx.role === 'owner') return true;
  if (ctx.role === 'manager') return !MANAGER_BLOCK.has(collection);
  return (ROLE_WRITE[ctx.role] || []).includes(collection);
}

function propertyOf(collection, record, idx) {
  if (!record) return '';
  if (collection === 'properties') return record.id || '';
  if (record.propertyId) return record.propertyId;
  const roomId = record.roomId || '';
  if (roomId && idx.rooms[roomId]) return idx.rooms[roomId].propertyId || '';
  const leaseId = record.leaseId || '';
  if (leaseId && idx.leases[leaseId]) {
    const lease = idx.leases[leaseId];
    return lease.propertyId || (idx.rooms[lease.roomId] && idx.rooms[lease.roomId].propertyId) || '';
  }
  if (collection === 'payments' && record.invoiceId && idx.invoices[record.invoiceId]) return propertyOf('invoices', idx.invoices[record.invoiceId], idx);
  if (collection === 'reminders' && record.invoiceId && idx.invoices[record.invoiceId]) return propertyOf('invoices', idx.invoices[record.invoiceId], idx);
  if (record.tenantId && idx.tenants[record.tenantId]) return propertyOf('tenants', idx.tenants[record.tenantId], idx);
  if (collection === 'leaseOccupants' && record.leaseId && idx.leases[record.leaseId]) return propertyOf('leases', idx.leases[record.leaseId], idx);
  if (collection === 'accounts' && record.occupantId && idx.tenants[record.occupantId]) return propertyOf('tenants', idx.tenants[record.occupantId], idx);
  return '';
}

function inScope(ctx, propertyId) {
  if (!ctx || ctx.role === 'owner' || !ctx.propertyIds || !ctx.propertyIds.length || !propertyId) return true;
  return ctx.propertyIds.includes(propertyId);
}

function clientSafe(collection, record) {
  const out = clone(record);
  if (!out) return out;
  (PRIVATE_FIELDS[collection] || []).forEach((key) => { delete out[key]; });
  if (collection === 'tenants') out.hasPin = !!(record.pinHashV2 || record.pinHash || record.pin);
  if (collection === 'accounts') out.hasPin = !!(record.pinHashV2 || record.pinHash || record.pin);
  if (collection === 'staffUsers') out.hasPassword = !!(record.passHashV2 || record.passHash);
  return out;
}

function visibleCollections(ctx) {
  if (!ctx || !ctx.authenticated) return PUBLIC_COLLECTIONS.slice();
  if (ctx.role === 'accountant' || ctx.role === 'staff') return ALL_COLLECTIONS.filter((x) => x !== 'staffUsers');
  return ALL_COLLECTIONS.slice();
}

function sanitizeChanges(changes, ctx, snapshot) {
  const idx = indexState(snapshot);
  const accepted = {};
  const audit = [];
  const conflicts = [];
  const rejected = [];
  const scopeSkipped = [];
  const changedRoomIds = new Set();

  Object.keys(changes || {}).forEach((collection) => {
    const list = Array.isArray(changes[collection]) ? changes[collection] : [];
    if (!ALL_COLLECTIONS.includes(collection) || !list.length) return;
    if (list.length > 300) {
      rejected.push({ collection, id: '', reason: 'Tối đa 300 bản ghi cho một collection mỗi lượt' });
      return;
    }
    list.forEach((input) => {
      if (!input || !safeId(input.id)) {
        rejected.push({ collection, id: input && input.id || '', reason: 'Mã bản ghi không hợp lệ' });
        return;
      }
      const before = idx[collection][input.id] || null;
      const incoming = clone(input);
      delete incoming.baseUpdatedAt;
      // Giao diện không bao giờ nhận hash/PIN/mật khẩu. Khi cập nhật một hồ sơ,
      // giữ nguyên các trường server-only thay vì vô tình xóa chúng.
      delete incoming.hasPin; delete incoming.hasPassword;
      if (before) (PRIVATE_FIELDS[collection] || []).forEach((field) => {
        if (before[field] !== undefined) incoming[field] = before[field];
      });
      else if (collection === 'tenants' || collection === 'accounts') {
        const legacyPin = String(incoming.pin || '');
        (PRIVATE_FIELDS[collection] || []).forEach((field) => { delete incoming[field]; });
        if (/^\d{4,6}$/.test(legacyPin)) incoming.pinHashV2 = hashPassword(legacyPin);
      } else if (collection === 'staffUsers') {
        (PRIVATE_FIELDS.staffUsers || []).forEach((field) => { delete incoming[field]; });
      }
      const base = Number(input.baseUpdatedAt || 0);

      if (!canWrite(ctx, collection)) {
        rejected.push({ collection, id: input.id, reason: 'Vai trò hiện tại không có quyền sửa dữ liệu này', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } });
        return;
      }
      const propId = propertyOf(collection, incoming, idx) || propertyOf(collection, before, idx);
      if (!inScope(ctx, propId)) {
        scopeSkipped.push({ collection, id: input.id, reason: 'Dữ liệu ngoài phạm vi căn được giao', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } });
        return;
      }
      if (before && base === 0 && !sameContent(before, incoming)) {
        conflicts.push({ collection, id: input.id, reason: 'Mã bản ghi đã tồn tại trên máy chủ', serverRecord: clientSafe(collection, before) });
        return;
      }
      if (before && base > 0 && Number(before.updatedAt || 0) > base && !sameContent(before, incoming)) {
        conflicts.push({ collection, id: input.id, reason: 'Máy chủ có bản mới hơn', serverRecord: clientSafe(collection, before) });
        return;
      }
      if (before && LEDGERS.has(collection) && !sameContent(before, incoming)) {
        let reversalMark = false;
        if (collection === 'payments' && !before.reversedAt && incoming.reversedAt && before.kind === incoming.kind && Number(before.amount) === Number(incoming.amount)) {
          const a = stripMeta(before), b = stripMeta(incoming);
          delete a.reversedAt; delete a.reversalReason; delete b.reversedAt; delete b.reversalReason;
          reversalMark = JSON.stringify(stable(a)) === JSON.stringify(stable(b));
        }
        if (!reversalMark) {
          rejected.push({ collection, id: input.id, reason: 'Sổ tài chính bất biến: hãy tạo giao dịch đảo mới', serverRecord: clientSafe(collection, before) });
          return;
        }
      }

      if (collection === 'payments' && !before && !incoming.deleted) {
        const amount = Number(incoming.amount || 0);
        if (incoming.kind === 'payment' && (!(amount > 0) || amount > 500000000)) {
          rejected.push({ collection, id: input.id, reason: 'Số tiền thanh toán không hợp lệ', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        if (incoming.kind === 'reversal') {
          const original = idx.payments[incoming.reversalOf];
          if (!(amount < 0) || !original || original.kind !== 'payment' || Number(original.amount || 0) !== Math.abs(amount)) {
            rejected.push({ collection, id: input.id, reason: 'Giao dịch đảo phải âm, đúng số tiền và trỏ tới giao dịch thu gốc', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
          }
        }
        if (!['payment', 'reversal'].includes(incoming.kind)) {
          rejected.push({ collection, id: input.id, reason: 'Loại giao dịch thanh toán không hợp lệ', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
      }
      if (collection === 'depositLedger' && !before && !incoming.deleted) {
        if (!(Number(incoming.amount || 0) > 0) || !['collect', 'refund', 'deduct'].includes(incoming.type)) {
          rejected.push({ collection, id: input.id, reason: 'Bút toán cọc phải có loại hợp lệ và số tiền > 0', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        if (incoming.reservationId) {
          const linked = idx.reservations[incoming.reservationId] || ((changes.reservations || []).find((x) => x.id === incoming.reservationId && !x.deleted));
          if (!linked || (incoming.type === 'collect' && (linked.depositEntryId !== incoming.id || Number(linked.amount || 0) !== Number(incoming.amount || 0)))) {
            rejected.push({ collection, id: input.id, reason: 'Bút toán giữ chỗ không khớp phiếu giữ chỗ', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
          }
        }
      }

      if (collection === 'invoices') {
        if (incoming.deleted && before && (Number(before.amountPaid || 0) > 0 || before.status === 'paid')) {
          rejected.push({ collection, id: input.id, reason: 'Hóa đơn đã có tiền thu không được xóa', serverRecord: clientSafe(collection, before) }); return;
        }
        if (!before && !incoming.deleted) {
          if (!idx.rooms[incoming.roomId] || !idx.tenants[incoming.tenantId]) {
            rejected.push({ collection, id: input.id, reason: 'Phòng hoặc người thuê của hóa đơn không tồn tại', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
          }
          const duplicate = Object.values(idx.invoices).find((x) => !x.deleted && x.id !== incoming.id && x.roomId === incoming.roomId && x.month === incoming.month && x.leaseId === incoming.leaseId);
          if (duplicate) { rejected.push({ collection, id: input.id, reason: 'Đã có hóa đơn tháng này cho phòng/hợp đồng', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return; }
        }
      }

      if (collection === 'utilityReadings' && !incoming.deleted) {
        if (before && before.status === 'final' && !sameContent(before, incoming)) {
          rejected.push({ collection, id: input.id, reason: 'Kỳ đã chốt; hãy mở khóa kèm lý do trước khi sửa', serverRecord: clientSafe(collection, before) }); return;
        }
        if (Number(incoming.electricEnd || 0) < Number(incoming.electricStart || 0) || (incoming.waterMode === 'meter' && Number(incoming.waterEnd || 0) < Number(incoming.waterStart || 0))) {
          rejected.push({ collection, id: input.id, reason: 'Chỉ số cuối kỳ không được nhỏ hơn đầu kỳ', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        const duplicate = Object.values(idx.utilityReadings).find((x) => !x.deleted && x.id !== incoming.id && x.roomId === incoming.roomId && x.month === incoming.month);
        if (duplicate) {
          rejected.push({ collection, id: input.id, reason: 'Phòng đã có chỉ số điện nước trong tháng này', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } });
          return;
        }
      }
      if (collection === 'tenants' && before && before.active && incoming.active === false) {
        const activePrimary = Object.values(idx.leases).some((l) => !l.deleted && l.primaryTenantId === input.id && ['active', 'ending'].includes(l.status));
        if (activePrimary) {
          rejected.push({ collection, id: input.id, reason: 'Không thể ngừng người thuê chính khi hợp đồng còn hiệu lực', serverRecord: clientSafe(collection, before) });
          return;
        }
      }
      if (collection === 'leaseOccupants' && before && (incoming.deleted || incoming.leftAt)) {
        const lease = idx.leases[before.leaseId];
        if (lease && ['draft', 'active', 'ending'].includes(lease.status) && (before.role === 'primary' || lease.primaryTenantId === before.occupantId)) {
          rejected.push({ collection, id: input.id, reason: 'Không thể cho người đại diện rời hợp đồng đang mở qua đồng bộ rời rạc', serverRecord: clientSafe(collection, before) }); return;
        }
      }
      if (collection === 'leases' && incoming.deleted && before && ['active', 'ending'].includes(before.status)) {
        rejected.push({ collection, id: input.id, reason: 'Hợp đồng hiệu lực không được xóa; hãy dùng Trả phòng/Thanh lý', serverRecord: clientSafe(collection, before) }); return;
      }
      if (collection === 'leases' && !incoming.deleted) {
        const room = idx.rooms[incoming.roomId];
        const tenantExists = !!idx.tenants[incoming.primaryTenantId] || (changes.tenants || []).some((x) => x.id === incoming.primaryTenantId && !x.deleted);
        if (!room || room.archived || room.status === 'maintenance' || !tenantExists) {
          rejected.push({ collection, id: input.id, reason: 'Phòng hoặc người đại diện của hợp đồng không hợp lệ', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        if (Number(incoming.rentAmount || 0) < 0 || Number(incoming.depositRequired || 0) < 0 || Number(incoming.depositPaid || 0) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(incoming.startDate || '')) || (incoming.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(String(incoming.endDate)) || incoming.endDate < incoming.startDate))) {
          rejected.push({ collection, id: input.id, reason: 'Giá/cọc hoặc thời hạn hợp đồng không hợp lệ', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        if (!before && incoming.status !== 'draft') {
          rejected.push({ collection, id: input.id, reason: 'Hợp đồng mới phải bắt đầu ở trạng thái nháp', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        if (before && before.roomId !== incoming.roomId && ['active', 'ending'].includes(before.status)) {
          rejected.push({ collection, id: input.id, reason: 'Chuyển phòng phải dùng nghiệp vụ Chuyển phòng', serverRecord: clientSafe(collection, before) }); return;
        }
        if (before && before.status !== incoming.status && ['active', 'ended', 'cancelled'].includes(incoming.status)) {
          rejected.push({ collection, id: input.id, reason: 'Đổi trạng thái hợp đồng phải dùng action nguyên tử', serverRecord: clientSafe(collection, before) }); return;
        }
        const duplicate = Object.values(idx.leases).find((x) => !x.deleted && x.id !== incoming.id && x.roomId === incoming.roomId && ['draft', 'active', 'ending'].includes(x.status));
        if (duplicate && ['draft', 'active', 'ending'].includes(incoming.status)) {
          rejected.push({ collection, id: input.id, reason: 'Phòng đã có hợp đồng đang mở khác', serverRecord: before ? clientSafe(collection, before) : { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
        const activeHold = Object.values(idx.reservations).find((x) => !x.deleted && x.roomId === incoming.roomId && x.status === 'active' && x.leaseId !== incoming.id);
        if (!before && incoming.status === 'draft' && activeHold) {
          rejected.push({ collection, id: input.id, reason: 'Phòng còn phiếu giữ chỗ chưa chuyển thành hợp đồng', serverRecord: { id: input.id, deleted: true, updatedAt: snapshot.revision } }); return;
        }
      }
      if (collection === 'rooms' && (incoming.deleted || incoming.archived)) {
        const busy = Object.values(idx.leases).some((l) => !l.deleted && l.roomId === input.id && ['draft', 'active', 'ending'].includes(l.status))
          || Object.values(idx.reservations).some((r) => !r.deleted && r.roomId === input.id && r.status === 'active')
          || Object.values(idx.tenants).some((t) => !t.deleted && t.roomId === input.id && t.active);
        if (busy) {
          rejected.push({ collection, id: input.id, reason: 'Phòng còn hợp đồng, giữ chỗ hoặc người ở; chưa thể lưu trữ/xóa', serverRecord: before ? clientSafe(collection, before) : null });
          return;
        }
      }
      if (collection === 'properties' && (incoming.deleted || incoming.archived)) {
        const blocked = Object.values(idx.rooms).some((room) => !room.deleted && room.propertyId === input.id && (
          Object.values(idx.leases).some((l) => !l.deleted && l.roomId === room.id && ['draft', 'active', 'ending'].includes(l.status))
          || Object.values(idx.reservations).some((r) => !r.deleted && r.roomId === room.id && r.status === 'active')
          || Object.values(idx.tenants).some((t) => !t.deleted && t.roomId === room.id && t.active)
        ));
        if (blocked) {
          rejected.push({ collection, id: input.id, reason: 'Căn còn phòng có hợp đồng, giữ chỗ hoặc người ở', serverRecord: before ? clientSafe(collection, before) : null });
          return;
        }
      }

      idx[collection][input.id] = incoming;
      if (!accepted[collection]) accepted[collection] = [];
      accepted[collection].push(incoming);
      if (incoming.roomId) changedRoomIds.add(incoming.roomId);
      if (collection === 'rooms') changedRoomIds.add(incoming.id);
      if (collection === 'leases' && before && before.roomId) changedRoomIds.add(before.roomId);
      audit.push({
        action: incoming.deleted ? 'delete' : before ? 'update' : 'create',
        collection,
        recordId: incoming.id,
        before: auditSnap(collection, before),
        after: incoming.deleted ? null : auditSnap(collection, incoming)
      });
    });
  });

  reconcileRooms(idx, accepted, audit, changedRoomIds);
  return { accepted, audit, conflicts, rejected, scopeSkipped, idx };
}

function depositHeldForLease(idx, leaseId) {
  const linkedReservations = new Set(Object.values(idx.reservations).filter((x) => !x.deleted && x.leaseId === leaseId).map((x) => x.id));
  return Object.values(idx.depositLedger).filter((x) => !x.deleted && (x.leaseId === leaseId || (x.reservationId && linkedReservations.has(x.reservationId))))
    .reduce((sum, x) => sum + (x.type === 'collect' ? 1 : -1) * Number(x.amount || 0), 0);
}

function reconcileRooms(idx, accepted, audit, roomIds) {
  const ids = roomIds && roomIds.size ? Array.from(roomIds) : Object.keys(idx.rooms);
  ids.forEach((roomId) => {
    const room = idx.rooms[roomId];
    if (!room || room.deleted) return;
    const occupied = Object.values(idx.leases).some((l) => !l.deleted && l.roomId === roomId && ['active', 'ending'].includes(l.status))
      || Object.values(idx.tenants).some((t) => !t.deleted && t.roomId === roomId && t.active);
    const reserved = Object.values(idx.reservations).some((r) => !r.deleted && r.roomId === roomId && r.status === 'active')
      || Object.values(idx.leases).some((l) => !l.deleted && l.roomId === roomId && l.status === 'draft' && depositHeldForLease(idx, l.id) > 0);
    const target = occupied ? 'occupied' : reserved ? 'reserved' : room.status === 'maintenance' ? 'maintenance' : 'available';
    if (room.status === target) return;
    const before = clone(room);
    room.status = target;
    const list = accepted.rooms || (accepted.rooms = []);
    const pos = list.findIndex((x) => x.id === roomId);
    if (pos >= 0) list[pos] = clone(room); else list.push(clone(room));
    audit.push({ action: 'reconcile', collection: 'rooms', recordId: roomId, before: auditSnap('rooms', before), after: auditSnap('rooms', room), note: 'Suy ra trạng thái từ hợp đồng/giữ chỗ/người ở' });
  });
}

async function snapshot() { return rpc('huy_snapshot', {}); }
async function pull(since, collections) { return rpc('huy_pull', { p_since: Number(since || 0), p_collections: collections }); }
async function commit(expectedRevision, changes, actor, audit) {
  return rpc('huy_commit_batch', {
    p_expected_revision: Number(expectedRevision || 0),
    p_changes: changes || {},
    p_actor: actor || {},
    p_audit: audit || []
  });
}
async function auditPull(since) { return rpc('huy_audit_pull', { p_since: Number(since || 0) }); }
async function authRead() { return rpc('huy_auth_read', {}); }
async function authCas(version, data) { return rpc('huy_auth_cas', { p_expected_version: Number(version || 0), p_data: data || {} }); }

async function updateAuth(mutator) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = await authRead();
    const data = clone(state.data || {});
    const result = await mutator(data);
    const saved = await authCas(state.version, data);
    if (saved && saved.ok) return result;
  }
  const error = new Error('Phiên xác thực vừa thay đổi ở thiết bị khác, vui lòng thử lại');
  error.code = 'conflict';
  throw error;
}

async function authContext(req) {
  const key = String(req.key || '');
  if (key && process.env.HUY_WRITE_KEY && safeEqual(key, process.env.HUY_WRITE_KEY)) {
    return { authenticated: true, role: 'owner', staffId: '', staffName: 'Chủ nhà', propertyIds: [], tokenType: 'writeKey' };
  }
  if (!req.token) return { authenticated: false, role: 'guest', propertyIds: [] };
  const state = await authRead();
  const sessions = state.data && state.data.sessions || {};
  const session = sessions[hashToken(req.token)];
  if (!session || Number(session.exp || 0) <= Date.now()) return { authenticated: false, role: 'guest', propertyIds: [], expired: !!session };
  if (session.staffId) {
    const snap = await snapshot();
    const current = (snap.data.staffUsers || []).find((item) => !item.deleted && item.active && item.id === session.staffId);
    if (!current) return { authenticated: false, role: 'guest', propertyIds: [], expired: true };
    session.role = ['owner', 'manager', 'accountant', 'staff'].includes(current.role) ? current.role : 'staff';
    session.staffName = current.name || current.username || session.staffName;
    session.propertyIds = Array.isArray(current.propertyIds) ? current.propertyIds : [];
  }
  return {
    authenticated: true,
    role: ['owner', 'manager', 'accountant', 'staff'].includes(session.role) ? session.role : 'staff',
    staffId: session.staffId || '',
    staffName: session.staffName || 'Chủ nhà',
    propertyIds: Array.isArray(session.propertyIds) ? session.propertyIds : [],
    tokenType: session.staffId ? 'staff' : 'owner',
    tokenHash: hashToken(req.token)
  };
}

function actorOf(ctx) { return { id: ctx.staffId || '', name: ctx.staffName || 'Chủ nhà', role: ctx.role || 'owner' }; }

async function issueSession(staff, deviceName) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await updateAuth((auth) => {
    auth.sessions = auth.sessions || {};
    const now = Date.now();
    Object.keys(auth.sessions).forEach((key) => { if (Number(auth.sessions[key].exp || 0) <= now) delete auth.sessions[key]; });
    auth.sessions[tokenHash] = {
      exp: now + 60 * 86400000,
      created: now,
      deviceName: String(deviceName || '').slice(0, 80),
      role: staff.role,
      staffId: staff.id || '',
      staffName: staff.name || 'Chủ nhà',
      propertyIds: Array.isArray(staff.propertyIds) ? staff.propertyIds : []
    };
  });
  return token;
}

async function publicSnapshot(since) {
  const delta = await pull(since, ['properties', 'rooms', 'leases']);
  if (Number(since || 0) > 0 && !Object.keys(delta.changes || {}).length) {
    return { ok: true, role: 'guest', serverTime: delta.serverTime, changes: {} };
  }
  const snap = await snapshot();
  const idx = indexState(snap);
  const todayText = today();
  const soon = {};
  Object.values(idx.leases).forEach((lease) => {
    if (!['active', 'ending'].includes(lease.status) || !/^\d{4}-\d{2}-\d{2}$/.test(String(lease.endDate || ''))) return;
    const days = Math.ceil((new Date(`${lease.endDate}T00:00:00+07:00`) - new Date(`${todayText}T00:00:00+07:00`)) / 86400000);
    if (days < 0 || days > 45) return;
    if (!soon[lease.roomId] || lease.endDate < soon[lease.roomId]) soon[lease.roomId] = lease.endDate;
  });
  const properties = Object.values(idx.properties).filter((x) => !x.deleted).map((x) => clientSafe('properties', x));
  const rooms = Object.values(idx.rooms).filter((x) => !x.deleted).map((room) => {
    const clean = clientSafe('rooms', room); clean.note = '';
    if (clean.status === 'occupied' && !clean.availableFrom && soon[clean.id]) clean.availableFrom = soon[clean.id];
    return clean;
  });
  return { ok: true, role: 'guest', serverTime: snap.revision, changes: { properties, rooms } };
}

async function adminPull(ctx, since) {
  const collections = visibleCollections(ctx);
  const out = await pull(since, collections);
  let idx = null;
  if (ctx.role !== 'owner' && ctx.propertyIds && ctx.propertyIds.length) idx = indexState(await snapshot());
  Object.keys(out.changes || {}).forEach((collection) => {
    out.changes[collection] = (out.changes[collection] || [])
      .filter((record) => !idx || record.deleted || inScope(ctx, propertyOf(collection, record, idx)))
      .map((record) => clientSafe(collection, record));
    if (!out.changes[collection].length) delete out.changes[collection];
  });
  if (collections.includes('settings') && out.changes.settings) {
    out.changes.settings = out.changes.settings.map((x) => clientSafe('settings', x));
  }
  if (ctx.role === 'owner' || ctx.role === 'manager') {
    const audit = await auditPull(since);
    if (audit && audit.length) out.changes.auditLog = audit;
  }
  return Object.assign({ ok: true, role: 'admin' }, out);
}

async function syncRequest(req, ctx) {
  if (!ctx.authenticated) return publicSnapshot(req.since);
  const changes = req.changes && typeof req.changes === 'object' ? req.changes : {};
  if (!Object.keys(changes).some((key) => Array.isArray(changes[key]) && changes[key].length)) return adminPull(ctx, req.since);

  let result;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const snap = await snapshot();
    result = sanitizeChanges(changes, ctx, snap);
    if (!Object.keys(result.accepted).length) break;
    const saved = await commit(snap.revision, result.accepted, actorOf(ctx), result.audit);
    if (saved.ok) {
      const staffIds = new Set((result.accepted.staffUsers || []).map((x) => x.id));
      const inactiveTenantIds = new Set((result.accepted.tenants || []).filter((x) => x.active === false || x.deleted).map((x) => x.id));
      if (staffIds.size || inactiveTenantIds.size) {
        await updateAuth((auth) => {
          auth.sessions = auth.sessions || {};
          Object.keys(auth.sessions).forEach((key) => { if (staffIds.has(auth.sessions[key].staffId)) delete auth.sessions[key]; });
          auth.residentSessions = auth.residentSessions || {};
          Object.keys(auth.residentSessions).forEach((key) => { if (inactiveTenantIds.has(auth.residentSessions[key].tenantId)) delete auth.residentSessions[key]; });
        }).catch(() => {});
      }
      break;
    }
    if (saved.code !== 'stale_global') throw Object.assign(new Error('Không thể lưu thay đổi lên Supabase'), { code: saved.code || 'sync' });
    if (attempt === 3) throw Object.assign(new Error('Dữ liệu đang được cập nhật liên tục; vui lòng thử lại'), { code: 'conflict' });
  }
  const pulled = await adminPull(ctx, req.since);
  pulled.conflicts = result.conflicts;
  pulled.rejected = result.rejected;
  pulled.scopeSkipped = result.scopeSkipped;
  pulled.skippedWrite = [];
  return pulled;
}

async function uploadObject(bucket, path, buffer, mime) {
  const cfg = env();
  const headers = { apikey: cfg.secret, 'Content-Type': mime, 'x-upsert': 'false' };
  if (!/^sb_secret_/i.test(cfg.secret)) headers.Authorization = `Bearer ${cfg.secret}`;
  const response = await http(`${cfg.url}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers,
    body: buffer
  }, 20000);
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error(`Không tải được tệp lên Supabase Storage: ${text.slice(0, 180)}`), { code: 'upload' });
  return path;
}

async function downloadObject(bucket, path) {
  const cfg = env();
  const headers = { apikey: cfg.secret };
  if (!/^sb_secret_/i.test(cfg.secret)) headers.Authorization = `Bearer ${cfg.secret}`;
  const response = await http(`${cfg.url}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers
  }, 20000);
  if (!response.ok) throw Object.assign(new Error('Không đọc được tệp riêng tư'), { code: 'file' });
  return { buffer: Buffer.from(await response.arrayBuffer()), mime: response.headers.get('content-type') || 'application/octet-stream' };
}

async function deleteObject(bucket, path) {
  const cfg = env();
  const headers = { apikey: cfg.secret };
  if (!/^sb_secret_/i.test(cfg.secret)) headers.Authorization = `Bearer ${cfg.secret}`;
  const response = await http(`${cfg.url}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE', headers
  });
  if (!response.ok && response.status !== 404) throw Object.assign(new Error('Không xóa được tệp'), { code: 'file' });
}

module.exports = {
  ALL_COLLECTIONS, PUBLIC_COLLECTIONS, FINANCIAL,
  env, rpc, clone, nowIso, today, generatedId, safeId, safeEqual,
  hashPassword, verifyPassword, hashToken,
  indexState, stateToData, sameContent, auditSnap, canWrite, propertyOf, inScope, clientSafe,
  visibleCollections, sanitizeChanges, reconcileRooms, depositHeldForLease,
  snapshot, pull, commit, auditPull, authRead, authCas, updateAuth, authContext, actorOf,
  issueSession, publicSnapshot, adminPull, syncRequest,
  uploadObject, downloadObject, deleteObject
};
