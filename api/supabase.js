const crypto = require('crypto');
const core = require('./_supabase-core');

function ok(res, data, status) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status || 200).json(Object.assign({ ok: true }, data || {}));
}
function fail(res, error, status) {
  res.setHeader('Cache-Control', 'no-store');
  const message = error && error.message || String(error || 'Có lỗi xảy ra');
  return res.status(status || 200).json({ ok: false, code: error && error.code || 'error', error: message });
}
async function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);
  const raw = await new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
      if (text.length > 12 * 1024 * 1024) reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn'), { code: 'size' }));
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });
  return raw.trim() ? JSON.parse(raw) : {};
}
function requireAdmin(ctx, roles) {
  if (!ctx || !ctx.authenticated) throw Object.assign(new Error('Phiên quản lý đã hết hạn'), { code: 'auth' });
  if (roles && !roles.includes(ctx.role)) throw Object.assign(new Error('Bạn không có quyền thực hiện thao tác này'), { code: 'forbidden' });
}
function normalizePhone(value) { return String(value || '').replace(/\D/g, ''); }
function dateOk(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function activeReservation(record) { return !!record && !record.deleted && record.status === 'active'; }
function liveLease(record) { return !!record && !record.deleted && ['active', 'ending'].includes(record.status); }

async function login(req) {
  const password = String(req.password || '');
  const username = String(req.user || '').trim().toLowerCase();
  const authState = await core.authRead();
  const auth = core.clone(authState.data || {});
  const rate = auth.loginRate || { failures: 0, windowStart: 0, lockUntil: 0 };
  const now = Date.now();
  if (Number(rate.lockUntil || 0) > now) throw Object.assign(new Error('Nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.'), { code: 'rate' });
  if (now - Number(rate.windowStart || 0) > 600000) Object.assign(rate, { failures: 0, windowStart: now, lockUntil: 0 });

  let staff;
  if (username) {
    const snap = await core.snapshot();
    const user = (snap.data.staffUsers || []).find((item) => !item.deleted && item.active && String(item.username || '').toLowerCase() === username);
    if (user && user.passHashV2 && core.verifyPassword(password, user.passHashV2)) {
      staff = { id: user.id, name: user.name || user.username, role: ['owner', 'manager', 'accountant', 'staff'].includes(user.role) ? user.role : 'staff', propertyIds: Array.isArray(user.propertyIds) ? user.propertyIds : [] };
    }
  } else {
    if (!auth.adminHash) {
      const initial = String(process.env.HUY_ADMIN_PASSWORD || '');
      if (initial.length < 10) throw Object.assign(new Error('Chưa khởi tạo mật khẩu chủ nhà. Đặt HUY_ADMIN_PASSWORD tối thiểu 10 ký tự trên Vercel rồi đăng nhập lại.'), { code: 'setup' });
      auth.adminHash = core.hashPassword(initial);
    }
    if (core.verifyPassword(password, auth.adminHash) || (process.env.HUY_WRITE_KEY && core.safeEqual(password, process.env.HUY_WRITE_KEY))) {
      staff = { id: '', name: 'Chủ nhà', role: 'owner', propertyIds: [] };
    }
  }

  if (!staff) {
    rate.failures = Number(rate.failures || 0) + 1;
    rate.windowStart = rate.windowStart || now;
    if (rate.failures >= 8) rate.lockUntil = now + 600000;
    auth.loginRate = rate;
    await core.authCas(authState.version, auth);
    throw Object.assign(new Error(username ? 'Tài khoản hoặc mật khẩu chưa đúng' : 'Mật khẩu quản lý chưa đúng'), { code: 'auth' });
  }

  auth.loginRate = { failures: 0, windowStart: now, lockUntil: 0 };
  const reset = await core.authCas(authState.version, auth);
  if (!reset.ok) return login(req);
  const token = await core.issueSession(staff, req.deviceName);
  return { token, role: 'admin', staff, mustChangePassword: false };
}

async function logout(req, ctx, all) {
  requireAdmin(ctx);
  await core.updateAuth((auth) => {
    auth.sessions = auth.sessions || {};
    if (all) auth.sessions = {};
    else delete auth.sessions[ctx.tokenHash];
  });
  return {};
}

async function sessions(ctx) {
  requireAdmin(ctx);
  const state = await core.authRead();
  const now = Date.now();
  const list = Object.entries(state.data && state.data.sessions || {}).filter(([, item]) => Number(item.exp || 0) > now).map(([key, item]) => ({
    current: key === ctx.tokenHash,
    deviceName: item.deviceName || 'Không tên',
    created: item.created,
    exp: item.exp,
    staffName: item.staffName || 'Chủ nhà'
  }));
  return { sessions: list };
}

async function setPassword(req, ctx) {
  requireAdmin(ctx, ['owner']);
  const value = String(req.newPassword || '').trim();
  if (value.length < 10) throw Object.assign(new Error('Mật khẩu cần ít nhất 10 ký tự'), { code: 'validation' });
  const token = crypto.randomBytes(32).toString('hex');
  await core.updateAuth((auth) => {
    auth.adminHash = core.hashPassword(value);
    auth.sessions = {};
    auth.sessions[core.hashToken(token)] = {
      exp: Date.now() + 60 * 86400000,
      created: Date.now(), deviceName: String(req.deviceName || '').slice(0, 80),
      role: 'owner', staffId: '', staffName: 'Chủ nhà', propertyIds: []
    };
  });
  return { token };
}

async function mutate(ctx, mutator) {
  requireAdmin(ctx);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const snap = await core.snapshot();
    const idx = core.indexState(snap);
    const draft = await mutator(idx, snap);
    const changes = draft.changes || {};
    const audit = draft.audit || [];
    const roomIds = new Set(draft.roomIds || []);
    Object.keys(changes).forEach((collection) => (changes[collection] || []).forEach((record) => {
      if (record.roomId) roomIds.add(record.roomId);
      if (collection === 'rooms') roomIds.add(record.id);
      idx[collection][record.id] = core.clone(record);
    }));
    core.reconcileRooms(idx, changes, audit, roomIds);
    const saved = await core.commit(snap.revision, changes, core.actorOf(ctx), audit);
    if (saved.ok) {
      const staffIds = new Set((changes.staffUsers || []).map((item) => item.id));
      const inactiveTenantIds = new Set((changes.tenants || []).filter((item) => item.active === false || item.deleted).map((item) => item.id));
      if (staffIds.size || inactiveTenantIds.size) {
        await core.updateAuth((auth) => {
          auth.sessions = auth.sessions || {};
          Object.keys(auth.sessions).forEach((key) => { if (staffIds.has(auth.sessions[key].staffId)) delete auth.sessions[key]; });
          auth.residentSessions = auth.residentSessions || {};
          Object.keys(auth.residentSessions).forEach((key) => { if (inactiveTenantIds.has(auth.residentSessions[key].tenantId)) delete auth.residentSessions[key]; });
        }).catch(() => {});
      }
      const pulled = await core.pull(snap.revision, Object.keys(changes));
      Object.keys(pulled.changes || {}).forEach((collection) => {
        pulled.changes[collection] = pulled.changes[collection].map((record) => core.clientSafe(collection, record));
      });
      return Object.assign({ serverTime: saved.serverTime, changes: pulled.changes || {} }, draft.result || {});
    }
    if (saved.code !== 'stale_global' || attempt === 3) throw Object.assign(new Error('Dữ liệu vừa đổi trên thiết bị khác; vui lòng thử lại'), { code: 'conflict' });
  }
}

function addChange(changes, collection, record) {
  const list = changes[collection] || (changes[collection] = []);
  const pos = list.findIndex((item) => item.id === record.id);
  if (pos >= 0) list[pos] = core.clone(record); else list.push(core.clone(record));
}
function auditChange(audit, action, collection, recordId, before, after, note) {
  audit.push({ action, collection, recordId, before: core.auditSnap(collection, before), after: core.auditSnap(collection, after), note: note || '' });
}
function reservationHeld(idx, reservationId) {
  return Object.values(idx.depositLedger).filter((entry) => !entry.deleted && entry.reservationId === reservationId)
    .reduce((sum, entry) => sum + (entry.type === 'collect' ? 1 : -1) * Number(entry.amount || 0), 0);
}

async function createReservation(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  const input = req.reservation || {};
  return mutate(ctx, (idx) => {
    const id = String(input.id || '');
    const depositId = String(input.depositEntryId || '');
    if (!core.safeId(id) || !core.safeId(depositId)) throw Object.assign(new Error('Mã phiếu giữ chỗ không hợp lệ'), { code: 'validation' });
    if (idx.reservations[id] || idx.depositLedger[depositId]) throw Object.assign(new Error('Phiếu hoặc bút toán giữ chỗ đã tồn tại'), { code: 'conflict' });
    const room = idx.rooms[input.roomId];
    if (!room || room.deleted || room.archived) throw Object.assign(new Error('Phòng không tồn tại hoặc đã lưu trữ'), { code: 'validation' });
    if (!core.inScope(ctx, room.propertyId || '')) throw Object.assign(new Error('Phòng ngoài phạm vi căn được giao'), { code: 'forbidden' });
    if (room.status === 'maintenance' || Object.values(idx.leases).some((lease) => lease.roomId === room.id && liveLease(lease))) throw Object.assign(new Error('Phòng đang bảo trì hoặc có người thuê'), { code: 'validation' });
    if (Object.values(idx.reservations).some((reservation) => reservation.roomId === room.id && activeReservation(reservation))) throw Object.assign(new Error('Phòng còn phiếu giữ chỗ chưa xử lý'), { code: 'conflict' });
    const sourceType = String(input.sourceType || '');
    const sourceId = String(input.sourceId || '');
    if (!['appointment', 'tenant'].includes(sourceType) || !core.safeId(sourceId)) throw Object.assign(new Error('Nguồn khách giữ chỗ không hợp lệ'), { code: 'validation' });
    const source = sourceType === 'appointment' ? idx.appointments[sourceId] : idx.tenants[sourceId];
    if (!source) throw Object.assign(new Error('Không tìm thấy hồ sơ khách'), { code: 'validation' });
    if (Object.values(idx.reservations).some((reservation) => reservation.sourceType === sourceType && reservation.sourceId === sourceId && activeReservation(reservation))) throw Object.assign(new Error('Khách này còn một phiếu giữ chỗ chưa xử lý'), { code: 'conflict' });
    const fromDate = String(input.fromDate || '');
    const untilDate = String(input.untilDate || '');
    const amount = Number(input.amount || 0);
    if (!dateOk(fromDate) || !dateOk(untilDate) || untilDate < fromDate) throw Object.assign(new Error('Khoảng ngày giữ chỗ không hợp lệ'), { code: 'validation' });
    if (!(amount > 0) || amount > 500000000) throw Object.assign(new Error('Tiền giữ chỗ không hợp lệ'), { code: 'validation' });
    const method = String(input.paymentMethod || 'cash');
    if (!['cash', 'bank', 'momo', 'other'].includes(method)) throw Object.assign(new Error('Phương thức thanh toán không hợp lệ'), { code: 'validation' });
    const createdAt = core.nowIso();
    const actor = ctx.staffName || 'Chủ nhà';
    const reservation = {
      id, roomId: room.id, sourceType, sourceId,
      appointmentId: sourceType === 'appointment' ? sourceId : '', tenantId: sourceType === 'tenant' ? sourceId : '',
      customerName: source.customerName || source.name || '', customerPhone: source.customerPhone || source.phone || '',
      fromDate, untilDate, amount, paymentMethod: method,
      paymentReference: String(input.paymentReference || '').slice(0, 80), note: String(input.note || '').slice(0, 500),
      status: 'active', depositEntryId: depositId, leaseId: '', cancelledAt: '', cancelReason: '', createdBy: actor, createdAt
    };
    const deposit = {
      id: depositId, leaseId: '', type: 'collect', amount, at: core.today(), method,
      note: `Thu tiền giữ chỗ${reservation.note ? ` — ${reservation.note}` : ''}`,
      createdBy: actor, createdAt, reservationId: id, roomId: room.id,
      tenantId: reservation.tenantId, appointmentId: reservation.appointmentId, reference: reservation.paymentReference
    };
    const changes = { reservations: [reservation], depositLedger: [deposit] };
    const audit = [];
    auditChange(audit, 'create', 'reservations', id, null, reservation);
    auditChange(audit, 'create', 'depositLedger', depositId, null, deposit);
    if (sourceType === 'appointment') {
      const appointment = core.clone(source);
      appointment.status = 'reserved'; appointment.reserveAmount = amount; appointment.reserveUntil = untilDate;
      appointment.careLog = Array.isArray(appointment.careLog) ? appointment.careLog : [];
      appointment.careLog.push({ at: createdAt, by: actor, channel: 'reserve', note: `Giữ chỗ ${amount}đ đến hết ${untilDate}` });
      changes.appointments = [appointment];
      auditChange(audit, 'update', 'appointments', appointment.id, source, appointment);
    }
    return { changes, audit, roomIds: [room.id] };
  });
}

async function cancelReservation(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  return mutate(ctx, (idx) => {
    const before = idx.reservations[String(req.reservationId || '')];
    if (!before || !activeReservation(before)) throw Object.assign(new Error('Phiếu giữ chỗ không tồn tại hoặc đã được xử lý'), { code: 'validation' });
    const room = idx.rooms[before.roomId];
    if (!room || !core.inScope(ctx, room.propertyId || '')) throw Object.assign(new Error('Phiếu giữ chỗ ngoài phạm vi căn được giao'), { code: 'forbidden' });
    const resolution = String(req.resolution || '');
    if (!['refund', 'forfeit'].includes(resolution)) throw Object.assign(new Error('Phải chọn hoàn tiền hoặc giữ tiền bỏ cọc'), { code: 'validation' });
    const reservation = core.clone(before);
    reservation.status = String(req.status || (resolution === 'refund' ? 'cancelled' : 'forfeited'));
    reservation.cancelledAt = core.nowIso();
    reservation.cancelReason = String(req.reason || '').slice(0, 500);
    const changes = { reservations: [reservation] };
    const audit = [];
    auditChange(audit, 'update', 'reservations', reservation.id, before, reservation);
    const held = Math.max(0, reservationHeld(idx, reservation.id));
    if (held > 0) {
      const deposit = {
        id: core.generatedId('dep'), leaseId: '', type: resolution === 'refund' ? 'refund' : 'deduct', amount: held,
        at: core.today(), method: resolution === 'refund' ? (reservation.paymentMethod || 'cash') : '',
        note: resolution === 'refund' ? 'Hoàn tiền khi đóng giữ chỗ' : 'Khách bỏ cọc', createdBy: ctx.staffName || 'Chủ nhà',
        createdAt: core.nowIso(), reservationId: reservation.id, roomId: reservation.roomId,
        tenantId: reservation.tenantId || '', appointmentId: reservation.appointmentId || '', reference: ''
      };
      changes.depositLedger = [deposit];
      auditChange(audit, 'create', 'depositLedger', deposit.id, null, deposit);
    }
    if (reservation.appointmentId && idx.appointments[reservation.appointmentId]) {
      const oldAppointment = idx.appointments[reservation.appointmentId];
      const appointment = core.clone(oldAppointment);
      appointment.status = 'lost'; appointment.reserveAmount = 0; appointment.reserveUntil = '';
      changes.appointments = [appointment];
      auditChange(audit, 'update', 'appointments', appointment.id, oldAppointment, appointment);
    }
    return { changes, audit, roomIds: [reservation.roomId] };
  });
}

function occupantsOf(idx, leaseId) {
  return Object.values(idx.leaseOccupants).filter((item) => !item.deleted && item.leaseId === leaseId && !item.leftAt);
}
function pushStatus(lease, action, date, actor, note) {
  lease.statusHistory = Array.isArray(lease.statusHistory) ? lease.statusHistory : [];
  lease.statusHistory.push({ action, at: date, by: actor, note: note || '' });
}

async function leaseTransition(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  return mutate(ctx, (idx) => {
    const lease = core.clone(idx.leases[String(req.leaseId || '')]);
    if (!lease) throw Object.assign(new Error('Không tìm thấy hợp đồng'), { code: 'validation' });
    const oldLease = core.clone(lease);
    const room = idx.rooms[lease.roomId];
    if (!room || !core.inScope(ctx, room.propertyId || '')) throw Object.assign(new Error('Hợp đồng ngoài phạm vi căn được giao'), { code: 'forbidden' });
    const operation = String(req.operation || '');
    const date = String(req.date || core.today());
    if (!dateOk(date)) throw Object.assign(new Error('Ngày hiệu lực không hợp lệ'), { code: 'validation' });
    const actor = ctx.staffName || 'Chủ nhà';
    const changes = { leases: [lease] };
    const audit = [];
    const roomIds = [lease.roomId];
    const occupants = occupantsOf(idx, lease.id);

    if (operation === 'cancel') {
      if (lease.status !== 'draft') throw Object.assign(new Error('Chỉ hủy được hợp đồng nháp'), { code: 'validation' });
      if (core.depositHeldForLease(idx, lease.id) > 0) throw Object.assign(new Error('Hợp đồng còn tiền cọc đang giữ'), { code: 'validation' });
      lease.status = 'cancelled'; lease.terminationReason = String(req.reason || 'Hủy hợp đồng nháp').slice(0, 500);
      pushStatus(lease, 'cancel', date, actor, lease.terminationReason);
    } else if (operation === 'checkin') {
      if (lease.status !== 'draft') throw Object.assign(new Error('Hợp đồng không còn ở trạng thái chờ nhận phòng'), { code: 'validation' });
      if (lease.startDate && date < lease.startDate) throw Object.assign(new Error('Ngày nhận phòng không được trước ngày bắt đầu'), { code: 'validation' });
      if (Object.values(idx.leases).some((item) => item.id !== lease.id && item.roomId === lease.roomId && liveLease(item))) throw Object.assign(new Error('Phòng đang có hợp đồng hiệu lực khác'), { code: 'conflict' });
      if (occupants.filter((item) => item.role === 'primary' && item.occupantId === lease.primaryTenantId).length !== 1) throw Object.assign(new Error('Hợp đồng phải có đúng một người đại diện'), { code: 'validation' });
      if (Number(room.capacity || 0) > 0 && occupants.length > Number(room.capacity)) throw Object.assign(new Error('Số người ở vượt sức chứa phòng'), { code: 'validation' });
      lease.status = 'active'; lease.moveInAt = date; if (!lease.signedAt) lease.signedAt = date;
      pushStatus(lease, 'checkin', date, actor, `Nhận phòng ${room.name || room.id}`);
      changes.leaseOccupants = [];
      changes.tenants = [];
      occupants.forEach((link) => {
        const nextLink = core.clone(link); if (!nextLink.joinedAt) nextLink.joinedAt = date;
        addChange(changes, 'leaseOccupants', nextLink);
        const tenant = core.clone(idx.tenants[link.occupantId]);
        if (tenant) {
          tenant.roomId = lease.roomId; tenant.active = true; tenant.moveOutDate = ''; if (!tenant.moveInDate) tenant.moveInDate = date;
          if (tenant.id === lease.primaryTenantId) { tenant.depositRequired = lease.depositRequired; tenant.depositPaid = Math.max(0, core.depositHeldForLease(idx, lease.id)); }
          addChange(changes, 'tenants', tenant);
        }
      });
      if (Array.isArray(req.handover) && req.handover.length) changes.handoverItems = req.handover.map((item) => Object.assign({}, item, { leaseId: lease.id, phase: 'checkin', createdAt: item.createdAt || core.nowIso() }));
    } else if (operation === 'transfer') {
      if (!liveLease(lease)) throw Object.assign(new Error('Hợp đồng không còn hiệu lực'), { code: 'validation' });
      const newRoom = idx.rooms[String(req.newRoomId || '')];
      if (!newRoom || newRoom.id === lease.roomId || newRoom.archived || newRoom.status === 'maintenance') throw Object.assign(new Error('Phòng chuyển đến không hợp lệ'), { code: 'validation' });
      if (!core.inScope(ctx, newRoom.propertyId || '')) throw Object.assign(new Error('Phòng chuyển đến ngoài phạm vi căn được giao'), { code: 'forbidden' });
      if (Object.values(idx.leases).some((item) => item.id !== lease.id && item.roomId === newRoom.id && liveLease(item)) || Object.values(idx.reservations).some((item) => item.roomId === newRoom.id && activeReservation(item))) throw Object.assign(new Error('Phòng chuyển đến không còn trống'), { code: 'conflict' });
      if (Number(newRoom.capacity || 0) > 0 && occupants.length > Number(newRoom.capacity)) throw Object.assign(new Error('Số người ở vượt sức chứa phòng mới'), { code: 'validation' });
      const oldRoomId = lease.roomId;
      lease.roomHistory = Array.isArray(lease.roomHistory) ? lease.roomHistory : [];
      lease.roomHistory.push({ roomId: oldRoomId, from: lease.moveInAt || lease.startDate || '', to: date });
      lease.roomId = newRoom.id; lease.propertyId = newRoom.propertyId;
      if (!req.keepRent) {
        lease.renewals = Array.isArray(lease.renewals) ? lease.renewals : [];
        lease.renewals.push({ type: 'rent-change', at: date, oldRent: Number(lease.rentAmount || 0), newRent: Math.max(0, Number(req.newRent || newRoom.price || 0)) });
        lease.rentAmount = Math.max(0, Number(req.newRent || newRoom.price || 0));
      }
      pushStatus(lease, 'transfer', date, actor, `${room.name || oldRoomId} → ${newRoom.name || newRoom.id}`);
      changes.tenants = [];
      occupants.forEach((link) => { const tenant = core.clone(idx.tenants[link.occupantId]); if (tenant) { tenant.roomId = newRoom.id; addChange(changes, 'tenants', tenant); } });
      changes.handoverItems = [].concat(req.handoverOut || [], req.handoverIn || []).map((item) => Object.assign({}, item, { leaseId: lease.id, createdAt: item.createdAt || core.nowIso() }));
      roomIds.push(newRoom.id);
    } else if (operation === 'checkout') {
      if (!liveLease(lease)) throw Object.assign(new Error('Hợp đồng không còn hiệu lực'), { code: 'validation' });
      const held = Math.max(0, core.depositHeldForLease(idx, lease.id));
      const deduct = Math.max(0, Number(req.deduct || 0));
      if (deduct > held) throw Object.assign(new Error('Số tiền trừ vượt quá cọc đang giữ'), { code: 'validation' });
      if (deduct > 0 && !String(req.note || '').trim()) throw Object.assign(new Error('Trừ cọc cần ghi rõ lý do'), { code: 'validation' });
      const refund = held - deduct;
      lease.status = 'ended'; lease.moveOutAt = date; lease.terminationReason = String(req.reason || '').slice(0, 500);
      lease.depositDeduct = deduct; lease.depositRefund = refund; lease.settlementNote = String(req.note || '').slice(0, 1000);
      pushStatus(lease, 'checkout', date, actor, `Trừ cọc ${deduct}; hoàn ${refund}`);
      changes.depositLedger = [];
      if (deduct > 0) changes.depositLedger.push({ id: core.generatedId('dep'), leaseId: lease.id, type: 'deduct', amount: deduct, at: date, method: '', note: lease.settlementNote, createdBy: actor, createdAt: core.nowIso(), reservationId: '', roomId: lease.roomId, tenantId: lease.primaryTenantId, appointmentId: '', reference: '' });
      if (refund > 0) changes.depositLedger.push({ id: core.generatedId('dep'), leaseId: lease.id, type: 'refund', amount: refund, at: date, method: String(req.refundMethod || 'cash'), note: 'Hoàn cọc khi thanh lý', createdBy: actor, createdAt: core.nowIso(), reservationId: '', roomId: lease.roomId, tenantId: lease.primaryTenantId, appointmentId: '', reference: String(req.reference || '').slice(0, 200) });
      changes.leaseOccupants = [];
      changes.tenants = [];
      occupants.forEach((link) => {
        const nextLink = core.clone(link); nextLink.leftAt = date; addChange(changes, 'leaseOccupants', nextLink);
        const tenant = core.clone(idx.tenants[link.occupantId]);
        if (tenant) {
          const otherLink = Object.values(idx.leaseOccupants).find((item) => !item.deleted && item.occupantId === tenant.id && item.leaseId !== lease.id && !item.leftAt && liveLease(idx.leases[item.leaseId]));
          const otherLease = otherLink && idx.leases[otherLink.leaseId];
          if (otherLease) { tenant.active = true; tenant.roomId = otherLease.roomId; tenant.moveOutDate = ''; }
          else { tenant.active = false; tenant.roomId = ''; tenant.moveOutDate = date; }
          addChange(changes, 'tenants', tenant);
        }
      });
      if (Array.isArray(req.handover) && req.handover.length) changes.handoverItems = req.handover.map((item) => Object.assign({}, item, { leaseId: lease.id, phase: 'checkout', createdAt: item.createdAt || core.nowIso() }));
    } else {
      throw Object.assign(new Error('Nghiệp vụ hợp đồng không hợp lệ'), { code: 'validation' });
    }

    changes.leases[0] = lease;
    auditChange(audit, 'update', 'leases', lease.id, oldLease, lease, operation);
    (changes.depositLedger || []).forEach((entry) => auditChange(audit, 'create', 'depositLedger', entry.id, null, entry));
    return { changes, audit, roomIds };
  });
}

async function setTenantPin(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  const pin = String(req.pin || Math.floor(100000 + Math.random() * 900000));
  if (!/^\d{6}$/.test(pin)) throw Object.assign(new Error('PIN phải gồm đúng 6 chữ số'), { code: 'validation' });
  const output = await mutate(ctx, (idx) => {
    const tenant = core.clone(idx.tenants[String(req.tenantId || '')]);
    if (!tenant) throw Object.assign(new Error('Không tìm thấy người thuê'), { code: 'validation' });
    if (!core.inScope(ctx, core.propertyOf('tenants', tenant, idx))) throw Object.assign(new Error('Người thuê ngoài phạm vi căn được giao'), { code: 'forbidden' });
    const accountBefore = Object.values(idx.accounts).find((item) => !item.deleted && item.occupantId === tenant.id);
    if (accountBefore) {
      const account = core.clone(accountBefore);
      account.phone = account.phone || tenant.phone; account.active = true;
      account.pinHashV2 = core.hashPassword(pin); delete account.pin; delete account.pinHash; delete account.pinSalt;
      return { changes: { accounts: [account] }, audit: [{ action: 'pin-reset', collection: 'accounts', recordId: account.id, before: null, after: null }] };
    }
    tenant.pinHashV2 = core.hashPassword(pin); delete tenant.pin; delete tenant.pinHash; delete tenant.pinSalt;
    return { changes: { tenants: [tenant] }, audit: [{ action: 'pin-reset', collection: 'tenants', recordId: tenant.id, before: null, after: null }] };
  });
  await core.updateAuth((auth) => {
    auth.residentSessions = auth.residentSessions || {};
    Object.keys(auth.residentSessions).forEach((key) => { if (auth.residentSessions[key].tenantId === req.tenantId) delete auth.residentSessions[key]; });
  }).catch(() => {});
  return Object.assign(output, { pin });
}

async function setStaffPass(req, ctx) {
  requireAdmin(ctx, ['owner']);
  const password = String(req.password || '');
  if (password.length < 10) throw Object.assign(new Error('Mật khẩu nhân viên cần ít nhất 10 ký tự'), { code: 'validation' });
  const output = await mutate(ctx, (idx) => {
    const staff = core.clone(idx.staffUsers[String(req.staffId || '')]);
    if (!staff) throw Object.assign(new Error('Không tìm thấy nhân viên'), { code: 'validation' });
    staff.passHashV2 = core.hashPassword(password); delete staff.passHash; delete staff.passSalt;
    return { changes: { staffUsers: [staff] }, audit: [{ action: 'password-reset', collection: 'staffUsers', recordId: staff.id, before: null, after: null }] };
  });
  return output;
}

async function book(req) {
  if (String(req.website || '').trim()) return { id: 'ok' };
  if (!req.consent) throw Object.assign(new Error('Vui lòng đồng ý với chính sách bảo mật để đặt lịch'), { code: 'validation' });
  const phone = normalizePhone(req.customerPhone || req.phone);
  const roomId = String(req.roomId || '');
  const rateKey = crypto.createHash('sha256').update(`${phone}:${roomId}`).digest('hex').slice(0, 24);
  await core.updateAuth((auth) => {
    const now = Date.now(), hourAgo = now - 3600000;
    auth.publicBookRate = auth.publicBookRate || { all: [], keys: {} };
    auth.publicBookRate.all = (auth.publicBookRate.all || []).filter((stamp) => stamp > hourAgo);
    auth.publicBookRate.keys = auth.publicBookRate.keys || {};
    Object.keys(auth.publicBookRate.keys).forEach((key) => {
      auth.publicBookRate.keys[key] = (auth.publicBookRate.keys[key] || []).filter((stamp) => stamp > hourAgo);
      if (!auth.publicBookRate.keys[key].length) delete auth.publicBookRate.keys[key];
    });
    const own = auth.publicBookRate.keys[rateKey] || [];
    if (auth.publicBookRate.all.length >= 30) throw Object.assign(new Error('Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau.'), { code: 'rate' });
    if (own.length >= 3) throw Object.assign(new Error('Bạn vừa gửi nhiều yêu cầu cho phòng này. Quản lý sẽ liên hệ sớm.'), { code: 'rate' });
  });
  const result = await mutate({ authenticated: true, role: 'owner', staffName: 'Trang khách', staffId: '', propertyIds: [] }, (idx) => {
    const room = idx.rooms[roomId];
    if (!room || room.deleted || room.archived) throw Object.assign(new Error('Phòng này không còn nhận lịch xem'), { code: 'validation' });
    const date = String(req.date || ''), time = String(req.time || '');
    if (!dateOk(date) || !/^\d{1,2}:\d{2}$/.test(time)) throw Object.assign(new Error('Ngày giờ xem phòng không hợp lệ'), { code: 'validation' });
    if (date < core.today()) throw Object.assign(new Error('Ngày xem phòng không được ở quá khứ'), { code: 'validation' });
    const settings = idx.settings.app || {};
    const start = /^\d{2}:\d{2}$/.test(settings.workStart || '') ? settings.workStart : '08:00';
    const end = /^\d{2}:\d{2}$/.test(settings.workEnd || '') ? settings.workEnd : '20:00';
    if (time < start || time > end) throw Object.assign(new Error(`Vui lòng chọn giờ trong khung làm việc ${start}–${end}`), { code: 'validation' });
    if (['reserved', 'maintenance'].includes(room.status)) throw Object.assign(new Error('Phòng này hiện chưa nhận lịch xem'), { code: 'validation' });
    if (room.status === 'occupied') {
      const live = Object.values(idx.leases).filter((lease) => lease.roomId === room.id && liveLease(lease) && dateOk(lease.endDate)).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))[0];
      const days = live ? Math.ceil((new Date(`${live.endDate}T00:00:00+07:00`) - new Date(`${core.today()}T00:00:00+07:00`)) / 86400000) : 999;
      if (days < 0 || days > 45) throw Object.assign(new Error('Phòng đang có người thuê và chưa đến thời điểm nhận lịch xem'), { code: 'validation' });
    }
    if (Object.values(idx.appointments).some((item) => !item.deleted && item.roomId === room.id && item.date === date && item.time === time && !['cancelled', 'lost'].includes(item.status))) throw Object.assign(new Error('Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.'), { code: 'conflict' });
    if (!/^0\d{9}$/.test(phone)) throw Object.assign(new Error('Số điện thoại chưa đúng'), { code: 'validation' });
    if (Object.values(idx.appointments).some((item) => !item.deleted && item.roomId === room.id && normalizePhone(item.customerPhone) === phone && item.date === date && item.time === time && !['cancelled', 'lost'].includes(item.status))) throw Object.assign(new Error('Bạn đã đặt đúng khung giờ này rồi. Quản lý sẽ sớm liên hệ xác nhận.'), { code: 'conflict' });
    const appointment = {
      id: core.generatedId('a'), roomId: room.id, customerName: String(req.customerName || req.name || '').trim().slice(0, 100),
      customerPhone: phone, date, time, note: String(req.note || '').slice(0, 500), status: 'new', source: 'public',
      careLog: [], reserveAmount: 0, reserveUntil: '', convertedLeaseId: '', createdAt: core.nowIso()
    };
    if (appointment.customerName.length < 2) throw Object.assign(new Error('Vui lòng nhập họ tên'), { code: 'validation' });
    return { changes: { appointments: [appointment] }, audit: [], result: { appointment } };
  });
  await core.updateAuth((auth) => {
    const now = Date.now();
    auth.publicBookRate = auth.publicBookRate || { all: [], keys: {} };
    auth.publicBookRate.all = (auth.publicBookRate.all || []).filter((stamp) => stamp > now - 3600000);
    auth.publicBookRate.keys = auth.publicBookRate.keys || {};
    const own = (auth.publicBookRate.keys[rateKey] || []).filter((stamp) => stamp > now - 3600000);
    auth.publicBookRate.all.push(now); own.push(now); auth.publicBookRate.keys[rateKey] = own;
  }).catch(() => {});
  return result;
}

async function publicAvailability(req) {
  const snap = await core.snapshot();
  const idx = core.indexState(snap);
  const roomId = String(req.roomId || ''), date = String(req.date || '');
  if (!core.safeId(roomId) || !dateOk(date) || date < core.today()) throw Object.assign(new Error('Phòng hoặc ngày xem không hợp lệ'), { code: 'validation' });
  const room = idx.rooms[roomId];
  if (!room || room.deleted || room.archived || ['reserved', 'maintenance'].includes(room.status)) throw Object.assign(new Error('Phòng này hiện chưa nhận lịch xem'), { code: 'validation' });
  if (room.status === 'occupied') {
    const live = Object.values(idx.leases).filter((lease) => lease.roomId === room.id && liveLease(lease) && dateOk(lease.endDate)).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))[0];
    const days = live ? Math.ceil((new Date(`${live.endDate}T00:00:00+07:00`) - new Date(`${core.today()}T00:00:00+07:00`)) / 86400000) : 999;
    if (days < 0 || days > 45) throw Object.assign(new Error('Phòng đang có người thuê và chưa đến thời điểm nhận lịch xem'), { code: 'validation' });
  }
  const busy = Object.values(idx.appointments).filter((item) => !item.deleted && item.roomId === roomId && item.date === date && !['cancelled', 'lost'].includes(item.status)).map((item) => item.time);
  return { busyTimes: busy.sort() };
}

async function rescheduleAppointment(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager', 'staff']);
  return mutate(ctx, (idx) => {
    const before = idx.appointments[String(req.appointmentId || '')];
    if (!before) throw Object.assign(new Error('Không tìm thấy lịch xem'), { code: 'validation' });
    if (!core.inScope(ctx, core.propertyOf('appointments', before, idx))) throw Object.assign(new Error('Lịch hẹn ngoài phạm vi căn được giao'), { code: 'forbidden' });
    if (['converted', 'lost', 'cancelled', 'reserved'].includes(before.status)) throw Object.assign(new Error('Lịch hẹn đã sang bước khác nên không thể đổi giờ xem'), { code: 'validation' });
    const appointment = core.clone(before);
    if (!dateOk(req.date) || !/^\d{1,2}:\d{2}$/.test(String(req.time || ''))) throw Object.assign(new Error('Ngày giờ mới không hợp lệ'), { code: 'validation' });
    if (req.date < core.today()) throw Object.assign(new Error('Ngày hẹn không được ở quá khứ'), { code: 'validation' });
    const settings = idx.settings.app || {};
    const start = /^\d{2}:\d{2}$/.test(settings.workStart || '') ? settings.workStart : '08:00';
    const end = /^\d{2}:\d{2}$/.test(settings.workEnd || '') ? settings.workEnd : '20:00';
    if (req.time < start || req.time > end) throw Object.assign(new Error(`Giờ hẹn phải nằm trong khung ${start}–${end}`), { code: 'validation' });
    if (Object.values(idx.appointments).some((item) => item.id !== appointment.id && !item.deleted && item.roomId === appointment.roomId && item.date === req.date && item.time === req.time && !['cancelled', 'lost'].includes(item.status))) throw Object.assign(new Error('Khung giờ mới vừa có người đặt'), { code: 'conflict' });
    appointment.date = req.date; appointment.time = req.time;
    if (['new', 'contacted'].includes(appointment.status)) appointment.status = 'appointment_confirmed';
    appointment.careLog = Array.isArray(appointment.careLog) ? appointment.careLog : [];
    appointment.careLog.push({ at: core.nowIso(), by: ctx.staffName, channel: 'reschedule', note: `Đổi lịch sang ${req.date} ${req.time}` });
    return { changes: { appointments: [appointment] }, audit: [{ action: 'update', collection: 'appointments', recordId: appointment.id, before, after: appointment }] };
  });
}

async function unlockReading(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  if (!String(req.reason || '').trim()) throw Object.assign(new Error('Mở khóa chỉ số cần ghi rõ lý do'), { code: 'validation' });
  return mutate(ctx, (idx) => {
    const before = idx.utilityReadings[String(req.readingId || '')];
    if (!before) throw Object.assign(new Error('Không tìm thấy chỉ số'), { code: 'validation' });
    if (!core.inScope(ctx, core.propertyOf('utilityReadings', before, idx))) throw Object.assign(new Error('Chỉ số ngoài phạm vi căn được giao'), { code: 'forbidden' });
    const reading = core.clone(before); reading.status = 'draft'; reading.lockedAt = ''; reading.unlockNote = String(req.reason).slice(0, 500);
    return { changes: { utilityReadings: [reading] }, audit: [{ action: 'unlock', collection: 'utilityReadings', recordId: reading.id, before, after: reading, note: reading.unlockNote }] };
  });
}

function residentView(idx, tenant, sessionKey) {
  const live = Object.values(idx.leases).find((lease) => liveLease(lease) && (lease.primaryTenantId === tenant.id || occupantsOf(idx, lease.id).some((item) => item.occupantId === tenant.id)));
  const room = live ? idx.rooms[live.roomId] : tenant.roomId ? idx.rooms[tenant.roomId] : null;
  const property = room ? idx.properties[room.propertyId] : null;
  const invoiceIds = new Set(Object.values(idx.invoices).filter((item) => !item.deleted && (item.tenantId === tenant.id || (live && item.leaseId === live.id))).map((item) => item.id));
  return {
    tenant: core.clientSafe('tenants', tenant), room: room ? core.clientSafe('rooms', room) : null,
    property: property ? core.clientSafe('properties', property) : null, lease: live ? core.clientSafe('leases', live) : null,
    coOccupants: live ? occupantsOf(idx, live.id).map((link) => core.clientSafe('tenants', idx.tenants[link.occupantId])).filter(Boolean) : [],
    invoices: Object.values(idx.invoices).filter((item) => invoiceIds.has(item.id)).map((x) => core.clientSafe('invoices', x)),
    readings: Object.values(idx.utilityReadings).filter((item) => !item.deleted && room && item.roomId === room.id).map((x) => core.clientSafe('utilityReadings', x)),
    payments: Object.values(idx.payments).filter((item) => !item.deleted && invoiceIds.has(item.invoiceId)).map((x) => core.clientSafe('payments', x)),
    tickets: Object.values(idx.maintenanceTickets).filter((item) => !item.deleted && item.tenantId === tenant.id).map((x) => core.clientSafe('maintenanceTickets', x)),
    notifications: Object.values(idx.notifications).filter((item) => !item.deleted && item.tenantId === tenant.id).map((x) => core.clientSafe('notifications', x)),
    handoverItems: live ? Object.values(idx.handoverItems).filter((item) => !item.deleted && item.leaseId === live.id).map((x) => core.clientSafe('handoverItems', x)) : [],
    assets: room ? Object.values(idx.assets).filter((item) => !item.deleted && item.roomId === room.id).map((x) => core.clientSafe('assets', x)) : [],
    depositLedger: live ? Object.values(idx.depositLedger).filter((item) => !item.deleted && item.leaseId === live.id).map((x) => core.clientSafe('depositLedger', x)) : [],
    settings: idx.settings.app ? core.clientSafe('settings', idx.settings.app) : {}, sessionKey
  };
}

async function residentLogin(req) {
  const phone = normalizePhone(req.phone), pin = String(req.pin || '');
  const snap = await core.snapshot();
  const idx = core.indexState(snap);
  const account = Object.values(idx.accounts).find((item) => !item.deleted && item.active && normalizePhone(item.phone) === phone);
  const tenant = account ? idx.tenants[account.occupantId] : Object.values(idx.tenants).find((item) => !item.deleted && item.active && normalizePhone(item.phone) === phone);
  const holder = account || tenant;
  if (!tenant || !tenant.active || !holder || !holder.pinHashV2 || !core.verifyPassword(pin, holder.pinHashV2)) throw Object.assign(new Error('Số điện thoại hoặc mã PIN không đúng'), { code: 'auth' });
  const token = crypto.randomBytes(24).toString('hex');
  await core.updateAuth((auth) => {
    auth.residentSessions = auth.residentSessions || {};
    auth.residentSessions[core.hashToken(token)] = { tenantId: tenant.id, phone, pinVersion: core.hashToken(holder.pinHashV2), exp: Date.now() + 30 * 86400000, created: Date.now() };
  });
  return residentView(idx, tenant, token);
}

async function residentSession(req) {
  const token = String(req.sessionKey || '');
  const auth = await core.authRead();
  const session = auth.data && auth.data.residentSessions && auth.data.residentSessions[core.hashToken(token)];
  if (!session || Number(session.exp || 0) <= Date.now() || session.phone !== normalizePhone(req.phone)) throw Object.assign(new Error('Phiên cư dân đã hết hạn'), { code: 'auth' });
  const idx = core.indexState(await core.snapshot());
  const tenant = idx.tenants[session.tenantId];
  const account = Object.values(idx.accounts).find((item) => !item.deleted && item.active && item.occupantId === session.tenantId);
  const holder = account || tenant;
  if (!tenant || !tenant.active || !holder || !holder.pinHashV2 || session.pinVersion !== core.hashToken(holder.pinHashV2)) throw Object.assign(new Error('Phiên cư dân đã bị thu hồi'), { code: 'auth' });
  return session;
}

async function residentPing(req) {
  const session = await residentSession(req);
  const idx = core.indexState(await core.snapshot());
  const tenant = idx.tenants[session.tenantId];
  if (!tenant || !tenant.active) throw Object.assign(new Error('Tài khoản cư dân không còn hoạt động'), { code: 'auth' });
  return residentView(idx, tenant, req.sessionKey);
}

async function residentTicket(req) {
  const session = await residentSession(req);
  const uploaded = [];
  try {
    for (const image of (Array.isArray(req.images) ? req.images.slice(0, 3) : [])) {
      const file = checkUpload(image);
      if (!file.mime.startsWith('image/')) throw Object.assign(new Error('Ảnh sự cố phải là JPG, PNG hoặc WEBP'), { code: 'validation' });
      const path = `images/tickets/${session.tenantId}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${cleanFileName(image.name)}`;
      await core.uploadObject('huy-private', path, file.buffer, file.mime);
      uploaded.push(path);
    }
    return await mutate({ authenticated: true, role: 'owner', staffName: 'Cư dân', staffId: session.tenantId, propertyIds: [] }, (idx) => {
      const tenant = idx.tenants[session.tenantId];
      const live = Object.values(idx.leases).find((lease) => liveLease(lease) && occupantsOf(idx, lease.id).some((item) => item.occupantId === tenant.id));
      if (!live) throw Object.assign(new Error('Không tìm thấy hợp đồng đang ở'), { code: 'validation' });
      const ticket = {
        id: core.generatedId('mt'), tenantId: tenant.id, leaseId: live.id, roomId: live.roomId,
        title: String(req.title || '').trim().slice(0, 120), category: String(req.category || 'other'),
        description: String(req.description || '').trim().slice(0, 2000), priority: String(req.priority || 'normal'), status: 'new',
        imageIds: uploaded.map((path) => `priv:${path}`), statusHistory: [{ status: 'new', at: core.nowIso(), by: tenant.name }],
        assigneeId: '', resolution: '', createdAt: core.nowIso()
      };
      if (ticket.title.length < 3 || ticket.description.length < 3) throw Object.assign(new Error('Vui lòng mô tả sự cố rõ hơn'), { code: 'validation' });
      return { changes: { maintenanceTickets: [ticket] }, audit: [], result: { ticket } };
    });
  } catch (error) {
    await Promise.all(uploaded.map((path) => core.deleteObject('huy-private', path).catch(() => {})));
    throw error;
  }
}

async function residentChangePin(req) {
  const session = await residentSession(req);
  const oldPin = String(req.oldPin || ''), newPin = String(req.newPin || '');
  if (!/^\d{6}$/.test(newPin)) throw Object.assign(new Error('PIN mới phải gồm đúng 6 chữ số'), { code: 'validation' });
  await mutate({ authenticated: true, role: 'owner', staffName: 'Cư dân', staffId: session.tenantId, propertyIds: [] }, (idx) => {
    const tenant = core.clone(idx.tenants[session.tenantId]);
    const accountBefore = Object.values(idx.accounts).find((item) => !item.deleted && item.active && item.occupantId === session.tenantId);
    const holder = accountBefore || tenant;
    if (!tenant || !holder || !holder.pinHashV2 || !core.verifyPassword(oldPin, holder.pinHashV2)) throw Object.assign(new Error('PIN hiện tại chưa đúng'), { code: 'auth' });
    if (accountBefore) {
      const account = core.clone(accountBefore); account.pinHashV2 = core.hashPassword(newPin);
      return { changes: { accounts: [account] }, audit: [] };
    }
    tenant.pinHashV2 = core.hashPassword(newPin);
    return { changes: { tenants: [tenant] }, audit: [] };
  });
  await core.updateAuth((auth) => {
    auth.residentSessions = auth.residentSessions || {};
    Object.keys(auth.residentSessions).forEach((key) => { if (auth.residentSessions[key].tenantId === session.tenantId) delete auth.residentSessions[key]; });
  }).catch(() => {});
  return {};
}

async function residentLogout(req, all) {
  const session = await residentSession(req);
  await core.updateAuth((auth) => {
    auth.residentSessions = auth.residentSessions || {};
    if (all) Object.keys(auth.residentSessions).forEach((key) => { if (auth.residentSessions[key].tenantId === session.tenantId) delete auth.residentSessions[key]; });
    else delete auth.residentSessions[core.hashToken(req.sessionKey)];
  });
  return {};
}

async function residentMarkRead(req) {
  const session = await residentSession(req);
  const ids = new Set(Array.isArray(req.ids) ? req.ids.slice(0, 100) : []);
  return mutate({ authenticated: true, role: 'owner', staffName: 'Cư dân', staffId: session.tenantId, propertyIds: [] }, (idx) => {
    const list = Object.values(idx.notifications).filter((item) => ids.has(item.id) && item.tenantId === session.tenantId).map((item) => Object.assign({}, item, { readAt: core.nowIso() }));
    return { changes: list.length ? { notifications: list } : {}, audit: [] };
  });
}

function cleanFileName(value) {
  return String(value || 'tep').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100) || 'tep';
}
function checkUpload(req) {
  const data = String(req.data || '');
  if (!data || data.length > 4 * 1024 * 1024) throw Object.assign(new Error('Tệp trống hoặc vượt quá 3 MB'), { code: 'size' });
  const mime = String(req.mime || 'application/octet-stream').toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) throw Object.assign(new Error('Chỉ nhận JPG, PNG, WEBP hoặc PDF'), { code: 'validation' });
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > 3 * 1024 * 1024) throw Object.assign(new Error('Tệp vượt quá 3 MB'), { code: 'size' });
  return { buffer, mime };
}

async function legacyMedia(action, payload) {
  const url = String(process.env.APPS_SCRIPT_URL || '');
  const key = String(process.env.APPS_SCRIPT_WRITE_KEY || process.env.HUY_WRITE_KEY || '');
  if (!url || !key) throw Object.assign(new Error('Tệp này nằm ở kho Drive cũ. Cần APPS_SCRIPT_URL và APPS_SCRIPT_WRITE_KEY để đọc trong giai đoạn chuyển đổi.'), { code: 'legacy_media' });
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action, key }, payload || {})), redirect: 'follow'
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch (_) { throw Object.assign(new Error('Kho Drive cũ không trả về dữ liệu hợp lệ'), { code: 'legacy_media' }); }
  if (!response.ok || !result.ok) throw Object.assign(new Error(result.error || 'Không đọc được tệp từ kho Drive cũ'), { code: result.code || 'legacy_media' });
  return result;
}

async function upload(req, ctx) {
  requireAdmin(ctx);
  const file = checkUpload(req);
  const isPrivate = req.scope === 'private';
  const path = `${isPrivate ? 'images' : 'rooms'}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${cleanFileName(req.name)}`;
  await core.uploadObject(isPrivate ? 'huy-private' : 'huy-public', path, file.buffer, file.mime);
  const cfg = core.env();
  return isPrivate ? { id: path } : { id: path, url: `${cfg.url}/storage/v1/object/public/huy-public/${path.split('/').map(encodeURIComponent).join('/')}` };
}

async function uploadDocument(req, ctx) {
  requireAdmin(ctx, ['owner', 'manager']);
  const idx = core.indexState(await core.snapshot());
  const lease = idx.leases[String(req.leaseId || '')];
  if (!lease || !core.inScope(ctx, core.propertyOf('leases', lease, idx))) throw Object.assign(new Error('Hợp đồng không tồn tại hoặc ngoài phạm vi căn được giao'), { code: 'forbidden' });
  const file = checkUpload(req);
  const path = `documents/${String(req.leaseId || 'unknown').replace(/[^A-Za-z0-9._-]/g, '')}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${cleanFileName(req.name)}`;
  await core.uploadObject('huy-private', path, file.buffer, file.mime);
  return { file: { id: path, name: cleanFileName(req.name), mime: file.mime, size: file.buffer.length, createdAt: core.nowIso() } };
}

async function getPrivate(req, ctx, resident) {
  let residentAuth = null;
  if (resident) residentAuth = await residentSession(req); else requireAdmin(ctx);
  const path = String(req.fileId || req.imageId || '');
  const supabasePath = /^(documents|images)\/[A-Za-z0-9._\/-]+$/.test(path) && !path.includes('..');
  const legacyPath = /^[A-Za-z0-9_-]{8,200}$/.test(path);
  if (!supabasePath && !legacyPath) throw Object.assign(new Error('Mã tệp không hợp lệ'), { code: 'validation' });
  if (!residentAuth && req.fileId) {
    const leaseId = String(req.leaseId || '');
    if (!leaseId || (supabasePath && !path.startsWith(`documents/${leaseId}/`))) throw Object.assign(new Error('Tệp không thuộc hợp đồng được yêu cầu'), { code: 'forbidden' });
    const idx = core.indexState(await core.snapshot());
    const lease = idx.leases[leaseId];
    if (!lease || !core.inScope(ctx, core.propertyOf('leases', lease, idx))) throw Object.assign(new Error('Hợp đồng ngoài phạm vi căn được giao'), { code: 'forbidden' });
    if (legacyPath && !(lease.documentFiles || []).some((file) => file && file.id === path)) throw Object.assign(new Error('Tệp không thuộc hồ sơ hợp đồng'), { code: 'forbidden' });
  }
  if (!residentAuth && req.imageId && ctx.role !== 'owner' && ctx.propertyIds && ctx.propertyIds.length) {
    const idx = core.indexState(await core.snapshot());
    const collections = ['utilityReadings', 'maintenanceTickets', 'handoverItems', 'assets'];
    const found = collections.some((collection) => Object.values(idx[collection]).some((record) =>
      !record.deleted && core.inScope(ctx, core.propertyOf(collection, record, idx)) &&
      (record.imageIds || []).some((id) => String(id).replace(/^priv:/, '') === path)
    ));
    if (!found) throw Object.assign(new Error('Ảnh ngoài phạm vi căn được giao'), { code: 'forbidden' });
  }
  if (residentAuth) {
    const idx = core.indexState(await core.snapshot());
    const tenant = idx.tenants[residentAuth.tenantId];
    if (!tenant || !tenant.active) throw Object.assign(new Error('Tài khoản cư dân không còn hoạt động'), { code: 'auth' });
    const view = residentView(idx, tenant, req.sessionKey);
    const allowed = new Set();
    ['readings', 'tickets', 'handoverItems', 'assets'].forEach((name) => {
      (view[name] || []).forEach((record) => (record.imageIds || []).forEach((id) => allowed.add(String(id).replace(/^priv:/, ''))));
    });
    if (!allowed.has(path)) throw Object.assign(new Error('Bạn không có quyền xem ảnh này'), { code: 'forbidden' });
  }
  if (legacyPath) return legacyMedia(req.fileId ? 'getPrivateFile' : 'getPrivateImage', req.fileId ? { fileId: path, leaseId: req.leaseId || '' } : { imageId: path });
  const file = await core.downloadObject('huy-private', path);
  return { data: file.buffer.toString('base64'), mime: file.mime, name: path.split('/').pop() };
}

async function removeFile(req, ctx, isPublic) {
  requireAdmin(ctx, ['owner', 'manager']);
  const path = String(req.fileId || '');
  const legacyPath = /^[A-Za-z0-9_-]{8,200}$/.test(path);
  if ((!/^[A-Za-z0-9._\/-]+$/.test(path) || path.includes('..')) && !legacyPath) throw Object.assign(new Error('Mã tệp không hợp lệ'), { code: 'validation' });
  if (legacyPath && !isPublic) {
    const leaseId = String(req.leaseId || '');
    const idx = core.indexState(await core.snapshot());
    const lease = idx.leases[leaseId];
    if (!lease || !core.inScope(ctx, core.propertyOf('leases', lease, idx)) || !(lease.documentFiles || []).some((file) => file && file.id === path)) throw Object.assign(new Error('Tệp không thuộc hồ sơ hợp đồng được yêu cầu'), { code: 'forbidden' });
  }
  if (legacyPath) return legacyMedia(isPublic ? 'deleteImage' : 'deletePrivateFile', isPublic ? { fileId: path } : { fileId: path, leaseId: req.leaseId || '' });
  if (!isPublic && path.startsWith('documents/')) {
    const leaseId = String(req.leaseId || '');
    if (!leaseId || !path.startsWith(`documents/${leaseId}/`)) throw Object.assign(new Error('Tệp không thuộc hợp đồng được yêu cầu'), { code: 'forbidden' });
    const idx = core.indexState(await core.snapshot());
    const lease = idx.leases[leaseId];
    if (!lease || !core.inScope(ctx, core.propertyOf('leases', lease, idx))) throw Object.assign(new Error('Hợp đồng ngoài phạm vi căn được giao'), { code: 'forbidden' });
  }
  await core.deleteObject(isPublic ? 'huy-public' : 'huy-private', path);
  return {};
}

async function sendZalo(req, ctx) {
  requireAdmin(ctx);
  const token = String(process.env.ZALO_OA_TOKEN || '');
  if (!token) throw Object.assign(new Error('Chưa khai báo ZALO_OA_TOKEN trên Vercel'), { code: 'setup' });
  const idx = core.indexState(await core.snapshot());
  const tenant = idx.tenants[String(req.tenantId || '')];
  if (!tenant || !tenant.zaloUserId) throw Object.assign(new Error('Người thuê chưa có Zalo User ID'), { code: 'validation' });
  if (!core.inScope(ctx, core.propertyOf('tenants', tenant, idx))) throw Object.assign(new Error('Người thuê ngoài phạm vi căn được giao'), { code: 'forbidden' });
  const endpoint = process.env.ZALO_OA_API_URL || 'https://openapi.zalo.me/v3.0/oa/message/cs';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: token },
    body: JSON.stringify({ recipient: { user_id: tenant.zaloUserId }, message: { text: String(req.message || '').slice(0, 2000) } })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || Number(result.error || 0) !== 0) throw Object.assign(new Error(result.message || `Zalo OA lỗi ${response.status}`), { code: 'zalo' });
  return { messageId: result.data && result.data.message_id || '' };
}

async function importSnapshot(req) {
  const key = String(req.migrationKey || '');
  if (!process.env.HUY_MIGRATION_KEY || !core.safeEqual(key, process.env.HUY_MIGRATION_KEY)) throw Object.assign(new Error('Khóa migration không đúng'), { code: 'forbidden' });
  const incoming = req.data;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw Object.assign(new Error('File sao lưu không đúng định dạng'), { code: 'validation' });
  const changes = {};
  const secureImportRecord = (collection, source) => {
    const record = core.clone(source);
    if (collection === 'tenants' || collection === 'accounts') {
      const legacyPin = String(record.pin || '');
      delete record.pin; delete record.pinHash; delete record.pinSalt; delete record.sessionSeed;
      if (!record.pinHashV2 && /^\d{4,6}$/.test(legacyPin)) {
        const salt = crypto.createHash('sha256').update(`huy-migration:${collection}:${record.id}`).digest('hex').slice(0, 32);
        record.pinHashV2 = core.hashPassword(legacyPin, salt);
      }
    }
    if (collection === 'staffUsers') { delete record.passHash; delete record.passSalt; }
    return record;
  };
  core.ALL_COLLECTIONS.forEach((collection) => {
    if (collection === 'settings') {
      const settings = incoming.settings || {};
      changes.settings = [Object.assign({}, settings, { id: 'app' })];
    } else if (Array.isArray(incoming[collection])) {
      changes[collection] = incoming[collection].filter((record) => record && core.safeId(record.id)).map((record) => secureImportRecord(collection, record));
    }
  });
  const migrationIdx = core.indexState({ revision: 0, data: changes });
  core.reconcileRooms(migrationIdx, changes, [], new Set(Object.keys(migrationIdx.rooms)));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snap = await core.snapshot();
    const count = Object.values(snap.data || {}).reduce((sum, list) => sum + (list || []).length, 0);
    if (count > 0 && !req.force) {
      const clean = (record) => {
        const out = core.clone(record || {}); delete out.updatedAt; delete out.deleted; delete out.baseUpdatedAt; return out;
      };
      const canonical = (source) => JSON.stringify(core.ALL_COLLECTIONS.slice().sort().map((name) => [name,
        (source[name] || []).map(clean).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
      ]));
      if (canonical(snap.data) === canonical(changes)) {
        return { serverTime: snap.revision, alreadyUpToDate: true, collections: Object.fromEntries(Object.entries(changes).map(([name, list]) => [name, list.length])) };
      }
      throw Object.assign(new Error('Supabase đã có dữ liệu khác. Dùng --force chỉ sau khi đã xuất backup.'), { code: 'not_empty' });
    }
    const saved = await core.commit(snap.revision, changes, { name: 'Migration', role: 'owner', id: '' }, [{ action: 'import', collection: 'settings', recordId: 'app', before: null, after: null, note: `Nhập ${Object.keys(changes).length} collection` }]);
    if (saved.ok) return { serverTime: saved.serverTime, collections: Object.fromEntries(Object.entries(changes).map(([name, list]) => [name, list.length])) };
  }
  throw Object.assign(new Error('Dữ liệu thay đổi trong khi migration, vui lòng chạy lại'), { code: 'conflict' });
}

async function exportSnapshot(req) {
  const key = String(req.migrationKey || '');
  if (!process.env.HUY_MIGRATION_KEY || !core.safeEqual(key, process.env.HUY_MIGRATION_KEY)) throw Object.assign(new Error('Khóa migration không đúng'), { code: 'forbidden' });
  const snap = await core.snapshot();
  const data = {};
  core.ALL_COLLECTIONS.forEach((collection) => {
    if (collection === 'settings') {
      data.settings = core.clone((snap.data.settings || [])[0] || {});
      delete data.settings.id; delete data.settings.updatedAt; delete data.settings.deleted;
    } else {
      data[collection] = core.clone(snap.data[collection] || []);
    }
  });
  return { serverTime: snap.revision, exportedAt: core.nowIso(), data };
}

module.exports = async (req, res) => {
  const started = Date.now();
  try {
    if (req.method === 'GET') {
      if (String(req.query && req.query.action || '') !== 'config') return fail(res, Object.assign(new Error('Chỉ hỗ trợ action=config'), { code: 'method' }), 405);
      const cfg = core.env();
      return ok(res, { enabled: !!cfg.publishable, url: cfg.url, publishableKey: cfg.publishable, table: 'huy_sync_signals' });
    }
    if (req.method !== 'POST') return fail(res, Object.assign(new Error('Chỉ nhận POST'), { code: 'method' }), 405);
    const request = await bodyOf(req);
    const action = String(request.action || 'sync');
    let ctx = { authenticated: false, role: 'guest', propertyIds: [] };
    if (!['login', 'book', 'publicAvailability', 'resident', 'importSnapshot', 'exportSnapshot'].includes(action)) ctx = await core.authContext(request);
    let data;
    switch (action) {
      case 'sync': data = await core.syncRequest(request, ctx); break;
      case 'ping': data = ctx.authenticated ? { role: 'admin', staff: { role: ctx.role, name: ctx.staffName, id: ctx.staffId, propertyIds: ctx.propertyIds } } : { role: 'guest' }; break;
      case 'login': data = await login(request); break;
      case 'logout': data = await logout(request, ctx, false); break;
      case 'logoutAll': data = await logout(request, ctx, true); break;
      case 'sessions': data = await sessions(ctx); break;
      case 'setPassword': data = await setPassword(request, ctx); break;
      case 'setStaffPass': data = await setStaffPass(request, ctx); break;
      case 'setTenantPin': data = await setTenantPin(request, ctx); break;
      case 'createReservation': data = await createReservation(request, ctx); break;
      case 'cancelReservation': data = await cancelReservation(request, ctx); break;
      case 'leaseTransition': data = await leaseTransition(request, ctx); break;
      case 'rescheduleAppointment': data = await rescheduleAppointment(request, ctx); break;
      case 'unlockReading': data = await unlockReading(request, ctx); break;
      case 'book': data = await book(request); break;
      case 'publicAvailability': data = await publicAvailability(request); break;
      case 'resident': data = await residentLogin(request); break;
      case 'residentPing': data = await residentPing(request); break;
      case 'residentTicket': data = await residentTicket(request); break;
      case 'residentChangePin': data = await residentChangePin(request); break;
      case 'residentLogout': data = await residentLogout(request, false); break;
      case 'residentLogoutAll': data = await residentLogout(request, true); break;
      case 'residentMarkRead': data = await residentMarkRead(request); break;
      case 'upload': data = await upload(request, ctx); break;
      case 'uploadDocument': data = await uploadDocument(request, ctx); break;
      case 'getPrivateFile': data = await getPrivate(request, ctx, false); break;
      case 'getPrivateImage': data = await getPrivate(request, ctx, false); break;
      case 'residentImage': data = await getPrivate(request, ctx, true); break;
      case 'deletePrivateFile': data = await removeFile(request, ctx, false); break;
      case 'deleteImage': data = await removeFile(request, ctx, true); break;
      case 'importSnapshot': data = await importSnapshot(request); break;
      case 'exportSnapshot': data = await exportSnapshot(request); break;
      case 'sendZalo': data = await sendZalo(request, ctx); break;
      default: throw Object.assign(new Error(`Action chưa được hỗ trợ: ${action}`), { code: 'action' });
    }
    res.setHeader('Server-Timing', `supabase;dur=${Date.now() - started}`);
    return ok(res, data);
  } catch (error) {
    res.setHeader('Server-Timing', `supabase;dur=${Date.now() - started}`);
    return fail(res, error);
  }
};
