/* ============================================================
   sync.js — Đồng bộ Huy Rooms với Supabase (Apps Script là chế độ rollback)
   Tự nhận biết 2 chế độ:
   1. Nhúng trong Apps Script (google.script.run) — không cần cấu hình gì.
   2. Đặt trên Vercel — gọi /api/supabase và nhận tín hiệu Realtime.
   ============================================================ */
(function () {
  var CFG_KEY = 'huy_rooms_conn';
  var STATE_KEY = 'huy_rooms_sync_state';
  var SIGNAL_KEY = 'huy_rooms_sync_signal_v467';
  // v6: đủ mọi collection của giai đoạn 3–6 (trước đây thiếu → tiền/sự cố không lên máy chủ)
  var COLS = ['properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments', 'reservations',
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
    retryCount: 0, _listenersBound: false, _peerChannel: null,
    lastError: '', listeners: [],
    embedded: embedded,

    /* ---------- cấu hình ---------- */
    loadCfg: function () {
      var base = window.HUY_CONFIG || {};
      var saved = readJSON(CFG_KEY, {});
      var backendChanged = !!(base.backendId && saved.backendId !== base.backendId);
      this.cfg = {
        apiUrl: base.forceApi ? (base.apiUrl || '') : (saved.apiUrl || base.apiUrl || ''),
        backendId: base.backendId || saved.backendId || '',
        readKey: backendChanged ? '' : (saved.readKey || base.readKey || ''),
        writeKey: backendChanged ? '' : (saved.writeKey || ''),
        token: backendChanged ? '' : (saved.token || ''),
        staff: backendChanged ? null : (saved.staff || null)   // token backend cũ tuyệt đối không được tái sử dụng
      };
      // token nhân viên mà thiếu hồ sơ vai trò → KHÔNG đoán là owner; xác minh với máy chủ
      this.roleVerified = !this.cfg.token || !!this.cfg.staff;
      this.state = backendChanged ? { since: 0, lastOk: 0 } : readJSON(STATE_KEY, { since: 0, lastOk: 0 });
      this.baseline = backendChanged ? {} : readJSON('huy_rooms_baseline', {});
      this.baseStamp = backendChanged ? {} : readJSON('huy_rooms_base_stamps', {});
      if (backendChanged) { writeJSON(CFG_KEY, this.cfg); this.saveState(); }
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
      writeJSON('huy_rooms_base_stamps', this.baseStamp || {});
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
        return Promise.reject(new Error('Chưa cấu hình đường dẫn máy chủ'));
      } else {
        var sameOrigin = this.cfg.apiUrl.charAt(0) === '/';
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var requestTimer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
        call = fetch(this.cfg.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body,
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        }).then(function (r) { return r.json(); })
          .catch(function (e) {
            if (sameOrigin) {
              if (e && e.name === 'AbortError') throw new Error('Máy chủ phản hồi quá chậm (quá 20 giây)');
              throw e;
            }
            return self.jsonp(payload);       // gọi thẳng Apps Script, dự phòng khi trình duyệt chặn POST
          });
        if (requestTimer) call = call.finally(function () { clearTimeout(requestTimer); });
      }

      return call.then(function (res) {
        if (!res || res.ok === false) {
          if (res && res.code === 'auth') self.saveCfg({ token: '' });
          // v4.2.10: giữ lại mã lỗi + phân biệt "máy chủ từ chối có lý do" với "hỏng đường truyền"
          var e2 = new Error((res && res.error) || 'Máy chủ trả về lỗi');
          e2.code = (res && res.code) || '';
          e2.serverAnswered = !!res;   // có phản hồi = máy chủ vẫn sống, chỉ là từ chối
          throw e2;
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
          if (!seen[id]) list.push({ id: id, deleted: true, updatedAt: now,
            baseUpdatedAt: (self.baseStamp && self.baseStamp[c] && self.baseStamp[c][id]) || 0 });
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
          // Một response sync có thể vừa chứa bản room đã được reconcile ở `changes`,
          // vừa chứa `serverRecord` cũ hơn trong danh sách conflict/rejected. Chỉ áp
          // bản authoritative mới hơn mốc máy chủ cuối cùng đã nhận để baseStamp
          // không bao giờ lùi và tạo vòng conflict vô hạn.
          var incomingStamp = Number(rec.updatedAt || 0);
          var appliedStamp = Number(self.baseStamp && self.baseStamp[c] && self.baseStamp[c][rec.id] || 0);
          if (incomingStamp && appliedStamp && incomingStamp <= appliedStamp) return;
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
            if (!self.baseStamp) self.baseStamp = {};
            if (!self.baseStamp[c]) self.baseStamp[c] = {};
            if (incomingStamp) self.baseStamp[c][rec.id] = incomingStamp;
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
      this.pushTimer = setTimeout(function () { self.cycle(); }, 250);
      this.emit();
    },
    signalPeers: function () {
      var stamp = String(Date.now());
      try { localStorage.setItem(SIGNAL_KEY, stamp); } catch (e) {}
      try { if (this._peerChannel) this._peerChannel.postMessage(stamp); } catch (e2) {}
    },
    cycle: function (manual) {
      var self = this;
      if (!this.isOn()) return Promise.resolve();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.lastError = 'Thiết bị đang ngoại tuyến';
        this.retryCount = Math.min(this.retryCount + 1, 5);
        this.emit();
        if (manual && this.api && this.api.toast) this.api.toast('Chưa thể đồng bộ khi thiết bị đang ngoại tuyến.');
        return Promise.resolve();
      }
      if (this.busy) { this.again = true; return Promise.resolve(); } // xếp hàng, không bỏ sót
      this.busy = true; this.again = false;
      var changes = this.computeChanges();
      var pushed = Object.keys(changes).some(function (col) { return (changes[col] || []).length > 0; });
      // Pull nền rỗng chạy im lặng để chấm trạng thái không nhấp nháy mỗi 6 giây.
      // Chỉ hiện “Đang đồng bộ” khi người dùng bấm tay hoặc có dữ liệu cần đẩy.
      if (manual || pushed) this.emit('Đang đồng bộ…');
      return this.request({ action: 'sync', since: this.state.since || 0, changes: changes })
        .then(function (res) {
          var blocked = {}, needsFullPull = false;
          function key(col, id) { return String(col || '') + ':' + String(id || ''); }
          function mark(list) { (list || []).forEach(function (x) { blocked[key(x.collection, x.id)] = x; }); }
          mark(res.conflicts); mark(res.rejected); mark(res.scopeSkipped);
          (res.skippedWrite || []).forEach(function (col) {
            (changes[col] || []).forEach(function (rec) {
              var k = key(col, rec.id); if (!blocked[k]) { blocked[k] = { collection: col, id: rec.id }; needsFullPull = true; }
            });
          });
          Object.keys(changes).forEach(function (c) {
            if (c === 'settings') {
              if (!blocked[key('settings', 'app')] && (res.skippedWrite || []).indexOf('settings') < 0) self.baseline.__settings = hash(self.api.getData().settings);
              return;
            }
            if (!self.baseline[c]) self.baseline[c] = {};
            changes[c].forEach(function (rec) {
              if (blocked[key(c, rec.id)]) return; // không coi bản bị từ chối là đã lưu
              if (rec.deleted) delete self.baseline[c][rec.id];
              else {
                // `rec` có thêm baseUpdatedAt chỉ để kiểm tra xung đột trên máy chủ.
                // Baseline phải băm đúng bản đang nằm trong data, nếu không lần sync sau
                // sẽ tưởng bản ghi vẫn còn thay đổi và đẩy lặp vô hạn.
                var local = (self.api.getData()[c] || []).filter(function (x) { return x.id === rec.id; })[0];
                if (local) self.baseline[c][rec.id] = hash(local);
              }
            });
          });
          var touched = self.applyRemote(res.changes || {});
          if (res.conflicts && res.conflicts.length) {
            // máy chủ TỪ CHỐI ghi đè: giữ bản máy chủ, báo người dùng, ghi nhật ký
            try { window.dispatchEvent(new CustomEvent('server-conflict', { detail: res.conflicts })); } catch (e) {}
            res.conflicts.forEach(function (cf) {
              if (cf.serverRecord) touched = self.applyRemote((function () { var o = {}; o[cf.collection] = [cf.serverRecord]; return o; })()) || touched;
              else needsFullPull = true;
            });
          }
          if (res.rejected && res.rejected.length) {
            try { window.dispatchEvent(new CustomEvent('sync-rejected', { detail: res.rejected })); } catch (e) {}
            res.rejected.forEach(function (x) {
              if (x.serverRecord) touched = self.applyRemote((function () { var o = {}; o[x.collection] = [x.serverRecord]; return o; })()) || touched;
              else needsFullPull = true;
            });
          }
          if (res.scopeSkipped && res.scopeSkipped.length) {
            try { window.dispatchEvent(new CustomEvent('sync-scope-skipped', { detail: res.scopeSkipped })); } catch (e) {}
            res.scopeSkipped.forEach(function (x) {
              if (x.serverRecord) touched = self.applyRemote((function () { var o = {}; o[x.collection] = [x.serverRecord]; return o; })()) || touched;
              else needsFullPull = true;
            });
          }
          if (res.skippedWrite && res.skippedWrite.length && !self._warnedSkip) {
            self._warnedSkip = true;
            self.lastSkipped = res.skippedWrite;
            try { window.dispatchEvent(new CustomEvent('sync-skipped', { detail: res.skippedWrite })); } catch (e) {}
          }
          self.state.since = res.serverTime;
          self.state.lastOk = Date.now();
          self.lastError = ''; self.retryCount = 0;
          self.saveState();
          if (pushed) self.signalPeers();
          if (touched) { self.api.saveLocal(); self.api.rerender(); }
          self.busy = false; self.emit(manual ? 'Đã đồng bộ' : '');
          if (needsFullPull) return self.fullPull(); // dự phòng khi ghép với Apps Script cũ chưa trả bản authoritative
          if (self.again) return self.cycle();
          return res;
        })
        .catch(function (err) {
          self.busy = false; self.again = false;
          self.lastError = err.message || String(err);
          self.retryCount = Math.min(self.retryCount + 1, 5);
          self.emit();
          if (manual) self.api.toast('Không đồng bộ được: ' + self.lastError);
        });
    },
    /** Chờ vòng đang chạy xong rồi đẩy hết thay đổi trước action nhiều bảng. */
    flush: function () {
      var self = this;
      if (!this.isOn()) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var started = Date.now();
        function run() {
          if (self.busy) {
            if (Date.now() - started > 30000) { reject(new Error('Đồng bộ đang bận quá lâu')); return; }
            setTimeout(run, 80); return;
          }
          self.cycle(true).then(function (res) {
            if (self.lastError) reject(new Error(self.lastError)); else resolve(res);
          }).catch(reject);
        }
        run();
      });
    },
    pollDelay: function () {
      // Realtime là đường chính. Poll chỉ để bù khi tab ngủ/mất một event;
      // nếu WebSocket rớt thì tự hạ xuống 2.5–4 giây thay vì chờ 6–8 giây.
      var realtimeLive = window.HuyRealtime && window.HuyRealtime.isLive();
      var base = realtimeLive ? 30000 : (this.isAdmin() ? 6000 : 8000);
      if (!this.lastError) return base;
      // Khi server thật sự báo lỗi, giữ ngưỡng backoff P3 cũ để tránh bão retry.
      var errorBase = this.isAdmin() ? 6000 : 8000;
      var delay = Math.min(300000, errorBase * Math.pow(2, Math.min(this.retryCount, 4)));
      return Math.min(300000, Math.round(delay * (1 + Math.random() * 0.15)));
    },
    schedule: function (delay) {
      var self = this;
      clearTimeout(this.timer);
      if (!this.isOn()) return;
      this.timer = setTimeout(function () {
        if (document.hidden) { self.timer = null; return; }
        Promise.resolve().then(function () { return self.cycle(); }).catch(function (err) {
          self.busy = false; self.again = false;
          self.lastError = (err && err.message) || String(err);
          self.retryCount = Math.min(self.retryCount + 1, 5);
          self.emit();
        }).then(function () { self.schedule(self.pollDelay()); });
      }, Math.max(0, Number(delay) || 0));
    },
    start: function () {
      var self = this;
      if (!this.isOn()) { this.emit(); return; }
      this.schedule(0);
      if (!embedded() && window.HuyRealtime && !window.HuyRealtime.sync) window.HuyRealtime.start(this);
      if (!this._listenersBound) {
        this._listenersBound = true;
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.schedule(0);
        });
        window.addEventListener('focus', function () { self.schedule(0); });
        window.addEventListener('pageshow', function () { self.schedule(0); });
        window.addEventListener('online', function () {
          self.retryCount = 0;
          self.schedule(0);
        });
        window.addEventListener('storage', function (e) {
          if (e && e.key === SIGNAL_KEY) self.schedule(0);
        });
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            this._peerChannel = new BroadcastChannel('huy-rooms-sync');
            this._peerChannel.onmessage = function () { self.schedule(0); };
          } catch (e) {}
        }
      }
    },

    /** Lấy lại toàn bộ dữ liệu từ máy chủ (dùng ngay sau khi đăng nhập quản lý) */
    fullPull: function () {
      var self = this;
      this.state.since = 0;
      this.baseline = {};
      this.baseStamp = {};
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

    /** Áp ngay gói thay đổi của một action nguyên tử (giữ chỗ/hủy giữ chỗ). */
    applyActionResult: function (res) {
      if (!res || !res.changes) return false;
      var touched = this.applyRemote(res.changes);
      // Action chỉ trả những bản ghi nó vừa thay đổi, không phải toàn bộ delta.
      // Không nâng `since` tại đây: làm vậy có thể bỏ sót thay đổi của thiết bị khác
      // xảy ra giữa lần sync gần nhất và action này. Vòng sync kế tiếp sẽ nhận đủ delta.
      this.state.lastOk = Date.now(); this.lastError = '';
      this.saveState();
      this.signalPeers();
      if (touched) { this.api.saveLocal(); this.api.rerender(); }
      return touched;
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
        self.baseStamp = {};
        return self.cycle(true).then(function () { self.start(); return { mode: 'push', role: res.role }; });
      });
    },
    disconnect: function () {
      clearTimeout(this.timer);
      clearTimeout(this.pushTimer);
      this.timer = null; this.pushTimer = null; this.retryCount = 0;
      this.saveCfg({ writeKey: '', token: '' });
      this.state = { since: 0, lastOk: 0 };
      this.baseline = {};
      this.baseStamp = {};
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
    uploadDocument: function (file, leaseId) {
      var self = this;
      if (!this.isOn() || !this.isAdmin()) return Promise.reject(new Error('Cần kết nối và đăng nhập quản lý để lưu hồ sơ'));
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1];
          self.request({ action: 'uploadDocument', leaseId: leaseId, name: file.name, mime: file.type || '', data: b64 })
            .then(function (res) { resolve(res.file); }).catch(reject);
        };
        fr.onerror = function () { reject(new Error('Không đọc được tệp')); };
        fr.readAsDataURL(file);
      });
    },
    fetchPrivateFile: function (fileId, leaseId) {
      return this.request({ action: 'getPrivateFile', fileId: fileId, leaseId: leaseId });
    },
    deletePrivateFile: function (fileId, leaseId) {
      return this.request({ action: 'deletePrivateFile', fileId: fileId, leaseId: leaseId });
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
    createReservation: function (reservation) {
      return this.request({ action: 'createReservation', reservation: reservation });
    },
    cancelReservation: function (payload) {
      return this.request(Object.assign({ action: 'cancelReservation' }, payload || {}));
    },
    rescheduleAppointment: function (payload) {
      return this.request(Object.assign({ action: 'rescheduleAppointment' }, payload || {}));
    },
    leaseTransition: function (payload) {
      return this.request(Object.assign({ action: 'leaseTransition' }, payload || {}));
    },
    deleteImage: function (fileId) {
      return this.request({ action: 'deleteImage', fileId: fileId });
    },
    book: function (payload) {
      return this.request(Object.assign({ action: 'book' }, payload));
    },
    publicAvailability: function (roomId, date) {
      return this.request({ action: 'publicAvailability', roomId: roomId, date: date });
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
    residentLogout: function (phone, sessionKey) {
      return this.request({ action: 'residentLogout', phone: phone, sessionKey: sessionKey });
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
