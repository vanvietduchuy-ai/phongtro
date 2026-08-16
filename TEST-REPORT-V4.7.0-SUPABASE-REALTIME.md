# Test report v4.7.0 — Supabase Realtime

Ngày kiểm tra: 2026-08-15 (Asia/Bangkok)

## Tự động

Đã chạy 11 bộ test Node, tất cả PASS:

1. P0 reservation/deposit/lifecycle.
2. P1 audit.
3. P1 permission.
4. P1 business regression.
5. P2 modal/data.
6. P2 feature regression.
7. P2 UX.
8. P3 hardening/recovery/build.
9. v4.6.6 room sync hotfix.
10. v4.6.7 fast sync.
11. v4.7 Supabase Realtime.

Test v4.7 bao phủ:

- frontend dùng `/api/supabase`, không chứa secret/service-role;
- RLS, publication và signal-only Realtime;
- WebSocket reconnect/heartbeat/wakeup và service worker cache;
- stale conflict không ghi đè;
- trường hash/PIN server-only không bị client xóa;
- ledger không sửa/xóa; reversal hợp lệ gồm bút toán âm;
- ưu tiên trạng thái phòng;
- draft lease chỉ reserved khi còn cọc, gồm cọc reservation đã liên kết;
- archive guard và property scope;
- đầy đủ importer/exporter/verifier/rollback guide.

## Kiểm tra tĩnh

- `node --check`: API core, API route, Realtime client và 3 script migration PASS.
- `vercel.json` parse JSON PASS.
- build `apps-script/Index.html` PASS để giữ phương án rollback.
- không tìm thấy `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_` hoặc `service_role` trong file frontend.

## Chưa thể kiểm tra trong môi trường đóng gói

Chưa có URL/key Supabase của người dùng nên chưa đo latency mạng thật, chưa chạy SQL trên project thật và chưa thử Realtime hai thiết bị thật. Trước promote Production phải hoàn thành mục 6–7 trong `HUONG-DAN-SUPABASE-REALTIME.md`; sai một số tài chính thì dừng migration.
