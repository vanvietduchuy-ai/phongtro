/* Huy Rooms v4.7.0 - Supabase Realtime invalidation client.
 * Kênh chỉ nhận revision công khai; dữ liệu thật luôn đi qua /api/supabase
 * để server áp phân quyền và lọc trường riêng tư. */
(function () {
  var api = {
    socket: null, sync: null, cfg: null, joined: false, stopped: false,
    ref: 0, heartbeat: null, retry: null, retryCount: 0, pendingWake: null,

    isLive: function () { return !!(this.socket && this.socket.readyState === 1 && this.joined); },
    nextRef: function () { this.ref += 1; return String(this.ref); },
    send: function (message) {
      if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(message));
    },
    wake: function () {
      var self = this;
      clearTimeout(this.pendingWake);
      this.pendingWake = setTimeout(function () {
        if (!self.sync) return;
        if (self.sync.busy) self.sync.again = true;
        else self.sync.schedule(0);
      }, 45);
    },
    start: function (sync) {
      this.sync = sync;
      this.stopped = false;
      var self = this;
      return fetch('/api/supabase?action=config', { cache: 'no-store' })
        .then(function (response) { return response.json(); })
        .then(function (cfg) {
          if (!cfg || !cfg.ok || !cfg.enabled || !cfg.url || !cfg.publishableKey) return;
          self.cfg = cfg;
          self.connect();
        })
        .catch(function () { /* poll ngắn trong sync.js là đường dự phòng */ });
    },
    connect: function () {
      if (this.stopped || !this.cfg || typeof WebSocket === 'undefined') return;
      clearTimeout(this.retry);
      if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) return;
      var self = this;
      var wsBase = this.cfg.url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      var url = wsBase + '/realtime/v1/websocket?apikey=' + encodeURIComponent(this.cfg.publishableKey) + '&vsn=2.0.0';
      var socket = new WebSocket(url);
      this.socket = socket; this.joined = false;
      socket.onopen = function () {
        self.retryCount = 0;
        var ref = self.nextRef();
        self.send([ref, ref, 'realtime:huy-rooms-sync', 'phx_join', {
          config: {
            broadcast: { ack: false, self: false, replication_ready: true },
            presence: { enabled: false, key: '' },
            postgres_changes: [{ event: '*', schema: 'public', table: self.cfg.table || 'huy_sync_signals' }],
            private: false
          },
          access_token: self.cfg.publishableKey
        }]);
        clearInterval(self.heartbeat);
        self.heartbeat = setInterval(function () {
          self.send([null, self.nextRef(), 'phoenix', 'heartbeat', {}]);
        }, 25000);
      };
      socket.onmessage = function (event) {
        var msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        if (!Array.isArray(msg) || msg.length < 5) return;
        var type = msg[3], payload = msg[4] || {};
        if (type === 'phx_reply' && payload.status === 'ok' && payload.response && payload.response.postgres_changes) {
          self.joined = true; self.wake(); return;
        }
        if (type === 'system' && payload.status === 'ok') { self.joined = true; return; }
        if (type === 'postgres_changes') { self.wake(); return; }
        if (type === 'phx_error' || type === 'phx_close' || (type === 'system' && payload.status === 'error')) {
          self.joined = false;
        }
      };
      socket.onerror = function () { self.joined = false; };
      socket.onclose = function () {
        self.joined = false; clearInterval(self.heartbeat); self.heartbeat = null;
        if (self.stopped) return;
        var waits = [1000, 2000, 5000, 10000, 15000];
        var delay = waits[Math.min(self.retryCount, waits.length - 1)];
        self.retryCount += 1;
        self.retry = setTimeout(function () { self.connect(); }, delay);
      };
    },
    stop: function () {
      this.stopped = true; this.joined = false;
      clearTimeout(this.retry); clearTimeout(this.pendingWake); clearInterval(this.heartbeat);
      if (this.socket) try { this.socket.close(1000, 'stop'); } catch (_) {}
      this.socket = null;
    }
  };
  window.HuyRealtime = api;
})();
