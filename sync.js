/* ============================================================
   sync.js — Đồng bộ Huy Rooms với Google Sheets
   Tự nhận biết 2 chế độ:
   1. Nhúng trong Apps Script (google.script.run) — không cần cấu hình gì.
   2. Đặt trên hosting riêng — gọi tới đường dẫn /exec khai trong config.js.
   ============================================================ */
(function () {
  var CFG_KEY = 'huy_rooms_conn';
  var STATE_KEY = 'huy_rooms_sync_state';
  var COLS = ['properties', 'rooms', 'tenants', 'utilityReadings', 'invoices', 'appointments'];
  var GUEST_PUSH = ['appointments'];
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
        token: saved.token || ''
      };
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
      COLS.forEach(function (c) {
        base[c] = {};
        (data[c] || []).forEach(function (item) { base[c][item.id] = hash(item); });
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
          if (base[item.id] !== h) { item.updatedAt = now; list.push(item); }
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
      var cols = this.isAdmin() ? COLS : GUEST_PULL;
      cols.forEach(function (c) {
        (changes[c] || []).forEach(function (rec) {
          var arr = data[c] || (data[c] = []);
          var idx = -1;
          for (var i = 0; i < arr.length; i++) { if (arr[i].id === rec.id) { idx = i; break; } }
          if (rec.deleted) {
            if (idx >= 0) { arr.splice(idx, 1); touched = true; }
            if (self.baseline[c]) delete self.baseline[c][rec.id];
            return;
          }
          var same = idx >= 0 && contentHash(arr[idx]) === contentHash(rec);
          if (idx >= 0) arr[idx] = rec; else arr.push(rec);
          if (!self.baseline[c]) self.baseline[c] = {};
          self.baseline[c][rec.id] = hash(rec);
          if (!same) touched = true; // chỉ vẽ lại khi nội dung thật sự đổi
        });
      });
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
    uploadImage: function (blob, name) {
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
            data: b64
          }).then(function (res) { resolve(res.url); }).catch(reject);
        };
        fr.onerror = function () { reject(new Error('Không đọc được ảnh')); };
        fr.readAsDataURL(blob);
      });
    },

    /* ---------- tài khoản ---------- */
    adminLogin: function (password) {
      var self = this;
      return this.request({ action: 'login', password: password, key: '' }).then(function (res) {
        self.saveCfg({ token: res.token });
        return res;
      });
    },
    changePassword: function (newPassword) {
      return this.request({ action: 'setPassword', newPassword: newPassword });
    },
    residentLogin: function (phone, pin) {
      return this.request({ action: 'resident', phone: phone, pin: pin });
    }
  };

  window.Sync = Sync;
})();
