/* ============================================================
   sync.js — Đồng bộ Huy Rooms với Google Sheets
   Tự nhận biết 2 chế độ:
   1. Nhúng trong Apps Script (google.script.run) — không cần cấu hình gì.
   2. Đặt trên hosting riêng — gọi tới đường dẫn /exec khai trong config.js.
   ============================================================ */
(function () {
  var CFG_KEY = 'huy_rooms_conn';
  var STATE_KEY = 'huy_rooms_sync_state';
  // v6: đủ mọi collection của giai đoạn 3–6 (trước đây thiếu → tiền/sự cố không lên máy chủ)
  var COLS = ['properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments',
    'leases', 'leaseOccupants', 'accounts', 'assets', 'handoverItems',
    'serviceDefinitions', 'leaseServices', 'payments', 'depositLedger', 'reminders',
    'maintenanceTickets', 'notifications', 'staffUsers'];
  var PULL_ONLY = ['auditLog'];  // máy chủ tự ghi, client chỉ đọc
  // Khách không đẩy gì qua sync — đặt lịch dùng action 'book' có kiểm tra riêng
  var GUEST_PUSH = [];
  var GUEST_PULL = ['properties', 'rooms'];

  function embedded() {
    return !!(window.google && window.google.script && window.google.script.run);
  }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function stable(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(stable);
    var out = {};
    Object.keys(o).sort().forEach(function (k) { out[k] = stable(o[k]); });
    return out;
  }
  function hash(o) { return JSON.stringify(stable(o)); }
  function contentHash(o) {
    var c = Object.assign({}, o);
    delete c.updatedAt; delete c.deleted;
    return hash(c);
  }

  var Sync = {
    api: null, cfg: null, state: null, baseline: {},
    timer: null, pushTimer: null, busy: false, again: false,
    lastError: '', listeners: [],
    embedded: embedded,

    /* ---------- cấu hình ---------- */
    loadCfg: function () {
      var base = window.HUY_CONFIG || {};
      var saved = readJSON(CFG_KEY, {});
      this.cfg = {
        apiUrl: saved.apiUrl || base.apiUrl || '',
        readKey: saved.readKey || base.readKey || '',
        writeKey: saved.writeKey || '',
        token: saved.token || '',
        staff: saved.staff || null   // v4.1: vai trò nhân viên SỐNG QUA reload
      };
      // token nhân viên mà thiếu hồ sơ vai trò → KHÔNG đoán là owner; xác minh với máy chủ
      this.roleVerified = !this.cfg.token || !!this.cfg.staff;
      this.state = readJSON(STATE_KEY, { since: 0, lastOk: 0 });
      this.baseline = readJSON('huy_rooms_baseline', {});
      return this.cfg;
    },
    saveCfg: function (patch) {
      Object.assign(this.cfg, patch || {});
      writeJSON(CFG_KEY, this.cfg);
      this.emit();
    },
    saveState: function () {
      writeJSON(STATE_KEY, this.state);
      writeJSON('huy_rooms_baseline', this.baseline);
    },
    isOn: function () { return embedded() || !!this.cfg.apiUrl; },
    isAdmin: function () { return !!(this.cfg.token || this.cfg.writeKey); },
    activeKey: function () { return this.cfg.writeKey || this.cfg.readKey || ''; },

    attach: function (api) { this.api = api; this.loadCfg(); },
    onStatus: function (fn) { this.listeners.push(fn); },
    emit: function (msg) {
      var s = {
        on: this.isOn(), role: this.isAdmin() ? 'admin' : 'guest',
        busy: this.busy, lastOk: this.state.lastOk,
        error: this.lastError, message: msg || ''
      };
      this.listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
    },

    /* ---------- gọi máy chủ ---------- */
    request: function (payload) {
      var self = this;
      payload.token = payload.token || this.cfg.token || '';
      if (payload.key === undefined) payload.key = this.activeKey();
      var body = JSON.stringify(payload);

      var call;
      if (embedded()) {
        call = new Promise(function (resolve, reject) {
          window.google.script.run
            .withSuccessHandler(function (txt) {
              try { resolve(typeof txt === 'string' ? JSON.parse(txt) : txt); }
              catch (e) { reject(new Error('Phản hồi không đọc được')); }
            })
            .withFailureHandler(function (e) { reject(new Error((e && e.message) || 'Không gọi được máy chủ')); })
            .api(body);
        });
      } else if (!this.cfg.apiUrl) {
        return Promise.reject(new Error('Chưa cấu hình đường dẫn Apps Script'));
      } else {
        var sameOrigin = this.cfg.apiUrl.charAt(0) === '/';
        call = fetch(this.cfg.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body
        }).then(function (r) { return r.json(); })
          .catch(function (e) {
            if (sameOrigin) throw e;          // qua cầu nối /api/sheets thì không cần dự phòng
            return self.jsonp(payload);       // gọi thẳng Apps Script, dự phòng khi trình duyệt chặn POST
          });
      }

      return call.then(function (res) {
        if (!res || res.ok === false) {
          if (res && res.code === 'auth') self.saveCfg({ token: '' });
          throw new Error((res && res.error) || 'Máy chủ trả về lỗi');
        }
        return res;
      });
    },
    jsonp: function (payload) {
      var url = this.cfg.apiUrl;
      return new Promise(function (resolve, reject) {
        var cb = 'huycb' + Date.now() + Math.floor(Math.random() * 1000);
        var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        if (b64.length > 7000) { reject(new Error('Dữ liệu quá lớn để gửi dự phòng')); return; }
        var s = document.createElement('script');
        var timer = setTimeout(function () { cleanup(); reject(new Error('Máy chủ không phản hồi')); }, 25000);
        function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
        window[cb] = function (res) { cleanup(); resolve(res); };
        s.onerror = function () { cleanup(); reject(new Error('Không gọi được Apps Script')); };
        s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + cb + '&p=' + encodeURIComponent(b64);
        document.body.appendChild(s);
      });
    },

    /* ---------- so sánh thay đổi cục bộ ---------- */
    snapshot: function () {
      var data = this.api.getData();
      var base = {};
      this.baseStamp = this.baseStamp || {};
      var bs = this.baseStamp;
      COLS.forEach(function (c) {
        base[c] = {};
        bs[c] = bs[c] || {};
        (data[c] || []).forEach(function (item) {
          base[c][item.id] = hash(item);
          if (item.updatedAt) bs[c][item.id] = item.updatedAt;
        });
      });
      base.__settings = hash(data.settings);
      this.baseline = base;
      this.saveState();
    },
    computeChanges: function () {
      var data = this.api.getData();
      var now = Date.now(), changes = {}, self = this;
      var cols = this.isAdmin() ? COLS : GUEST_PUSH;
      cols.forEach(function (c) {
        var base = self.baseline[c] || {}, seen = {}, list = [];
        (data[c] || []).forEach(function (item) {
          if (!item.id) return;
          seen[item.id] = 1;
          if (item._temp) return; // bản ghi tạm của cổng cư dân, không đẩy lên
          var h = hash(item);
          if (base[item.id] !== h) {
            item.updatedAt = now;
            var copy = {}; for (var k in item) copy[k] = item[k];
            // v4.1: kèm dấu thời gian bản đã đọc — máy chủ sẽ TỪ CHỐI ghi đè nếu bản trên đó mới hơn
            copy.baseUpdatedAt = (self.baseStamp && self.baseStamp[c] && self.baseStamp[c][item.id]) || 0;
            list.push(copy);
          }
        });
        Object.keys(base).forEach(function (id) {
          if (!seen[id]) list.push({ id: id, deleted: true, updatedAt: now });
        });
        if (list.length) changes[c] = list;
      });
      if (this.isAdmin()) {
        var sh = hash(data.settings);
        if (this.baseline.__settings !== sh) {
          changes.settings = [Object.assign({ id: 'app' }, data.settings, { updatedAt: now })];
        }
      }
      return changes;
    },
    hasPending: function () { return Object.keys(this.computeChanges()).length > 0; },

    applyRemote: function (changes) {
      var data = this.api.getData(), self = this, touched = false;
      var cols = this.isAdmin() ? COLS.concat(PULL_ONLY) : GUEST_PULL;
      // Bản ghi TÀI CHÍNH bị thiết bị khác sửa trong lúc máy này cũng đang sửa → cảnh báo, không im lặng
      var FINANCIAL = { invoices: 'Hóa đơn', payments: 'Sổ thu', depositLedger: 'Sổ cọc', leases: 'Hợp đồng', utilityReadings: 'Chỉ số điện nước' };
      var conflicts = [];
      cols.forEach(function (c) {
        (changes[c] || []).forEach(function (rec) {
          var arr = data[c] || (data[c] = []);
          var idx = -1;
          for (var i = 0; i < arr.length; i++) { if (arr[i].id === rec.id) { idx = i; break; } }
          if (FINANCIAL[c] && idx >= 0 && !rec.deleted) {
            var baseH = self.baseline[c] && self.baseline[c][rec.id];
            var localH = hash(arr[idx]), remoteH = hash(rec);
            // máy này có sửa (khác baseline) VÀ máy khác cũng đã sửa khác đi
            if (baseH && localH !== baseH && remoteH !== baseH && remoteH !== localH) {
              conflicts.push({ col: c, colName: FINANCIAL[c], id: rec.id, local: arr[idx], remote: rec });
            }
          }
          if (rec.deleted) {
            if (idx >= 0) { arr.splice(idx, 1); touched = true; }
            if (self.baseline[c]) delete self.baseline[c][rec.id];
            return;
          }
          var same = idx >= 0 && contentHash(arr[idx]) === contentHash(rec);
          if (idx >= 0) arr[idx] = rec; else arr.push(rec);
          if (!self.baseline[c]) self.baseline[c] = {};
          self.baseline[c][rec.id] = hash(rec);
          if (!self.baseStamp) self.baseStamp = {};
          if (!self.baseStamp[c]) self.baseStamp[c] = {};
          if (rec.updatedAt) self.baseStamp[c][rec.id] = rec.updatedAt;
          if (!same) touched = true; // chỉ vẽ lại khi nội dung thật sự đổi
        });
      });
      if (conflicts.length) {
        this.lastConflicts = conflicts;
        try { window.dispatchEvent(new CustomEvent('sync-conflict', { detail: conflicts })); } catch (e) {}
      }
      if (this.isAdmin() && changes.settings && changes.settings.length) {
        var s = Object.assign({}, changes.settings[0]);
        delete s.id; delete s.updatedAt; delete s.deleted;
        Object.assign(data.settings, s);
        this.baseline.__settings = hash(data.settings);
        touched = true;
      }
      return touched;
    },

    /* ---------- vòng đồng bộ ---------- */
    onLocalChange: function () {
      if (!this.isOn()) return;
      var self = this;
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(function () { self.cycle(); }, 900);
      this.emit();
    },
    cycle: function (manual) {
      var self = this;
      if (!this.isOn()) return Promise.resolve();
      if (this.busy) { this.again = true; return Promise.resolve(); } // xếp hàng, không bỏ sót
      this.busy = true; this.again = false;
      this.emit(manual ? 'Đang đồng bộ…' : '');
      var changes = this.computeChanges();
      return this.request({ action: 'sync', since: this.state.since || 0, changes: changes })
        .then(function (res) {
          Object.keys(changes).forEach(function (c) {
            if (c === 'settings') { self.baseline.__settings = hash(self.api.getData().settings); return; }
            if (!self.baseline[c]) self.baseline[c] = {};
            changes[c].forEach(function (rec) {
              if (rec.deleted) delete self.baseline[c][rec.id];
              else self.baseline[c][rec.id] = hash(rec);
            });
          });
          var touched = self.applyRemote(res.changes || {});
          if (res.conflicts && res.conflicts.length) {
            // máy chủ TỪ CHỐI ghi đè: giữ bản máy chủ, báo người dùng, ghi nhật ký
            try { window.dispatchEvent(new CustomEvent('server-conflict', { detail: res.conflicts })); } catch (e) {}
            res.conflicts.forEach(function (cf) {
              if (cf.serverRecord) self.applyRemote((function () { var o = {}; o[cf.collection] = [cf.serverRecord]; return o; })());
            });
          }
          if (res.rejected && res.rejected.length) {
            try { window.dispatchEvent(new CustomEvent('sync-rejected', { detail: res.rejected })); } catch (e) {}
            // đồng bộ lại bản máy chủ để bản máy không giữ mãi thay đổi bị từ chối
            self.state.since = 0;
          }
          if (res.scopeSkipped && res.scopeSkipped.length) {
            try { window.dispatchEvent(new CustomEvent('sync-scope-skipped', { detail: res.scopeSkipped })); } catch (e) {}
          }
          if (res.skippedWrite && res.skippedWrite.length && !self._warnedSkip) {
            self._warnedSkip = true;
            self.lastSkipped = res.skippedWrite;
            try { window.dispatchEvent(new CustomEvent('sync-skipped', { detail: res.skippedWrite })); } catch (e) {}
          }
          self.state.since = res.serverTime;
          self.state.lastOk = Date.now();
          self.lastError = '';
          self.saveState();
          if (touched) { self.api.saveLocal(); self.api.rerender(); }
          self.busy = false; self.emit(manual ? 'Đã đồng bộ' : '');
          if (self.again) return self.cycle();
          return res;
        })
        .catch(function (err) {
          self.busy = false; self.again = false;
          self.lastError = err.message || String(err);
          self.emit();
          if (manual) self.api.toast('Không đồng bộ được: ' + self.lastError);
        });
    },
    start: function () {
      var self = this;
      if (!this.isOn()) { this.emit(); return; }
      this.cycle();
      clearInterval(this.timer);
      this.timer = setInterval(function () {
        if (document.hidden) return;
        self.cycle();
      }, this.isAdmin() ? 20000 : 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) self.cycle(); });
      window.addEventListener('online', function () { self.cycle(); });
    },

    /** Lấy lại toàn bộ dữ liệu từ máy chủ (dùng ngay sau khi đăng nhập quản lý) */
    fullPull: function () {
      var self = this;
      this.state.since = 0;
      this.baseline = {};
      return this.request({ action: 'sync', since: 0, changes: {} }).then(function (r) {
        var data = self.api.getData();
        COLS.forEach(function (c) { data[c] = []; });
        self.applyRemote(r.changes || {});
        self.state.since = r.serverTime;
        self.state.lastOk = Date.now();
        self.saveState();
        self.api.saveLocal(); self.api.rerender();
        self.start();
        return r;
      });
    },

    /* ---------- kết nối thủ công (bản đặt trên hosting riêng) ---------- */
    connect: function (opts) {
      var self = this;
      this.saveCfg({
        apiUrl: (opts.apiUrl || '').trim(),
        readKey: (opts.readKey || '').trim(),
        writeKey: (opts.writeKey || '').trim()
      });
      return this.request({ action: 'ping' }).then(function (res) {
        if (opts.mode === 'pull') return self.fullPull().then(function () { return { mode: 'pull', role: res.role }; });
        self.state.since = 0;
        self.baseline = {};
        return self.cycle(true).then(function () { self.start(); return { mode: 'push', role: res.role }; });
      });
    },
    disconnect: function () {
      clearInterval(this.timer);
      this.saveCfg({ writeKey: '', token: '' });
      this.state = { since: 0, lastOk: 0 };
      this.baseline = {};
      this.saveState();
      this.emit();
    },

    /* ---------- ảnh ---------- */
    uploadImage: function (blob, name, scope) {
      var self = this;
      if (!this.isOn() || !this.isAdmin()) return Promise.reject(new Error('offline'));
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1];
          self.request({
            action: 'upload',
            name: name || ('anh-' + Date.now() + '.jpg'),
            mime: blob.type || 'image/jpeg',
            data: b64,
            scope: scope || 'public'   // v4.1: ảnh nghiệp vụ đi kho private
          }).then(function (res) { resolve(scope === 'private' ? ('priv:' + res.id) : res.url); }).catch(reject);
        };
        fr.onerror = function () { reject(new Error('Không đọc được ảnh')); };
        fr.readAsDataURL(blob);
      });
    },
    fetchPrivateImage: function (imageId) {
      return this.request({ action: 'getPrivateImage', imageId: imageId });
    },

    /* ---------- tài khoản ---------- */
    deviceName: function () {
      try {
        var ua = navigator.userAgent || '';
        var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS'
          : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Thiết bị';
        return os + ' · ' + new Date().toLocaleDateString('vi-VN');
      } catch (e) { return 'Thiết bị'; }
    },
    adminLogin: function (password, user) {
      var self = this;
      return this.request({ action: 'login', password: password, user: user || '', key: '', deviceName: this.deviceName() }).then(function (res) {
        self.saveCfg({ token: res.token, staff: res.staff || { role: 'owner', name: 'Chủ nhà', id: '', propertyIds: [] } });
        self.roleVerified = true;
        return res;
      });
    },
    staff: function () {
      if (!this.isOn() || !this.isAdmin()) return null;
      if (this.cfg.staff) return this.cfg.staff;
      // có token nhưng chưa rõ vai trò (dữ liệu cũ trước v4.1) → trạng thái chờ xác minh, KHÔNG phải owner
      return this.cfg.token ? { role: 'pending', name: '…', id: '', propertyIds: [] } : { role: 'owner', name: 'Chủ nhà', id: '', propertyIds: [] };
    },
    /** v4.1: hỏi máy chủ hồ sơ vai trò của token hiện tại (dùng sau reload nếu thiếu). */
    verifyRole: function () {
      var self = this;
      if (!this.isOn() || !this.cfg.token || this.cfg.staff) { this.roleVerified = true; return Promise.resolve(this.cfg.staff); }
      return this.request({ action: 'ping' }).then(function (res) {
        if (res.staff) self.saveCfg({ staff: res.staff });
        self.roleVerified = true;
        try { window.dispatchEvent(new CustomEvent('role-verified', { detail: res.staff })); } catch (e) {}
        return res.staff;
      }).catch(function () { return null; }); // giữ trạng thái pending → UI vẫn khóa
    },
    setStaffPass: function (staffId, password) {
      return this.request({ action: 'setStaffPass', staffId: staffId, password: password || '' });
    },
    changePassword: function (newPassword) {
      var self = this;
      return this.request({ action: 'setPassword', newPassword: newPassword, deviceName: this.deviceName() })
        .then(function (res) {
          // Máy chủ đã vô hiệu hóa mọi token cũ và cấp token mới cho phiên này
          if (res.token) self.saveCfg({ token: res.token });
          return res;
        });
    },
    logoutDevice: function () {
      var self = this;
      return this.request({ action: 'logout' })
        .catch(function () {})
        .then(function () { self.saveCfg({ token: '', writeKey: '' }); self.emit(); });
    },
    logoutAll: function () {
      var self = this;
      return this.request({ action: 'logoutAll' }).then(function () {
        self.saveCfg({ token: '', writeKey: '' });
        self.emit();
      });
    },
    setTenantPin: function (tenantId, pin) {
      return this.request({ action: 'setTenantPin', tenantId: tenantId, pin: pin || '' });
    },
    deleteImage: function (fileId) {
      return this.request({ action: 'deleteImage', fileId: fileId });
    },
    book: function (payload) {
      return this.request(Object.assign({ action: 'book' }, payload));
    },
    residentLogin: function (phone, pin) {
      return this.request({ action: 'resident', phone: phone, pin: pin });
    },
    residentPing: function (phone, sessionKey) {
      return this.request({ action: 'residentPing', phone: phone, sessionKey: sessionKey });
    },
    residentTicket: function (payload) {
      return this.request(Object.assign({ action: 'residentTicket' }, payload));
    },
    residentChangePin: function (payload) {
      return this.request(Object.assign({ action: 'residentChangePin' }, payload));
    },
    residentLogoutAll: function (phone, sessionKey) {
      return this.request({ action: 'residentLogoutAll', phone: phone, sessionKey: sessionKey });
    },
    residentMarkRead: function (phone, sessionKey, ids) {
      return this.request({ action: 'residentMarkRead', phone: phone, sessionKey: sessionKey, ids: ids });
    },
    sendZalo: function (tenantId, message) {
      return this.request({ action: 'sendZalo', tenantId: tenantId, message: message });
    }
  };

  window.Sync = Sync;
})();
